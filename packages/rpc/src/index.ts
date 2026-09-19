/**
 * Client-only RPC helpers for demos1.
 * Never import this from the Cloudflare Worker — browser connects to BlockReq public endpoints.
 */

import { createPublicClient, http, webSocket, isAddress, getAddress, type PublicClient } from "viem";

export const PUBLIC_ENDPOINTS = {
  robinhood: {
    label: "Robinhood",
    chainId: 4663,
    chainIdHex: "0x1237",
    wss: "wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public",
    https: "https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public",
  },
  base: {
    label: "Base",
    chainId: 8453,
    chainIdHex: "0x2105",
    wss: "wss://base-rpc.blockreq.com/v1/rpc/public",
    https: "https://base-rpc.blockreq.com/v1/rpc/public",
  },
  /** BNB Smart Chain — live BlockReq public HTTPS/WSS (docs). */
  bsc: {
    label: "BSC",
    chainId: 56,
    chainIdHex: "0x38",
    wss: "wss://bsc-rpc.blockreq.com/v1/rpc/public",
    https: "https://bsc-rpc.blockreq.com/v1/rpc/public",
  },
  /** Arbitrum One — live BlockReq public HTTPS/WSS (docs). */
  arbitrum: {
    label: "Arbitrum One",
    chainId: 42161,
    chainIdHex: "0xa4b1",
    wss: "wss://arbitrum-one-rpc.blockreq.com/v1/rpc/public",
    https: "https://arbitrum-one-rpc.blockreq.com/v1/rpc/public",
  },
  /**
   * Arc Mainnet day-1 prep — BlockReq Arc public HTTPS/WSS ship later (host 522).
   * Empty placeholders so demos1 UI can pre-wire Factory subs; fill when live.
   */
  arc: {
    label: "Arc",
    chainId: 0,
    chainIdHex: "0x0",
    wss: "",
    https: "",
  },
  /**
   * Solana — BlockReq Solana public is offline (EVM-only now).
   * Empty SOLANA_HTTPS/WSS placeholders only. Never hardcode a live *.blockreq.com Solana public URL.
   */
  solana: {
    label: "Solana",
    chainId: 0,
    chainIdHex: "0x0",
    wss: "",
    https: "",
  },
  /**
   * Monad Mainnet day-0 prep — BlockReq Monad public HTTPS/WSS ship later (like Arc).
   * Empty placeholders so demos1 UI can pre-wire Factory subs; fill when live.
   * chainId 143 (0x8f) per official Monad mainnet table.
   */
  monad: {
    label: "Monad",
    chainId: 143,
    chainIdHex: "0x8f",
    wss: "",
    https: "",
  },
  ethereum: {
    label: "Ethereum",
    chainId: 1,
    chainIdHex: "0x1",
    wss: "wss://ethereum-rpc.blockreq.com/v1/rpc/public",
    https: "https://ethereum-rpc.blockreq.com/v1/rpc/public",
  },
  cronos: {
    label: "Cronos",
    chainId: 25,
    chainIdHex: "0x19",
    wss: "wss://cronos-rpc.blockreq.com/v1/rpc/public",
    https: "https://cronos-rpc.blockreq.com/v1/rpc/public",
  },
} as const;

export type PublicEndpointKey = keyof typeof PUBLIC_ENDPOINTS;

/** Coerce pasted HTTPS RPC URLs to WSS so the browser can subscribe. */
export function normalizePublicWsUrl(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (u.startsWith("https://")) return `wss://${u.slice("https://".length)}`;
  if (u.startsWith("http://")) return `ws://${u.slice("http://".length)}`;
  if (u.startsWith("wss://") || u.startsWith("ws://")) return u;
  return `wss://${u.replace(/^\/+/, "")}`;
}

/** Coerce pasted WSS URLs to HTTPS for eth_getLogs / eth_blockNumber. */
export function normalizePublicHttpUrl(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (u.startsWith("wss://")) return `https://${u.slice("wss://".length)}`;
  if (u.startsWith("ws://")) return `http://${u.slice("ws://".length)}`;
  if (u.startsWith("https://") || u.startsWith("http://")) return u;
  return `https://${u.replace(/^\/+/, "")}`;
}

/** Assert we are in a browser (demos must not run RPC on the Worker). */
export function assertBrowserOnly(label = "@blockreq/rpc") {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") {
    throw new Error(`${label}: browser-only — do not call from Worker/server`);
  }
}

export function shortAddr(a?: string | null) {
  if (!a || a.length < 10) return a || "?";
  // Feel baseline: 0xabc…def (3 + 3 after 0x)
  return a.slice(0, 5) + "…" + a.slice(-3);
}

export function unpadTopic(topic?: string) {
  if (!topic || topic.length < 42) return "";
  return ("0x" + topic.slice(-40)).toLowerCase();
}

export function wordAddr(data: string | undefined, i: number) {
  if (!data || data.length < 2 + (i + 1) * 64) return "";
  return ("0x" + data.slice(2 + i * 64 + 24, 2 + (i + 1) * 64)).toLowerCase();
}

export function wordU256(data: string | undefined, i: number) {
  if (!data || data.length < 2 + (i + 1) * 64) return 0n;
  return BigInt("0x" + data.slice(2 + i * 64, 2 + (i + 1) * 64));
}

export function isAddr(a?: string) {
  return !!a && isAddress(a, { strict: false });
}

export function checksumAddr(a: string) {
  return getAddress(a);
}

/** Optional viem HTTPS public client (browser only). Prefer WSS subscribe for demos. */
export function createBrowserHttpClient(key: PublicEndpointKey): PublicClient {
  assertBrowserOnly("createBrowserHttpClient");
  const ep = PUBLIC_ENDPOINTS[key];
  return createPublicClient({
    transport: http(ep.https),
  });
}

/** Optional viem WSS public client (browser only). */
export function createBrowserWsClient(key: PublicEndpointKey): PublicClient {
  assertBrowserOnly("createBrowserWsClient");
  const ep = PUBLIC_ENDPOINTS[key];
  return createPublicClient({
    transport: webSocket(ep.wss),
  });
}

export type JsonRpcLog = {
  address?: string;
  topics?: string[];
  data?: string;
  blockNumber?: string;
  transactionHash?: string;
  logIndex?: string | number;
};

/** One topic position: exact hash, OR-list, or null (any). */
export type LogsTopic = string | string[] | null | undefined;

export type JsonRpcReceipt = {
  status?: string;
  blockNumber?: string;
  transactionHash?: string;
  logs?: JsonRpcLog[];
};

function normalizeTopicPos(t: LogsTopic): string | string[] | null {
  if (t == null || t === "") return null;
  if (Array.isArray(t)) {
    const xs = t.map((x) => x.trim().toLowerCase()).filter(Boolean);
    return xs.length ? xs : null;
  }
  return t.trim().toLowerCase();
}

/**
 * Thin browser WebSocket JSON-RPC helper for eth_subscribe logs.
 * Connections always originate in the visitor browser to BlockReq public WSS.
 */
export class BrowserPublicWs {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private backoffMs = 1000;
  private wantRun = false;
  private url: string;

  onOpen?: () => void;
  onClose?: () => void;
  onError?: (msg: string) => void;
  onSubscriptionId?: (id: string) => void;
  onRpcError?: (message: string) => void;
  onLog?: (log: JsonRpcLog) => void;

  constructor(url: string) {
    assertBrowserOnly("BrowserPublicWs");
    this.url = normalizePublicWsUrl(url);
  }

  start() {
    this.wantRun = true;
    this.connect();
  }

  stop() {
    this.wantRun = false;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }

  send(method: string, params: unknown[]) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const id = this.nextId++;
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  }

  private connect() {
    if (!this.wantRun) return;
    const url = normalizePublicWsUrl(this.url);
    if (!url) {
      this.onError?.("empty wss");
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.onError?.(e instanceof Error ? e.message : String(e));
      if (!this.wantRun) return;
      window.setTimeout(() => this.connect(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, 30000);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.backoffMs = 1000;
      this.onOpen?.();
    };
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.id && typeof msg.result === "string") {
        this.onSubscriptionId?.(msg.result);
        return;
      }
      if (msg.id && msg.error) {
        const err = msg.error as { message?: string };
        this.onRpcError?.(err.message || JSON.stringify(msg.error));
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      if (msg.method !== "eth_subscription") return;
      const params = msg.params as { result?: JsonRpcLog } | undefined;
      const r = params?.result;
      if (!r || !r.transactionHash) return;
      this.onLog?.(r);
    };
    ws.onclose = () => {
      this.onClose?.();
      if (!this.wantRun) return;
      window.setTimeout(() => this.connect(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, 30000);
    };
    ws.onerror = () => {
      this.onError?.("WebSocket error — retrying…");
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }
}

/** Public Free endpoints only serve recent blocks (~1024). Stay under that. */
export const PUBLIC_GETLOGS_MAX_BLOCKS = 1024;
/** Safe default window — tip can move between eth_blockNumber and eth_getLogs. */
export const PUBLIC_GETLOGS_SAFE_WINDOW = 900;
/**
 * Known-safe eth_getLogs lookback on busy public BSC (Pancake-volume factories).
 * Probe: W=64 can succeed where 900-block windows + rate-limit fail immediately.
 */
export const PUBLIC_GETLOGS_BSC_SAFE_WINDOW = 64;
/** Smallest shrink step before giving up (900→512→128→64→32→16). */
export const PUBLIC_GETLOGS_MIN_WINDOW = 16;

/** Total eth_getLogs attempts per window on JSON-RPC -32005 / rate-limit. */
export const RATE_LIMIT_MAX_ATTEMPTS = 3;
/** Short backoff between rate-limit retries. */
export const RATE_LIMIT_BACKOFF_MS = 400;

/** Optional chain hint so callers can start at a tighter public window. */
export type PublicLogsChainHint = "bsc";

export type RecentLogsOk = {
  ok: true;
  logs: JsonRpcLog[];
  fromBlock: number;
  toBlock: number;
  windowBlocks: number;
};

export type RecentLogsErr = {
  ok: false;
  error: string;
  /** Machine-ish reason for UI empty-state copy */
  reason: "window" | "rpc" | "empty" | "browser" | "rateLimit";
};

export type RecentLogsResult = RecentLogsOk | RecentLogsErr;

async function jsonRpc<T>(
  https: string,
  method: string,
  params: unknown[],
  signal?: AbortSignal
): Promise<{ result?: T; error?: { message?: string; code?: number } }> {
  const res = await fetch(https, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  });
  if (!res.ok) {
    return { error: { message: `HTTP ${res.status}`, code: res.status } };
  }
  return (await res.json()) as { result?: T; error?: { message?: string; code?: number } };
}

/** JSON-RPC -32005 / HTTP 429 / "Rate limit reached" — retry, do not shrink. */
export function isRateLimitRpcError(code?: number, message?: string): boolean {
  if (code === -32005 || code === 429) return true;
  const msg = message || "";
  return /rate\s*limit|ratelimit|too many requests|\b429\b/i.test(msg);
}

/**
 * Archive / 1024-block / "too many results" / response-size / query-limit —
 * shrink the lookback window and retry.
 */
export function isWindowLimitRpcError(code?: number, message?: string): boolean {
  if (code === -32014) return true;
  const msg = message || "";
  return /1024|recent blocks|archive|cannot serve this request|too many (?:results|logs)|query returned more than|response size|query (?:timeout|limit)|block range|try with this block range|eth_getLogs is limited|exceed(?:s|ed)?(?: max)? (?:query |result )?limit|more than \d+ (?:results|logs)/i.test(
    msg
  );
}

export function classifyLogRpcError(
  code?: number,
  message?: string
): "rateLimit" | "window" | "rpc" {
  if (isRateLimitRpcError(code, message)) return "rateLimit";
  if (isWindowLimitRpcError(code, message)) return "window";
  return "rpc";
}

/** Shrink ladder: 900→512→128→64→32→16. */
export function nextGetLogsWindow(windowBlocks: number): number {
  if (windowBlocks > 512) return 512;
  if (windowBlocks > 128) return 128;
  if (windowBlocks > 64) return 64;
  if (windowBlocks > 32) return 32;
  if (windowBlocks > PUBLIC_GETLOGS_MIN_WINDOW) return PUBLIC_GETLOGS_MIN_WINDOW;
  return 0;
}

export function initialGetLogsWindow(opts: {
  windowBlocks?: number;
  chainHint?: PublicLogsChainHint;
}): number {
  const fallback =
    opts.chainHint === "bsc" ? PUBLIC_GETLOGS_BSC_SAFE_WINDOW : PUBLIC_GETLOGS_SAFE_WINDOW;
  return Math.max(1, Math.min(opts.windowBlocks ?? fallback, PUBLIC_GETLOGS_SAFE_WINDOW));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    if (!signal) return;
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export type RateLimitRetryInfo = {
  attempt: number;
  maxAttempts: number;
  windowBlocks: number;
};

/**
 * Browser-only eth_getLogs against BlockReq public HTTPS.
 * Respects the public ~1024-block recent window (no Worker proxy).
 * Rate-limit (-32005) retries with short backoff; result-size errors shrink the window.
 */
export async function fetchPublicRecentLogs(opts: {
  https: string;
  address?: string;
  topics: LogsTopic[];
  /** Blocks to look back; clamped to PUBLIC_GETLOGS_SAFE_WINDOW */
  windowBlocks?: number;
  /** `bsc` starts at PUBLIC_GETLOGS_BSC_SAFE_WINDOW unless windowBlocks is set. */
  chainHint?: PublicLogsChainHint;
  signal?: AbortSignal;
  /** Total attempts per window on rate-limit (default RATE_LIMIT_MAX_ATTEMPTS). */
  rateLimitAttempts?: number;
  /** Backoff between rate-limit retries (default RATE_LIMIT_BACKOFF_MS). */
  rateLimitBackoffMs?: number;
  /** Fired before sleeping for a rate-limit retry (UI: 限流重试中). */
  onRateLimitRetry?: (info: RateLimitRetryInfo) => void;
}): Promise<RecentLogsResult> {
  try {
    assertBrowserOnly("fetchPublicRecentLogs");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), reason: "browser" };
  }

  const https = normalizePublicHttpUrl(opts.https);
  if (!https) {
    return { ok: false, error: "empty https", reason: "rpc" };
  }

  let windowBlocks = initialGetLogsWindow(opts);
  const maxRateAttempts = Math.max(1, opts.rateLimitAttempts ?? RATE_LIMIT_MAX_ATTEMPTS);
  const backoffMs = opts.rateLimitBackoffMs ?? RATE_LIMIT_BACKOFF_MS;
  let tipRateAttempts = 0;
  let logsRateAttempts = 0;

  while (true) {
    if (opts.signal?.aborted) {
      return { ok: false, error: "aborted", reason: "rpc" };
    }

    const tipRes = await jsonRpc<string>(https, "eth_blockNumber", [], opts.signal);
    if (opts.signal?.aborted) {
      return { ok: false, error: "aborted", reason: "rpc" };
    }
    if (tipRes.error || !tipRes.result) {
      const tipMsg = tipRes.error?.message || "eth_blockNumber failed";
      const tipKind = classifyLogRpcError(tipRes.error?.code, tipMsg);
      if (tipKind === "rateLimit" && tipRateAttempts + 1 < maxRateAttempts) {
        tipRateAttempts += 1;
        opts.onRateLimitRetry?.({
          attempt: tipRateAttempts,
          maxAttempts: maxRateAttempts,
          windowBlocks,
        });
        try {
          await sleep(backoffMs, opts.signal);
        } catch {
          return { ok: false, error: "aborted", reason: "rpc" };
        }
        continue;
      }
      return {
        ok: false,
        error: tipMsg,
        reason: tipKind === "rateLimit" ? "rateLimit" : "rpc",
      };
    }

    const toBlock = parseInt(tipRes.result, 16);
    const fromBlock = Math.max(0, toBlock - windowBlocks);
    const filter: {
      fromBlock: string;
      toBlock: string;
      topics: (string | string[] | null)[];
      address?: string;
    } = {
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
      topics: opts.topics.map((t) => normalizeTopicPos(t)),
    };
    if (opts.address && isAddress(opts.address, { strict: false })) {
      filter.address = opts.address.toLowerCase();
    }

    const logsRes = await jsonRpc<JsonRpcLog[]>(https, "eth_getLogs", [filter], opts.signal);
    if (opts.signal?.aborted) {
      return { ok: false, error: "aborted", reason: "rpc" };
    }
    if (logsRes.error) {
      const msg = logsRes.error.message || JSON.stringify(logsRes.error);
      const kind = classifyLogRpcError(logsRes.error.code, msg);
      if (kind === "rateLimit") {
        if (logsRateAttempts + 1 < maxRateAttempts) {
          logsRateAttempts += 1;
          opts.onRateLimitRetry?.({
            attempt: logsRateAttempts,
            maxAttempts: maxRateAttempts,
            windowBlocks,
          });
          try {
            await sleep(backoffMs, opts.signal);
          } catch {
            return { ok: false, error: "aborted", reason: "rpc" };
          }
          continue;
        }
        return { ok: false, error: msg, reason: "rateLimit" };
      }
      if (kind === "window") {
        const nextWindow = nextGetLogsWindow(windowBlocks);
        if (nextWindow) {
          windowBlocks = nextWindow;
          logsRateAttempts = 0;
          tipRateAttempts = 0;
          continue;
        }
        return { ok: false, error: msg, reason: "window" };
      }
      return { ok: false, error: msg, reason: "rpc" };
    }

    const logs = Array.isArray(logsRes.result) ? logsRes.result : [];
    if (logs.length === 0) {
      return {
        ok: true,
        logs: [],
        fromBlock,
        toBlock,
        windowBlocks,
      };
    }

    // Newest first
    const sorted = [...logs].sort((a, b) => {
      const ba = a.blockNumber ? parseInt(String(a.blockNumber), 16) : 0;
      const bb = b.blockNumber ? parseInt(String(b.blockNumber), 16) : 0;
      if (bb !== ba) return bb - ba;
      const la = typeof a.logIndex === "string" ? parseInt(a.logIndex, 16) : Number(a.logIndex || 0);
      const lb = typeof b.logIndex === "string" ? parseInt(b.logIndex, 16) : Number(b.logIndex || 0);
      return lb - la;
    });

    return {
      ok: true,
      logs: sorted,
      fromBlock,
      toBlock,
      windowBlocks,
    };
  }
}

/**
 * Browser-only eth_getTransactionReceipt against BlockReq public HTTPS.
 */
export async function fetchPublicTxReceipt(opts: {
  https: string;
  txHash: string;
  signal?: AbortSignal;
}): Promise<JsonRpcReceipt | null> {
  try {
    assertBrowserOnly("fetchPublicTxReceipt");
  } catch {
    return null;
  }
  const tx = opts.txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(tx)) return null;
  const res = await fetch(opts.https, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [tx],
    }),
    signal: opts.signal,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    result?: JsonRpcReceipt | null;
    error?: { message?: string };
  };
  if (json.error || !json.result) return null;
  return json.result;
}
