import { normalizePublicWsUrl } from "@blockreq/rpc";

/**
 * Open BlockReq public WSS from the visitor browser.
 * Normalizes https→wss (pasted RPC URLs) and returns null instead of throwing
 * so callers can backoff-reconnect instead of sticking on 「恢复实时」.
 */
export function openPublicWs(url: string): WebSocket | null {
  const wsUrl = normalizePublicWsUrl(url);
  if (!wsUrl) return null;
  try {
    return new WebSocket(wsUrl);
  } catch {
    return null;
  }
}
