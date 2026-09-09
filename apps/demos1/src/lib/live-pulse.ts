import { useEffect, useState } from "react";

/** Dense HTTPS tip poll while live — keeps 「刚刚 / Ns 前」 honest when logs are quiet. */
export const TIP_POLL_MS = 3_000;

/**
 * Browser-only eth_blockNumber heartbeat against BlockReq public HTTPS.
 * Prefer WSS newHeads when available; this is the dense poll fallback.
 * Worker never proxies — fetch originates in the visitor browser.
 */
export function useTipHeartbeat(opts: {
  https: string;
  enabled: boolean;
  intervalMs?: number;
}) {
  const [tipAt, setTipAt] = useState<number | null>(null);
  const [tipBlock, setTipBlock] = useState<number | null>(null);

  useEffect(() => {
    if (!opts.enabled || !opts.https) {
      return;
    }
    if (typeof window === "undefined") return;

    let cancelled = false;
    const interval = opts.intervalMs ?? TIP_POLL_MS;

    const tick = async () => {
      try {
        const res = await fetch(opts.https, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: [],
          }),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { result?: string };
        if (!json.result || cancelled) return;
        const bn = parseInt(json.result, 16);
        if (!Number.isFinite(bn)) return;
        setTipBlock(bn);
        // Successful tip read = live link still moving — stamp real lastUpdate.
        setTipAt(Date.now());
      } catch {
        /* ignore transient public RPC blips; WSS reconnect handles transport */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), interval);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [opts.enabled, opts.https, opts.intervalMs]);

  return { tipAt, tipBlock };
}

/** eth_subscription newHeads payload (no transactionHash). */
export function isNewHeadsResult(
  r: Record<string, unknown> | undefined | null
): boolean {
  if (!r) return false;
  if (r.transactionHash) return false;
  return typeof r.number === "string" || typeof r.hash === "string";
}

/** Resolve live freshness stamp — never fall back to seed/demo rows. */
export function resolveLiveUpdateAt(opts: {
  lastPulseAt?: number | null;
  tipAt?: number | null;
  listeningSince?: number | null;
  running: boolean;
}): number | null {
  return (
    opts.lastPulseAt ||
    opts.tipAt ||
    (opts.running ? opts.listeningSince || null : null) ||
    null
  );
}
