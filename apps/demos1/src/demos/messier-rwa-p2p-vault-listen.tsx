import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { t, demoBlogUrl, demoSiteUrl, type Locale } from "@blockreq/i18n";
import {
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type ConnStatus,
} from "@blockreq/ui";
import {
  fetchPublicTxReceipt,
  isAddr,
  shortAddr,
  unpadTopic,
  wordU256,
  type JsonRpcLog,
  type JsonRpcReceipt,
} from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import { scrubDemoText, type FeedEvent } from "../components/feed-types";
import { EndpointConfigSlot } from "../components/endpoint-config-slot";
import { Addr } from "../components/addr";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildMessierRwaP2pVaultFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory, type HistoryState } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Verified Messier P2P vault (Base) — MUST prefill */
const DEFAULT_VAULT = "0xa5E09fBCaB81B2F501262035A9721f98532BD16B";
/** VaultDeposit topic0 (verified) */
const DEFAULT_DEPOSIT_TOPIC0 =
  "0x3d0d944abc617505cc2ee0f898da5889c7d5781acc1743eb254382a632eab422";
/** VaultWithdraw topic0 (verified) */
const DEFAULT_WITHDRAW_TOPIC0 =
  "0x3fd22dd00d8a168bf393904be2f8f2857fda82ecb0cbe6559f6aa357f2418d40";
/** ERC-20 Transfer(address,address,uint256) */
const TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Verified $RWA — highlight when sibling Transfer token matches */
const TOKEN_RWA = "0xE2B1dc2D4A3b4E59FDF0c47B71A7A86391a8B35a";
/** Verified USDC on Base — optional filter only */
const TOKEN_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
/** Messier pool UI (deep link) */
const MESSIER_POOL_URL = "https://p2p.messier.app/pools?network=BASE&s=RWA_USDC";
/** Optional Aerodrome RWA/USDC — DEX chart chip only, NOT a listen target */
const HINT_AERODROME = "0x60d1cebd97a6168516f35982d499cdf8a452abb3";
const SAMPLE_DEPOSIT_TX = "0xd8b19b0d666858eed6d9eb5fdda9f194a8e21c1f9808391c93b4e009347e06d4";
const SAMPLE_WITHDRAW_TX = "0x1ba4dc5bf46a6816d1447751d4bbcb5de9c5f483f75b9fce62255539c6a2e3a1";

const LS = "blockreq.messier-rwa-p2p-vault.";
const SLUG = "messier-rwa-p2p-vault-listen";
const HISTORY_RECEIPT_CAP = 16;

const DECIMALS: Record<string, number> = {
  [TOKEN_RWA.toLowerCase()]: 18,
  [TOKEN_USDC.toLowerCase()]: 6,
};

type VaultSide = "lock" | "release";

type VaultCard = {
  pad: "messier-p2p";
  side: VaultSide;
  token: string;
  amount: string;
  maker: string;
  highlight: boolean;
  txHash: string;
  blockNumber: number;
  messierPoolUrl: string;
  basescanUrl: string;
  ts: number;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function isTopic0(v: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(v.trim());
}

function basescanTxUrl(tx: string) {
  return `https://basescan.org/tx/${tx}`;
}

function tokenLabel(addr: string) {
  const a = addr.toLowerCase();
  if (a === TOKEN_RWA.toLowerCase()) return "$RWA";
  if (a === TOKEN_USDC.toLowerCase()) return "USDC";
  return shortAddr(addr);
}

function formatTokenAmount(raw: bigint, decimals: number): string {
  if (raw < 0n) raw = -raw;
  const base = 10n ** BigInt(Math.max(0, decimals));
  const whole = raw / base;
  const frac = raw % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 8);
  return `${whole}.${fracStr}`;
}

function sideFromTopic0(t0: string, depositT: string, withdrawT: string): VaultSide | null {
  const x = t0.toLowerCase();
  if (x === depositT.toLowerCase()) return "lock";
  if (x === withdrawT.toLowerCase()) return "release";
  return null;
}

type SiblingXfer = {
  token: string;
  amountRaw: bigint;
  maker: string;
  from: string;
  to: string;
};

function siblingTransfers(receipt: JsonRpcReceipt | null, vault: string): SiblingXfer[] {
  const vaultLc = vault.toLowerCase();
  const logs = receipt?.logs || [];
  const out: SiblingXfer[] = [];
  for (const log of logs) {
    const topics = log.topics || [];
    const t0 = String(topics[0] || "").toLowerCase();
    if (t0 !== TOPIC_TRANSFER) continue;
    const from = unpadTopic(topics[1]);
    const to = unpadTopic(topics[2]);
    if (from !== vaultLc && to !== vaultLc) continue;
    const token = String(log.address || "").toLowerCase();
    if (!token) continue;
    out.push({
      token,
      amountRaw: wordU256(log.data, 0),
      maker: (from === vaultLc ? to : from) || "",
      from,
      to,
    });
  }
  return out;
}

function pickSibling(
  xfers: SiblingXfer[],
  side: VaultSide,
  usdcOnly: boolean,
  vault: string
): SiblingXfer | null {
  if (!xfers.length) return null;
  const rwa = TOKEN_RWA.toLowerCase();
  const usdc = TOKEN_USDC.toLowerCase();
  const vaultLc = vault.toLowerCase();
  if (usdcOnly) {
    return xfers.find((x) => x.token === usdc) || null;
  }
  const rwaHit = xfers.find((x) => x.token === rwa);
  if (rwaHit) return rwaHit;
  const dir =
    side === "lock"
      ? xfers.filter((x) => x.to === vaultLc)
      : xfers.filter((x) => x.from === vaultLc);
  const pool = dir.length ? dir : xfers;
  return [...pool].sort((a, b) => (a.amountRaw < b.amountRaw ? 1 : -1))[0] || null;
}

function cardToFeed(
  card: VaultCard,
  locale: Locale,
  live: boolean
): Omit<FeedEvent, "id"> & { id?: string } {
  const sideZh = card.side === "lock" ? "锁仓" : "释放";
  const sideEn = card.side === "lock" ? "LOCK" : "RELEASE";
  const sideLabel = locale === "zh" ? sideZh : sideEn;
  const tok = tokenLabel(card.token);
  const kind =
    locale === "zh"
      ? card.side === "lock"
        ? "Messier VaultDeposit 锁仓"
        : "Messier VaultWithdraw 释放"
      : card.side === "lock"
        ? "Messier VaultDeposit"
        : "Messier VaultWithdraw";
  const rawKind = live ? kind : locale === "zh" ? `历史 ${sideZh}` : `Recent ${card.side === "lock" ? "VaultDeposit" : "VaultWithdraw"}`;
  const rawTitle = `${tok} ${sideLabel}`;
  const rawBody = `pad:${card.pad} · side ${card.side} · token ${tok} ${card.token} · amount ${card.amount} · maker ${shortAddr(card.maker)} · highlight ${card.highlight ? "yes" : "no"} · tx ${shortAddr(card.txHash)} · #${card.blockNumber} · ${card.messierPoolUrl} · ${card.basescanUrl}`;
  return {
    kind: scrubDemoText(rawKind),
    tags: [
      live ? "NEW" : "HIST",
      "BASE",
      "MESSIER",
      card.side === "lock" ? "VAULTDEPOSIT" : "VAULTWITHDRAW",
      `pad:${card.pad}`,
      card.highlight ? "RWA" : "TOKEN",
      "RADAR",
      card.side.toUpperCase(),
    ],
    title: scrubDemoText(rawTitle),
    body: scrubDemoText(rawBody),
    address: card.token || undefined,
    block: card.blockNumber,
    tx: card.txHash || undefined,
    chain: "BASE",
    metric: card.amount || "—",
    metricLabel: tok,
    metric2: sideLabel,
    metric2Label: locale === "zh" ? "方向" : "side",
    highlight: card.highlight,
    links: [
      { label: t(locale, "messier.poolLink"), href: card.messierPoolUrl },
      { label: t(locale, "messier.scanLink"), href: card.basescanUrl },
    ],
    at: card.ts,
  };
}

function mapVaultLogsBare(logs: JsonRpcLog[], locale: Locale, depositT: string, withdrawT: string): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const t0 = String((log.topics || [])[0] || "");
    const side = sideFromTopic0(t0, depositT, withdrawT) || "lock";
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    const tx = String(log.transactionHash || "");
    const card: VaultCard = {
      pad: "messier-p2p",
      side,
      token: "",
      amount: "—",
      maker: "",
      highlight: false,
      txHash: tx,
      blockNumber: bn,
      messierPoolUrl: MESSIER_POOL_URL,
      basescanUrl: tx ? basescanTxUrl(tx) : MESSIER_POOL_URL,
      ts: now - i * 400,
    };
    return { id: `hist-${tx}-${log.logIndex}-${i}`, ...cardToFeed(card, locale, false) };
  });
}

/**
 * Messier P2P vault listen — VaultDeposit / VaultWithdraw + receipt sibling Transfer.
 * Layout: launch-feed AnonStream (flashy lock/release radar). RPC collapsed secondary.
 * endpointKey: base — BlockReq Base public only.
 */
export function MessierRwaP2pVaultListenDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [vault, setVault] = useState(DEFAULT_VAULT);
  const [depositTopic, setDepositTopic] = useState(DEFAULT_DEPOSIT_TOPIC0);
  const [withdrawTopic, setWithdrawTopic] = useState(DEFAULT_WITHDRAW_TOPIC0);
  const [usdcOnly, setUsdcOnly] = useState(false);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "base");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildMessierRwaP2pVaultFixtures(locale, 5), [locale]);
  const vaultAddr = vault.trim() || DEFAULT_VAULT;
  const depT = depositTopic.trim() || DEFAULT_DEPOSIT_TOPIC0;
  const wdT = withdrawTopic.trim() || DEFAULT_WITHDRAW_TOPIC0;
  const rawHistory = useRecentHistory({
    locale,
    https: ep.https,
    address: vaultAddr,
    topics: [[depT, wdT]],
    map: (logs) => mapVaultLogsBare(logs, locale, depT, wdT),
    enabled: isAddr(vaultAddr) && !!ep.https && isTopic0(depT) && isTopic0(wdT),
  });
  const [history, setHistory] = useState<HistoryState>(rawHistory);

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const vaultDedup = useRef(new Set<string>());
  const inflight = useRef(new Set<string>());
  const fields = useRef({
    vault,
    depositTopic,
    withdrawTopic,
    usdcOnly,
  });
  fields.current = { vault, depositTopic, withdrawTopic, usdcOnly };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildMessierRwaP2pVaultFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS + "vault");
      const d = localStorage.getItem(LS + "depositTopic");
      const w = localStorage.getItem(LS + "withdrawTopic");
      const u = localStorage.getItem(LS + "usdcOnly");
      if (v) setVault(v);
      if (d) setDepositTopic(d);
      if (w) setWithdrawTopic(w);
      if (u != null) setUsdcOnly(u === "1" || u === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "vault", fields.current.vault.trim() || DEFAULT_VAULT);
      localStorage.setItem(
        LS + "depositTopic",
        fields.current.depositTopic.trim() || DEFAULT_DEPOSIT_TOPIC0
      );
      localStorage.setItem(
        LS + "withdrawTopic",
        fields.current.withdrawTopic.trim() || DEFAULT_WITHDRAW_TOPIC0
      );
      localStorage.setItem(LS + "usdcOnly", fields.current.usdcOnly ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const send = (method: string, params: unknown[]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const id = nextId.current++;
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  };

  const emitCard = useCallback(
    (card: VaultCard) => {
      pushEvent(cardToFeed(card, locale, true));
    },
    [locale, pushEvent]
  );

  const buildCardFromLog = useCallback(
    async (r: Record<string, unknown>, signal?: AbortSignal): Promise<VaultCard | null> => {
      const t0 = String(((r.topics as string[]) || [])[0] || "");
      const dep = fields.current.depositTopic.trim() || DEFAULT_DEPOSIT_TOPIC0;
      const wd = fields.current.withdrawTopic.trim() || DEFAULT_WITHDRAW_TOPIC0;
      const side = sideFromTopic0(t0, dep, wd);
      if (!side) return null;
      const tx = String(r.transactionHash || "");
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const vaultAddrNow = (fields.current.vault.trim() || DEFAULT_VAULT).toLowerCase();
      const usdcOnlyNow = fields.current.usdcOnly;
      let xfers: SiblingXfer[] = [];
      if (tx) {
        const receipt = await fetchPublicTxReceipt({
          https: epRef.current.https,
          txHash: tx,
          signal,
        });
        xfers = siblingTransfers(receipt, vaultAddrNow);
      }
      const picked = pickSibling(xfers, side, usdcOnlyNow, vaultAddrNow);
      if (usdcOnlyNow && (!picked || picked.token !== TOKEN_USDC.toLowerCase())) return null;
      const token = picked?.token || "";
      const highlight = token.toLowerCase() === TOKEN_RWA.toLowerCase();
      const decimals = DECIMALS[token] ?? 18;
      return {
        pad: "messier-p2p",
        side,
        token,
        amount: picked ? formatTokenAmount(picked.amountRaw, decimals) : "—",
        maker: picked?.maker || "",
        highlight,
        txHash: tx,
        blockNumber: bn,
        messierPoolUrl: MESSIER_POOL_URL,
        basescanUrl: tx ? basescanTxUrl(tx) : MESSIER_POOL_URL,
        ts: Date.now(),
      };
    },
    []
  );

  const onVaultLog = useCallback(
    (r: Record<string, unknown>) => {
      const t0 = String(((r.topics as string[]) || [])[0] || "");
      const dep = fields.current.depositTopic.trim() || DEFAULT_DEPOSIT_TOPIC0;
      const wd = fields.current.withdrawTopic.trim() || DEFAULT_WITHDRAW_TOPIC0;
      const side = sideFromTopic0(t0, dep, wd);
      if (!side) return;
      const tx = String(r.transactionHash || "").toLowerCase();
      const dedupeKey = `${side}:${tx}`;
      if (!tx || vaultDedup.current.has(dedupeKey)) return;
      vaultDedup.current.add(dedupeKey);
      if (inflight.current.has(dedupeKey)) return;
      inflight.current.add(dedupeKey);
      void buildCardFromLog(r)
        .then((card) => {
          if (!card) {
            vaultDedup.current.delete(dedupeKey);
            return;
          }
          emitCard(card);
        })
        .catch(() => {
          vaultDedup.current.delete(dedupeKey);
        })
        .finally(() => {
          inflight.current.delete(dedupeKey);
        });
    },
    [buildCardFromLog, emitCard]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      onVaultLog(r);
    },
    [onVaultLog]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const addr = (fields.current.vault.trim() || DEFAULT_VAULT).toLowerCase();
    if (!isAddr(addr)) {
      setStatus("error");
      return;
    }
    const dep = (fields.current.depositTopic.trim() || DEFAULT_DEPOSIT_TOPIC0).toLowerCase();
    const wd = (fields.current.withdrawTopic.trim() || DEFAULT_WITHDRAW_TOPIC0).toLowerCase();
    if (!isTopic0(dep) || !isTopic0(wd)) {
      setStatus("error");
      return;
    }
    send("eth_subscribe", ["logs", { address: addr, topics: [[dep, wd]] }]);
    send("eth_subscribe", ["newHeads"]);
    setStatus("listening");
  }, []);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    setStatus("connecting");
    const ws = new WebSocket(epRef.current.wss);
    wsRef.current = ws;
    ws.onopen = () => {
      backoffMs.current = 1000;
      subscribeAll();
    };
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.id && msg.result && typeof msg.result === "string") return;
      if (msg.id && msg.error) {
        setStatus("error");
        return;
      }
      if (msg.method !== "eth_subscription") return;
      const params = msg.params as { result?: Record<string, unknown> } | undefined;
      const r = params?.result;
      if (isNewHeadsResult(r)) {
        setLastPulseAt(Date.now());
        return;
      }
      if (!r || !r.transactionHash) return;
      onLog(r);
    };
    ws.onclose = () => {
      if (!wantRun.current) {
        setStatus("stopped");
        return;
      }
      setStatus("connecting");
      setTimeout(connect, backoffMs.current);
      backoffMs.current = Math.min(backoffMs.current * 2, 30000);
    };
    ws.onerror = () => {
      setStatus("error");
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [onLog, subscribeAll]);

  const resume = useCallback(() => {
    const addr = (fields.current.vault.trim() || DEFAULT_VAULT).toLowerCase();
    if (!isAddr(addr)) {
      setStatus("idle");
      return;
    }
    wantRun.current = true;
    connect();
  }, [connect]);

  const pause = useCallback(() => {
    wantRun.current = false;
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    setStatus("stopped");
  }, []);

  const reconnectIfRunning = useCallback(() => {
    if (!wantRun.current) return;
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    connect();
  }, [connect]);

  const onSelectCard = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  useEffect(() => {
    resume();
    return () => {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (rawHistory.status !== "ready" || rawHistory.events.length === 0) {
      setHistory(rawHistory);
      return;
    }
    const ac = new AbortController();
    (async () => {
      const slice = rawHistory.events.slice(0, HISTORY_RECEIPT_CAP);
      const enriched: FeedEvent[] = [];
      for (const ev of slice) {
        if (cancelled) return;
        const tx = ev.tx || "";
        const side: VaultSide = ev.tags.includes("VAULTWITHDRAW") ? "release" : "lock";
        const receipt = tx
          ? await fetchPublicTxReceipt({ https: ep.https, txHash: tx, signal: ac.signal })
          : null;
        const xfers = siblingTransfers(receipt, vaultAddr);
        const picked = pickSibling(xfers, side, usdcOnly, vaultAddr);
        if (usdcOnly && (!picked || picked.token !== TOKEN_USDC.toLowerCase())) continue;
        const token = picked?.token || ev.address || "";
        const highlight = token.toLowerCase() === TOKEN_RWA.toLowerCase();
        const decimals = DECIMALS[token.toLowerCase()] ?? 18;
        const card: VaultCard = {
          pad: "messier-p2p",
          side,
          token,
          amount: picked ? formatTokenAmount(picked.amountRaw, decimals) : "—",
          maker: picked?.maker || "",
          highlight,
          txHash: tx,
          blockNumber: ev.block || 0,
          messierPoolUrl: MESSIER_POOL_URL,
          basescanUrl: tx ? basescanTxUrl(tx) : MESSIER_POOL_URL,
          ts: ev.at,
        };
        enriched.push({ id: ev.id, ...cardToFeed(card, locale, false) });
      }
      if (cancelled) return;
      setHistory({
        ...rawHistory,
        events: enriched.length ? enriched : rawHistory.events,
      });
    })().catch(() => {
      if (!cancelled) setHistory(rawHistory);
    });
    return () => {
      cancelled = true;
      ac.abort();
    };
    }, [rawHistory, locale, ep.https, vaultAddr, usdcOnly]);

  const running = status === "connecting" || status === "listening";
  const watchParams = [
    { label: "VAULT", value: vault || DEFAULT_VAULT, mono: true },
    {
      label: "VAULTDEPOSIT_TOPIC0",
      value: depositTopic || DEFAULT_DEPOSIT_TOPIC0,
      mono: true,
    },
    {
      label: "VAULTWITHDRAW_TOPIC0",
      value: withdrawTopic || DEFAULT_WITHDRAW_TOPIC0,
      mono: true,
    },
    { label: "PAD", value: "messier-p2p", mono: true },
    {
      label: "USDC",
      value: usdcOnly ? (locale === "zh" ? "仅 USDC" : "only") : locale === "zh" ? "关闭" : "off",
      mono: true,
    },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "Messier P2P / VaultDeposit + VaultWithdraw" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "vault-listen" },
    { k: "WSS", v: ep.wss },
    { k: "HTTPS", v: ep.https },
  ];

  useEffect(() => {
    if (status === "listening" || status === "hit") {
      setListeningSince((prev) => prev ?? Date.now());
    } else if (status === "idle" || status === "stopped" || status === "error") {
      setListeningSince(null);
    }
  }, [status]);

  useEffect(() => {
    if (events[0]?.at) setLastPulseAt(events[0].at);
  }, [events]);

  const runningLive = status === "connecting" || status === "listening" || status === "hit";
  const { tipAt } = useTipHeartbeat({ https: ep.https, enabled: runningLive });

  const hintChip = (label: string, addr: string, href?: string) => (
    <button
      key={label}
      type="button"
      className="inline-flex items-center gap-1.5 border border-[rgba(0,240,255,0.22)] bg-[rgba(0,240,255,0.04)] px-2 py-1 font-mono text-[10px] text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.45)] hover:text-[var(--color-neon-cyan)]"
      title={addr}
      onClick={() => {
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        void navigator.clipboard?.writeText(addr);
      }}
    >
      <span className="font-bold uppercase tracking-[0.06em] text-[var(--color-neon-cyan)]">{label}</span>
      <Addr value={addr} />
    </button>
  );

  const settings = (
    <div className="space-y-3">
      <button
        type="button"
        className="w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-left font-mono text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.35)]"
        onClick={() => setShowSettings((v) => !v)}
      >
        {t(locale, "common.settings")}
      </button>
      <SettingsPanel open={showSettings}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              {locale === "zh" ? "Messier P2P · 金库锁仓雷达" : "Messier P2P · vault lock radar"}
            </CardTitle>
            <CardDescription>{t(locale, "messier.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ms-vault">VAULT</Label>
              <Input
                id="ms-vault"
                value={vault}
                onChange={(e) => setVault(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-deposit">VAULTDEPOSIT_TOPIC0</Label>
              <Input
                id="ms-deposit"
                value={depositTopic}
                onChange={(e) => setDepositTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-withdraw">VAULTWITHDRAW_TOPIC0</Label>
              <Input
                id="ms-withdraw"
                value={withdrawTopic}
                onChange={(e) => setWithdrawTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <label className="inline-flex items-center gap-2 border border-[rgba(0,240,255,0.22)] bg-[rgba(0,240,255,0.04)] px-2.5 py-2 text-sm text-[var(--color-foreground)]">
              <input
                type="checkbox"
                checked={usdcOnly}
                onChange={(e) => {
                  setUsdcOnly(e.target.checked);
                  try {
                    localStorage.setItem(LS + "usdcOnly", e.target.checked ? "1" : "0");
                  } catch {
                    /* ignore */
                  }
                }}
                className="h-4 w-4"
              />
              {t(locale, "messier.usdcFilter")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {hintChip("$RWA", TOKEN_RWA)}
              {hintChip("USDC", TOKEN_USDC)}
              {hintChip("POOL", MESSIER_POOL_URL, MESSIER_POOL_URL)}
              {hintChip("DEP_TX", SAMPLE_DEPOSIT_TX, basescanTxUrl(SAMPLE_DEPOSIT_TX))}
              {hintChip("WD_TX", SAMPLE_WITHDRAW_TX, basescanTxUrl(SAMPLE_WITHDRAW_TX))}
              {hintChip("AERO", HINT_AERODROME, `https://basescan.org/address/${HINT_AERODROME}`)}
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {locale === "zh"
                ? "提示芯片只读/可粘贴 · 池与交易点开。Aerodrome RWA/USDC 仅 DEX 图芯片，不是主监听。"
                : "Hint chips read-only / paste · pool & txs open. Aerodrome RWA/USDC is a DEX chart chip only — not the primary listen."}
            </p>
            <label className="inline-flex items-center gap-2 border border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.06)] px-2.5 py-2 text-sm text-[var(--color-warn)]">
              <input
                type="checkbox"
                checked={demoHits}
                onChange={(e) => setDemoHits(e.target.checked)}
                className="h-4 w-4"
              />
              {t(locale, "demoHits.toggle")}
            </label>
            <p className="break-all font-mono text-[11px] text-[var(--color-muted-foreground)]">
              {ep.wss} · {ep.chainIdHex}
            </p>
          </CardContent>
        </Card>
      </SettingsPanel>
    </div>
  );

  const lastUpdateAt = resolveLiveUpdateAt({
    lastPulseAt,
    tipAt,
    listeningSince,
    running: runningLive,
  });

  return (
    <div className="flex min-h-screen flex-col pb-24" data-layout="launch-feed">
      <MonitorChrome
        lastUpdateAt={lastUpdateAt}
        locale={locale}
        onLocaleChange={onLocaleChange}
        localeMode={onLocaleChange ? "catalog" : "links"}
        title={t(locale, "messier.title")}
        tag={t(locale, "messier.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
        blogUrl={demoBlogUrl(SLUG, locale)}
        siteUrl={demoSiteUrl(getDemo(SLUG))}
      />
      <AnonStreamLayout
        locale={locale}
        events={events}
        seedEvents={seedEvents}
        selectedId={selectedId}
        onSelect={onSelectCard}
        onPause={pause}
        onResume={resume}
        running={running}
        connecting={status === "connecting"}
        history={history}
        watchParams={watchParams}
        sourceItems={sourceItems}
        guide={t(locale, "messier.guide")}
        watching={t(locale, "messier.watching")}
        hint={t(locale, "messier.hint")}
        emptyTitle={t(locale, "messier.emptyTitle")}
        emptySub={t(locale, "messier.emptySub")}
        latestLabel={t(locale, "messier.latest")}
        chainBadge="BASE"
        endpointSlot={
          <EndpointConfigSlot
            locale={locale}
            wss={ep.wss}
            https={ep.https}
            chainLabel={ep.label}
            draftWss={ep.draftWss}
            draftHttps={ep.draftHttps}
            dirty={ep.dirty}
            onDraftWss={ep.setWss}
            onDraftHttps={ep.setHttps}
            onApply={() => {
              ep.commit();
              reconnectIfRunning();
            }}
            onReset={() => {
              ep.reset();
              reconnectIfRunning();
            }}
          />
        }
        settings={settings}
        banner={
          <DemoHitsBanner
            locale={locale}
            enabled={demoHits}
            onToggle={setDemoHits}
            onInject={demoHits ? injectDemoHits : undefined}
          />
        }
      />
    </div>
  );
}
