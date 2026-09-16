import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { openPublicWs } from "../lib/public-ws";
import { t, demoBlogUrl, demoSiteUrl, L, type Locale } from "@blockreq/i18n";
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
import { isAddr, shortAddr, wordAddr, wordU256, type JsonRpcLog } from "@blockreq/rpc";
import { decodeEventLog, parseAbiItem, type Hex } from "viem";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointConfigSlot } from "../components/endpoint-config-slot";
import { Addr } from "../components/addr";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildFlapBscPortalTokenCreatedFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Verified Flap Portal factory (BSC) — MUST prefill. */
const DEFAULT_PORTAL = "0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0";
/** TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta) — no indexed fields. */
const DEFAULT_TOKEN_CREATED_TOPIC0 =
  "0x504e7f360b2e5fe33cbaaae4c593bc55305328341bf79009e43e0e3b7f699603";
/** Optional LaunchedToDEX(address token, address pool, uint256 amount, uint256 eth) — no indexed fields. */
const DEFAULT_LAUNCHED_TO_DEX_TOPIC0 =
  "0x6e4f47630b8745b8cacbd44f42a8a33e7eea7cc08ef22fc7630f4f385784ff7d";

/** PancakeSwap V2 factory — hint chip only, not a listen target. */
const HINT_PANCAKE_V2 = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const SAMPLE_TX_CREATED =
  "0xbd7c42cb2f39558c15f9714b34b74c2f70213984a3b564954aa878a4f2ef9fac";
const SAMPLE_TX_DEX =
  "0x3ba8fc6e2be1b747b0094e1df69309c65295355606e3af8c92a5239644b6b1e3";
const HOT_TOKEN = "0xec5b95a544f98430f6b0cfc3d6dd82b61a417777";
const HOT_POST_URL = "https://x.com/bitecong/status/2100281832634003543";
const DOCS_FLAP = "https://docs.flap.sh/flap/developers/deployed-contract-addresses";

const LS = "blockreq.flap-bsc-portal-token-created.";
const SLUG = "flap-bsc-portal-token-created-listen";

const TOKEN_CREATED_ABI = parseAbiItem(
  "event TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta)"
);

const LAUNCHED_TO_DEX_ABI = parseAbiItem(
  "event LaunchedToDEX(address token, address pool, uint256 amount, uint256 eth)"
);

type LaunchCard = {
  pad: "flap";
  token: string;
  creator: string;
  nonce: string;
  name: string;
  symbol: string;
  meta: string;
  ts: number;
  onchainTs: string;
  launchTx: string;
  blockNumber: number;
  pool?: string;
  amount?: string;
  eth?: string;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function isTopic0(v: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(v.trim());
}

function bscscanTxUrl(tx: string) {
  return `https://bscscan.com/tx/${tx}`;
}

function bscscanAddrUrl(addr: string) {
  return `https://bscscan.com/address/${addr}`;
}

function compactWei(v: string) {
  try {
    const n = BigInt(v);
    const whole = n / 10n ** 18n;
    if (whole >= 1_000_000n) return `${(Number(whole) / 1e6).toFixed(2)}M`;
    if (whole >= 1_000n) return `${(Number(whole) / 1e3).toFixed(2)}K`;
    const frac = Number(n) / 1e18;
    if (!Number.isFinite(frac)) return v;
    if (frac >= 1) return frac.toFixed(4);
    if (frac > 0) return frac.toPrecision(3);
    return "0";
  } catch {
    return v;
  }
}

function compactSupply(v: string) {
  try {
    const n = BigInt(v);
    const whole = n / 10n ** 18n;
    if (whole >= 1_000_000n) return `${(Number(whole) / 1e6).toFixed(2)}M`;
    if (whole >= 1_000n) return `${(Number(whole) / 1e3).toFixed(2)}K`;
    return whole.toString();
  } catch {
    return v;
  }
}

function fmtOnchainTs(ts: string) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return ts || "—";
  try {
    return new Date(n * 1000).toISOString().replace(".000Z", "Z");
  } catch {
    return ts;
  }
}

function ipfsHref(meta: string) {
  const cid = meta.trim();
  if (!cid) return "";
  if (/^(bafy|bafk|Qm)[a-zA-Z0-9]+$/.test(cid)) return `https://ipfs.io/ipfs/${cid}`;
  return "";
}

function decodeTokenCreated(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [TOKEN_CREATED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      ts?: bigint;
      creator?: string;
      nonce?: bigint;
      token?: string;
      name?: string;
      symbol?: string;
      meta?: string;
    };
    return {
      ts: args.ts != null ? args.ts.toString() : "",
      creator: (args.creator || "").toLowerCase(),
      nonce: args.nonce != null ? args.nonce.toString() : "",
      token: (args.token || "").toLowerCase(),
      name: args.name || "",
      symbol: args.symbol || "",
      meta: args.meta || "",
    };
  } catch {
    return {
      ts: wordU256(data, 0).toString(),
      creator: wordAddr(data, 1),
      nonce: wordU256(data, 2).toString(),
      token: wordAddr(data, 3),
      name: "",
      symbol: "",
      meta: "",
    };
  }
}

function decodeLaunchedToDex(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [LAUNCHED_TO_DEX_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      pool?: string;
      amount?: bigint;
      eth?: bigint;
    };
    return {
      token: (args.token || "").toLowerCase(),
      pool: (args.pool || "").toLowerCase(),
      amount: args.amount != null ? args.amount.toString() : "",
      eth: args.eth != null ? args.eth.toString() : "",
    };
  } catch {
    return {
      token: wordAddr(data, 0),
      pool: wordAddr(data, 1),
      amount: wordU256(data, 2).toString(),
      eth: wordU256(data, 3).toString(),
    };
  }
}

function mapTokenCreatedLogs(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  const dexT = DEFAULT_LAUNCHED_TO_DEX_TOPIC0.toLowerCase();
  return logs.slice(0, 24).map((log, i) => {
    const t0 = String((log.topics || [])[0] || "").toLowerCase();
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    if (t0 === dexT) {
      const decoded = decodeLaunchedToDex(log as unknown as Record<string, unknown>);
      return {
        id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
        kind: t(locale, "flap.kindHistDex"),
        tags: ["HIST", "BSC", "FLAP", "LAUNCHEDTODEX", "pad:flap", "DEX"],
        title: shortAddr(decoded.token) || "—",
        body: `pad:flap · token ${shortAddr(decoded.token)} · pool ${shortAddr(decoded.pool)} · amount ${compactSupply(decoded.amount) || "—"} · eth ${compactWei(decoded.eth) || "—"} BNB · #${bn}`,
        address: decoded.token || undefined,
        block: bn,
        tx: log.transactionHash,
        chain: "BSC",
        at: now - i * 400,
        metric: compactWei(decoded.eth) || "DEX",
        metricLabel: t(locale, "flap.metricBnb"),
        metric2: `#${bn}`,
        metric2Label: L(locale, "Block", "区块"),
        links: log.transactionHash
          ? [
              { label: t(locale, "flap.docs"), href: DOCS_FLAP },
              { label: t(locale, "flap.bscscan"), href: bscscanTxUrl(log.transactionHash) },
            ]
          : [{ label: t(locale, "flap.docs"), href: DOCS_FLAP }],
      };
    }
    const decoded = decodeTokenCreated(log as unknown as Record<string, unknown>);
    const title = decoded.symbol || decoded.name || shortAddr(decoded.token) || "—";
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: t(locale, "flap.kindHist"),
      tags: ["HIST", "BSC", "FLAP", "TOKENCREATED", "pad:flap", "RADAR"],
      title,
      body: `pad:flap · token ${shortAddr(decoded.token)} · creator ${shortAddr(decoded.creator)} · nonce ${decoded.nonce || "—"} · name ${decoded.name || "—"} · symbol ${decoded.symbol || "—"} · meta ${decoded.meta || "—"} · ts ${fmtOnchainTs(decoded.ts)} · #${bn}`,
      address: decoded.token || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "BSC",
      at: now - i * 400,
      metric: decoded.symbol || shortAddr(decoded.token),
      metricLabel: t(locale, "flap.metricSymbol"),
      metric2: decoded.nonce || `#${bn}`,
      metric2Label: decoded.nonce ? t(locale, "flap.metricNonce") : L(locale, "Block", "区块"),
      links: log.transactionHash
        ? [
            { label: t(locale, "flap.docs"), href: DOCS_FLAP },
            { label: t(locale, "flap.bscscan"), href: bscscanTxUrl(log.transactionHash) },
          ]
        : [{ label: t(locale, "flap.docs"), href: DOCS_FLAP }],
    };
  });
}

/**
 * Flap BSC Portal listen — TokenCreated primary (+ optional LaunchedToDEX).
 * Layout: launch-feed AnonStream (flashy open-card radar).
 * endpointKey: bsc — BlockReq BSC public only. Distinct from brew-bnb PairCreated.
 */
export function FlapBscPortalTokenCreatedListenDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [portal, setPortal] = useState(DEFAULT_PORTAL);
  const [tokenCreatedTopic, setTokenCreatedTopic] = useState(DEFAULT_TOKEN_CREATED_TOPIC0);
  const [launchedToDexTopic, setLaunchedToDexTopic] = useState(DEFAULT_LAUNCHED_TO_DEX_TOPIC0);
  const [subDex, setSubDex] = useState(true);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits();
  const ep = useEditableEndpoints(SLUG, "bsc");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildFlapBscPortalTokenCreatedFixtures(locale, 5), [locale]);
  const historyTopics = useMemo(() => {
    const created = tokenCreatedTopic.trim() || DEFAULT_TOKEN_CREATED_TOPIC0;
    const dex = launchedToDexTopic.trim() || DEFAULT_LAUNCHED_TO_DEX_TOPIC0;
    return subDex && isTopic0(dex) ? [[created, dex]] : [created];
  }, [tokenCreatedTopic, launchedToDexTopic, subDex]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: portal.trim() || DEFAULT_PORTAL,
    topics: historyTopics,
    map: (logs) => mapTokenCreatedLogs(logs, locale),
    enabled: isAddr(portal.trim() || DEFAULT_PORTAL) && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launchDedup = useRef(new Set<string>());
  const fields = useRef({
    portal,
    tokenCreatedTopic,
    launchedToDexTopic,
    subDex,
  });
  fields.current = {
    portal,
    tokenCreatedTopic,
    launchedToDexTopic,
    subDex,
  };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildFlapBscPortalTokenCreatedFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const pn = localStorage.getItem(LS + "portal");
      const tp = localStorage.getItem(LS + "tokenCreatedTopic");
      const dx = localStorage.getItem(LS + "launchedToDexTopic");
      const sd = localStorage.getItem(LS + "subDex");
      if (pn) setPortal(pn);
      if (tp) setTokenCreatedTopic(tp);
      if (dx) setLaunchedToDexTopic(dx);
      if (sd != null) setSubDex(sd === "1" || sd === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "portal", fields.current.portal.trim() || DEFAULT_PORTAL);
      localStorage.setItem(
        LS + "tokenCreatedTopic",
        fields.current.tokenCreatedTopic.trim() || DEFAULT_TOKEN_CREATED_TOPIC0
      );
      localStorage.setItem(
        LS + "launchedToDexTopic",
        fields.current.launchedToDexTopic.trim() || DEFAULT_LAUNCHED_TO_DEX_TOPIC0
      );
      localStorage.setItem(LS + "subDex", fields.current.subDex ? "1" : "0");
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

  const emitLaunch = useCallback(
    (card: LaunchCard, extraTags: string[] = []) => {
      const title = card.symbol || card.name || shortAddr(card.token) || "—";
      const links: { label: string; href: string }[] = [
        { label: t(locale, "flap.docs"), href: DOCS_FLAP },
      ];
      if (card.launchTx) links.push({ label: t(locale, "flap.bscscan"), href: bscscanTxUrl(card.launchTx) });
      if (card.token) links.push({ label: t(locale, "flap.tokenScan"), href: bscscanAddrUrl(card.token) });
      const ipfs = ipfsHref(card.meta);
      if (ipfs) links.push({ label: "IPFS", href: ipfs });
      if (card.token.toLowerCase() === HOT_TOKEN.toLowerCase()) {
        links.push({ label: t(locale, "flap.hotPost"), href: HOT_POST_URL });
      }
      const dexBits =
        card.pool || card.amount || card.eth
          ? ` · pool ${shortAddr(card.pool || "")} · amount ${compactSupply(card.amount || "") || "—"} · eth ${compactWei(card.eth || "") || "—"} BNB`
          : "";
      pushEvent({
        kind: t(locale, "flap.kindCreated"),
        tags: [
          "NEW",
          "BSC",
          "FLAP",
          "TOKENCREATED",
          `pad:${card.pad}`,
          "RADAR",
          card.symbol || "OPEN",
          ...extraTags,
        ],
        title,
        body: `pad:${card.pad} · token ${shortAddr(card.token)} · creator ${shortAddr(card.creator)} · nonce ${card.nonce || "—"} · name ${card.name || "—"} · symbol ${card.symbol || "—"} · meta ${card.meta || "—"} · ts ${fmtOnchainTs(card.onchainTs)} · launchTx ${shortAddr(card.launchTx)} · #${card.blockNumber}${dexBits}`,
        address: card.token || undefined,
        block: card.blockNumber,
        tx: card.launchTx || undefined,
        chain: "BSC",
        metric: card.symbol || shortAddr(card.token),
        metricLabel: t(locale, "flap.metricSymbol"),
        metric2: card.nonce || `#${card.blockNumber}`,
        metric2Label: card.nonce ? t(locale, "flap.metricNonce") : L(locale, "Block", "区块"),
        highlight: card.token.toLowerCase() === HOT_TOKEN.toLowerCase(),
        links,
        at: card.ts,
      });
    },
    [locale, pushEvent]
  );

  const onTokenCreated = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeTokenCreated(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      emitLaunch(
        {
          pad: "flap",
          token: decoded.token.toLowerCase(),
          creator: (decoded.creator || "").toLowerCase(),
          nonce: decoded.nonce,
          name: decoded.name,
          symbol: decoded.symbol,
          meta: decoded.meta,
          ts: Date.now(),
          onchainTs: decoded.ts,
          launchTx: tx,
          blockNumber: bn,
        },
        ["SNIPER", "OPEN"]
      );
    },
    [emitLaunch]
  );

  const onLaunchedToDex = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeLaunchedToDex(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `dex:${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      const links: { label: string; href: string }[] = [
        { label: t(locale, "flap.docs"), href: DOCS_FLAP },
      ];
      if (tx) links.push({ label: t(locale, "flap.bscscan"), href: bscscanTxUrl(tx) });
      if (decoded.pool) links.push({ label: t(locale, "flap.poolScan"), href: bscscanAddrUrl(decoded.pool) });
      pushEvent({
        kind: t(locale, "flap.kindDex"),
        tags: ["NEW", "BSC", "FLAP", "LAUNCHEDTODEX", "pad:flap", "DEX"],
        title: shortAddr(decoded.token) || "—",
        body: `pad:flap · token ${shortAddr(decoded.token)} · pool ${shortAddr(decoded.pool)} · amount ${compactSupply(decoded.amount) || "—"} · eth ${compactWei(decoded.eth) || "—"} BNB · tx ${shortAddr(tx)} · #${bn}`,
        address: decoded.token,
        block: bn,
        tx: tx || undefined,
        chain: "BSC",
        metric: compactWei(decoded.eth) || "DEX",
        metricLabel: t(locale, "flap.metricBnb"),
        metric2: decoded.pool ? shortAddr(decoded.pool) : `#${bn}`,
        metric2Label: decoded.pool ? t(locale, "flap.metricPool") : L(locale, "Block", "区块"),
        highlight: decoded.token.toLowerCase() === HOT_TOKEN.toLowerCase(),
        links,
      });
    },
    [locale, pushEvent]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      const createdT = (fields.current.tokenCreatedTopic.trim() || DEFAULT_TOKEN_CREATED_TOPIC0).toLowerCase();
      const dexT = (fields.current.launchedToDexTopic.trim() || DEFAULT_LAUNCHED_TO_DEX_TOPIC0).toLowerCase();
      if (t0 === createdT) return onTokenCreated(r);
      if (fields.current.subDex && t0 === dexT) return onLaunchedToDex(r);
    },
    [onTokenCreated, onLaunchedToDex]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const addr = (fields.current.portal.trim() || DEFAULT_PORTAL).toLowerCase();
    if (!isAddr(addr)) {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("error");
      return;
    }
    const ct = (fields.current.tokenCreatedTopic.trim() || DEFAULT_TOKEN_CREATED_TOPIC0).toLowerCase();
    if (!isTopic0(ct)) {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("error");
      return;
    }
    send("eth_subscribe", ["logs", { address: addr, topics: [ct] }]);
    if (fields.current.subDex) {
      const dt = (fields.current.launchedToDexTopic.trim() || DEFAULT_LAUNCHED_TO_DEX_TOPIC0).toLowerCase();
      if (isTopic0(dt)) send("eth_subscribe", ["logs", { address: addr, topics: [dt] }]);
    }
    send("eth_subscribe", ["newHeads"]);
  }, []);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    setStatus("connecting");
    const ws = openPublicWs(epRef.current.wss);
    if (!ws) {
      if (!wantRun.current) return;
      setTimeout(connect, backoffMs.current);
      backoffMs.current = Math.min(backoffMs.current * 2, 30000);
      return;
    }
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
      if (msg.id && msg.result && typeof msg.result === "string") {
        setStatus("listening");
        return;
      }
      if (msg.id && msg.error) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
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
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [onLog, subscribeAll]);

  const resume = useCallback(() => {
    const addr = (fields.current.portal.trim() || DEFAULT_PORTAL).toLowerCase();
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

  const running = status === "connecting" || status === "listening";
  const watchParams = [
    { label: "PORTAL", value: portal || DEFAULT_PORTAL, mono: true },
    {
      label: "TOKEN_CREATED_TOPIC0",
      value: tokenCreatedTopic || DEFAULT_TOKEN_CREATED_TOPIC0,
      mono: true,
    },
    {
      label: "LAUNCHED_TO_DEX_TOPIC0",
      value: subDex
        ? shortAddr(launchedToDexTopic || DEFAULT_LAUNCHED_TO_DEX_TOPIC0)
        : t(locale, "flap.off"),
      mono: true,
    },
    { label: "PAD", value: "flap", mono: true },
  ];
  const sourceItems = [
    { k: L(locale, "SRC", "源"), v: "Flap Portal TokenCreated" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "flap-bsc-portal-token-created-listen" },
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

  const persistFlag = (key: string, on: boolean) => {
    try {
      localStorage.setItem(LS + key, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

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
            <CardTitle>{t(locale, "flap.settingsTitle")}</CardTitle>
            <CardDescription>{t(locale, "flap.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="flap-portal">{t(locale, "flap.portalLabel")}</Label>
              <Input
                id="flap-portal"
                value={portal}
                onChange={(e) => setPortal(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="flap-topic">TOKEN_CREATED_TOPIC0</Label>
              <Input
                id="flap-topic"
                value={tokenCreatedTopic}
                onChange={(e) => setTokenCreatedTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <label className="inline-flex items-center gap-2 border border-[rgba(0,240,255,0.22)] bg-[rgba(0,240,255,0.04)] px-2.5 py-2 text-sm text-[var(--color-foreground)]">
              <input
                type="checkbox"
                checked={subDex}
                onChange={(e) => {
                  setSubDex(e.target.checked);
                  persistFlag("subDex", e.target.checked);
                  reconnectIfRunning();
                }}
                className="h-4 w-4"
              />
              {t(locale, "flap.chipDex")}
            </label>
            {subDex ? (
              <div className="space-y-1.5">
                <Label htmlFor="flap-dex">LAUNCHED_TO_DEX_TOPIC0</Label>
                <Input
                  id="flap-dex"
                  value={launchedToDexTopic}
                  onChange={(e) => setLaunchedToDexTopic(e.target.value)}
                  onBlur={saveFields}
                  spellCheck={false}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {hintChip("PANCAKE_V2", HINT_PANCAKE_V2, bscscanAddrUrl(HINT_PANCAKE_V2))}
              {hintChip("HOT_TOKEN", HOT_TOKEN, bscscanAddrUrl(HOT_TOKEN))}
              {hintChip("TX_CREATED", SAMPLE_TX_CREATED, bscscanTxUrl(SAMPLE_TX_CREATED))}
              {hintChip("TX_DEX", SAMPLE_TX_DEX, bscscanTxUrl(SAMPLE_TX_DEX))}
              {hintChip("DOCS", DOCS_FLAP, DOCS_FLAP)}
              {hintChip("HOT", HOT_POST_URL, HOT_POST_URL)}
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {t(locale, "flap.hintNote")}
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
        title={t(locale, "flap.title")}
        tag={t(locale, "flap.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
        blogUrl={demoBlogUrl(SLUG, locale)}
        siteUrl={demoSiteUrl(getDemo(SLUG))}
      />
      <AnonStreamLayout
        locale={locale}
        events={events}
        seedEvents={demoHits ? seedEvents : []}
        selectedId={selectedId}
        onSelect={onSelectCard}
        onPause={pause}
        onResume={resume}
        running={running}
        connecting={status === "connecting"}
        history={history}
        watchParams={watchParams}
        sourceItems={sourceItems}
        guide={t(locale, "flap.guide")}
        watching={t(locale, "flap.watching")}
        hint={t(locale, "flap.hint")}
        emptyTitle={t(locale, "flap.emptyTitle")}
        emptySub={t(locale, "flap.emptySub")}
        latestLabel={t(locale, "flap.latest")}
        chainBadge="BSC"
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
