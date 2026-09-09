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
} as const;

export type PublicEndpointKey = keyof typeof PUBLIC_ENDPOINTS;

/** Assert we are in a browser (demos must not run RPC on the Worker). */
export function assertBrowserOnly(label = "@blockreq/rpc") {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") {
    throw new Error(`${label}: browser-only — do not call from Worker/server`);
  }
}

export function shortAddr(a?: string | null) {
  if (!a || a.length < 10) return a || "?";
  return a.slice(0, 8) + "…" + a.slice(-4);
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
    this.url = url;
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
    const ws = new WebSocket(this.url);
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
