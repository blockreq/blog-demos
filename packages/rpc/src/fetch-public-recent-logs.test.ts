import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import {
  classifyLogRpcError,
  fetchPublicRecentLogs,
  initialGetLogsWindow,
  nextGetLogsWindow,
  PUBLIC_GETLOGS_BSC_SAFE_WINDOW,
  PUBLIC_GETLOGS_SAFE_WINDOW,
} from "./index.ts";

const TIP = "0x1000"; // 4096
const SAMPLE_LOG = {
  address: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
  topics: ["0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9"],
  data: "0x" + "00".repeat(64),
  blockNumber: "0x1000",
  transactionHash: "0x" + "ab".repeat(32),
  logIndex: "0x1",
};

type RpcBody = { method?: string; params?: unknown[] };

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function logsWindow(params: unknown[] | undefined): number {
  const filter = params?.[0] as { fromBlock?: string; toBlock?: string } | undefined;
  const from = parseInt(String(filter?.fromBlock || "0x0"), 16);
  const to = parseInt(String(filter?.toBlock || "0x0"), 16);
  return to - from;
}

describe("getLogs window helpers", () => {
  it("classifies -32005 / Rate limit as rateLimit, not window", () => {
    assert.equal(classifyLogRpcError(-32005, "Rate limit reached"), "rateLimit");
    assert.equal(classifyLogRpcError(429, "HTTP 429"), "rateLimit");
    assert.equal(classifyLogRpcError(undefined, "rate limit"), "rateLimit");
  });

  it("classifies too-many-results / size / query-limit as window", () => {
    assert.equal(classifyLogRpcError(-32014, "cannot serve this request"), "window");
    assert.equal(classifyLogRpcError(undefined, "query returned more than 10000 results"), "window");
    assert.equal(classifyLogRpcError(undefined, "Log response size exceeded"), "window");
    assert.equal(classifyLogRpcError(undefined, "query limit exceeded"), "window");
    assert.equal(classifyLogRpcError(undefined, "too many results"), "window");
  });

  it("shrinks 900→512→128→64→32→16 then stops", () => {
    assert.equal(nextGetLogsWindow(900), 512);
    assert.equal(nextGetLogsWindow(512), 128);
    assert.equal(nextGetLogsWindow(128), 64);
    assert.equal(nextGetLogsWindow(64), 32);
    assert.equal(nextGetLogsWindow(32), 16);
    assert.equal(nextGetLogsWindow(16), 0);
  });

  it("chainHint bsc starts at 64; explicit windowBlocks wins", () => {
    assert.equal(initialGetLogsWindow({}), PUBLIC_GETLOGS_SAFE_WINDOW);
    assert.equal(initialGetLogsWindow({ chainHint: "bsc" }), PUBLIC_GETLOGS_BSC_SAFE_WINDOW);
    assert.equal(initialGetLogsWindow({ chainHint: "bsc", windowBlocks: 32 }), 32);
  });
});

describe("fetchPublicRecentLogs", () => {
  const origFetch = globalThis.fetch;

  before(() => {
    (globalThis as unknown as { window: unknown }).window = globalThis;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class FakeWs {};
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("retries -32005 with the same window then succeeds", async () => {
    const getLogsWindows: number[] = [];
    let getLogsCalls = 0;
    const retries: number[] = [];
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as RpcBody;
      if (body.method === "eth_blockNumber") {
        return jsonRes({ jsonrpc: "2.0", id: 1, result: TIP });
      }
      if (body.method === "eth_getLogs") {
        getLogsCalls += 1;
        getLogsWindows.push(logsWindow(body.params));
        if (getLogsCalls < 3) {
          return jsonRes({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32005, message: "Rate limit reached" },
          });
        }
        return jsonRes({ jsonrpc: "2.0", id: 1, result: [SAMPLE_LOG] });
      }
      return jsonRes({ jsonrpc: "2.0", id: 1, error: { message: "unexpected" } });
    }) as typeof fetch;

    const result = await fetchPublicRecentLogs({
      https: "https://bsc-rpc.blockreq.com/v1/rpc/public",
      topics: ["0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9"],
      chainHint: "bsc",
      rateLimitBackoffMs: 0,
      onRateLimitRetry: (info) => retries.push(info.attempt),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(getLogsCalls, 3);
    assert.deepEqual(getLogsWindows, [64, 64, 64]);
    assert.equal(result.windowBlocks, 64);
    assert.equal(result.logs.length, 1);
    assert.deepEqual(retries, [1, 2]);
  });

  it("fails with reason rateLimit after exhausting retries (no shrink)", async () => {
    let getLogsCalls = 0;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as RpcBody;
      if (body.method === "eth_blockNumber") {
        return jsonRes({ jsonrpc: "2.0", id: 1, result: TIP });
      }
      getLogsCalls += 1;
      return jsonRes({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32005, message: "Rate limit reached" },
      });
    }) as typeof fetch;

    const result = await fetchPublicRecentLogs({
      https: "https://example.invalid/rpc",
      topics: ["0x01"],
      windowBlocks: 900,
      rateLimitAttempts: 3,
      rateLimitBackoffMs: 0,
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "rateLimit");
    assert.match(result.error, /rate limit/i);
    assert.equal(getLogsCalls, 3);
  });

  it("shrinks too-many-results through 32 then 16", async () => {
    const windows: number[] = [];
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as RpcBody;
      if (body.method === "eth_blockNumber") {
        return jsonRes({ jsonrpc: "2.0", id: 1, result: TIP });
      }
      const w = logsWindow(body.params);
      windows.push(w);
      if (w > 16) {
        return jsonRes({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32602, message: "query returned more than 10000 results" },
        });
      }
      return jsonRes({ jsonrpc: "2.0", id: 1, result: [SAMPLE_LOG] });
    }) as typeof fetch;

    const result = await fetchPublicRecentLogs({
      https: "https://example.invalid/rpc",
      topics: ["0x01"],
      windowBlocks: 900,
      rateLimitBackoffMs: 0,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(windows, [900, 512, 128, 64, 32, 16]);
    assert.equal(result.windowBlocks, 16);
  });
});
