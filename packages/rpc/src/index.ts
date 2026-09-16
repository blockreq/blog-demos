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
  reason: "window" | "rpc" | "empty" | "browser";
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

/**
 * Browser-only eth_getLogs against BlockReq public HTTPS.
 * Respects the public ~1024-block recent window (no Worker proxy).
 */
export async function fetchPublicRecentLogs(opts: {
  https: string;
  address?: string;
  topics: LogsTopic[];
  /** Blocks to look back; clamped to PUBLIC_GETLOGS_SAFE_WINDOW */
  windowBlocks?: number;
  signal?: AbortSignal;
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

  const windowBlocks = Math.max(
    1,
    Math.min(opts.windowBlocks ?? PUBLIC_GETLOGS_SAFE_WINDOW, PUBLIC_GETLOGS_SAFE_WINDOW)
  );

  const tipRes = await jsonRpc<string>(https, "eth_blockNumber", [], opts.signal);
  if (opts.signal?.aborted) {
    return { ok: false, error: "aborted", reason: "rpc" };
  }
  if (tipRes.error || !tipRes.result) {
    return {
      ok: false,
      error: tipRes.error?.message || "eth_blockNumber failed",
      reason: "rpc",
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
    const code = logsRes.error.code;
    const reason =
      /1024|recent blocks|archive|cannot serve this request/i.test(msg) || code === -32014
        ? "window"
        : "rpc";
    // Public Free windows vary by chain (Base ~900, BSC public often ~64).
    const nextWindow =
      windowBlocks > 512 ? 512 : windowBlocks > 128 ? 128 : windowBlocks > 64 ? 64 : 0;
    if (reason === "window" && nextWindow) {
      return fetchPublicRecentLogs({ ...opts, https, windowBlocks: nextWindow });
    }
    return { ok: false, error: msg, reason };
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
