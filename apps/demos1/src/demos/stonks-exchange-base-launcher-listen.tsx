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
import { isAddr, shortAddr, unpadTopic, type JsonRpcLog } from "@blockreq/rpc";
import { decodeEventLog, parseAbiItem, type Hex } from "viem";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointConfigSlot } from "../components/endpoint-config-slot";
import { Addr } from "../components/addr";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildStonksExchangeBaseLauncherFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Verified StonkLauncher2 factory proxy (Base) — MUST prefill. NOT BaseStonk. */
const DEFAULT_FACTORY = "0x4714f6EC81639Ca59EEBE634490a4d8671DCe7B4";
/** TokenLaunched(address indexed token, uint256 indexed tokenId, address indexed creator, address quote, address pool, uint24 fee, int24 launchTick, uint256 totalSupply, address feeLocker) */
const DEFAULT_TOKEN_LAUNCHED_TOPIC0 =
  "0x61f1eebe27442a95a99d94de30c81be127888456287e5bd9fbb5a6105e1aaad3";
/** Optional TokenMetaSet(address indexed token, address indexed creator, string image, string banner, string description, string website, string twitter, string telegram) */
const DEFAULT_TOKEN_META_SET_TOPIC0 =
  "0xe955341eaabea23fe2bbd1074b7cce8c1b283cfb10fa0ae061f932c977ddbcd7";
/** Optional DevBuy(address indexed token, address indexed creator, uint256 quoteSpent, uint256 tokensOut) */
const DEFAULT_DEV_BUY_TOPIC0 =
  "0x84d429ed8af1c9cfe8bb07b556e4120e976c9f4c9232a7f50a15d31d83e232a9";

/** Hint chips (read-only / paste refs) — verified Stonks Exchange desk */
const HINT_IMPL = "0x6a9f14e7742e8972fcf86429c5aa7db56589806d";
const HINT_QUOTE_REGISTRY = "0x4db9F13325A83662cf992184bc070755a212e95B";
const HINT_FEE_LOCKER = "0x71D1D363176723f85d98B8B430DF33cde89f0A7f";
/** Canonical Base WETH — verified as quote on sample TokenLaunched */
const QUOTE_WETH = "0x4200000000000000000000000000000000000006";
/** Basecat quote — verified on sample TokenLaunched 0x0f6c917e… */
const QUOTE_BASECAT = "0xb200000000000000000000d9192b6b456483c2e8";
const SAMPLE_TX_META =
  "0x72d2abe9fef721127c6c5301ee2b8f93d70c3738c9d30f0a5ff60e84955e910a";
const SAMPLE_TX_BASECAT =
  "0x0f6c917e0c3f7bd2be07d5d1e431691f75177f43287be8b5a87523f5ae67b36d";
const HOT_POST_URL = "https://x.com/Stonks_Exchange/status/2100204805738090962";
const SITE_STONKS = "https://thestonks.exchange/";

const LS = "blockreq.stonks-exchange-base-launcher.";
const SLUG = "stonks-exchange-base-launcher-listen";

const TOKEN_LAUNCHED_ABI = parseAbiItem(
  "event TokenLaunched(address indexed token, uint256 indexed tokenId, address indexed creator, address quote, address pool, uint24 fee, int24 launchTick, uint256 totalSupply, address feeLocker)"
);

const TOKEN_META_SET_ABI = parseAbiItem(
  "event TokenMetaSet(address indexed token, address indexed creator, string image, string banner, string description, string website, string twitter, string telegram)"
);

const DEV_BUY_ABI = parseAbiItem(
  "event DevBuy(address indexed token, address indexed creator, uint256 quoteSpent, uint256 tokensOut)"
);

const QUOTE_LABELS: Record<string, string> = {
  [QUOTE_WETH.toLowerCase()]: "WETH",
  [QUOTE_BASECAT.toLowerCase()]: "BASECAT",
};

type LaunchCard = {
  pad: "stonks-exchange";
  token: string;
  tokenId: string;
  creator: string;
  quote: string;
  pool: string;
  fee: string;
  launchTick: string;
  totalSupply: string;
  feeLocker: string;
  launchTx: string;
  blockNumber: number;
  ts: number;
  image?: string;
  description?: string;
  website?: string;
  quoteSpent?: string;
  tokensOut?: string;
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

function quoteLabel(quote: string) {
  return QUOTE_LABELS[quote.toLowerCase()] || shortAddr(quote);
}

function feePct(fee: string) {
  try {
    const n = Number(fee);
    if (!Number.isFinite(n)) return fee;
    return `${n / 10_000}%`;
  } catch {
    return fee;
  }
}

function compactSupply(v: string) {
  try {
    const n = BigInt(v);
    const whole = n / 10n ** 18n;
    return whole.toString();
  } catch {
    return v;
  }
}

function decodeTokenLaunched(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [TOKEN_LAUNCHED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      tokenId?: bigint;
      creator?: string;
      quote?: string;
      pool?: string;
      fee?: number | bigint;
      launchTick?: number | bigint;
      totalSupply?: bigint;
      feeLocker?: string;
    };
    return {
      token: (args.token || unpadTopic(topics[1]) || "").toLowerCase(),
      tokenId: args.tokenId != null ? args.tokenId.toString() : "",
      creator: (args.creator || unpadTopic(topics[3]) || "").toLowerCase(),
      quote: (args.quote || "").toLowerCase(),
      pool: (args.pool || "").toLowerCase(),
      fee: args.fee != null ? String(args.fee) : "",
      launchTick: args.launchTick != null ? String(args.launchTick) : "",
      totalSupply: args.totalSupply != null ? args.totalSupply.toString() : "",
      feeLocker: (args.feeLocker || "").toLowerCase(),
    };
  } catch {
    return {
      token: unpadTopic(topics[1]),
      tokenId: topics[2] ? String(BigInt(topics[2])) : "",
      creator: unpadTopic(topics[3]),
      quote: "",
      pool: "",
      fee: "",
      launchTick: "",
      totalSupply: "",
      feeLocker: "",
    };
  }
}

function decodeTokenMetaSet(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [TOKEN_META_SET_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      creator?: string;
      image?: string;
      banner?: string;
      description?: string;
      website?: string;
      twitter?: string;
      telegram?: string;
    };
    return {
      token: (args.token || unpadTopic(topics[1]) || "").toLowerCase(),
      creator: (args.creator || unpadTopic(topics[2]) || "").toLowerCase(),
      image: args.image || "",
      banner: args.banner || "",
      description: args.description || "",
      website: args.website || "",
      twitter: args.twitter || "",
      telegram: args.telegram || "",
    };
  } catch {
    return {
      token: unpadTopic(topics[1]),
      creator: unpadTopic(topics[2]),
      image: "",
      banner: "",
      description: "",
      website: "",
      twitter: "",
      telegram: "",
    };
  }
}

function decodeDevBuy(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [DEV_BUY_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      creator?: string;
      quoteSpent?: bigint;
      tokensOut?: bigint;
    };
    return {
      token: (args.token || unpadTopic(topics[1]) || "").toLowerCase(),
      creator: (args.creator || unpadTopic(topics[2]) || "").toLowerCase(),
      quoteSpent: args.quoteSpent != null ? args.quoteSpent.toString() : "",
      tokensOut: args.tokensOut != null ? args.tokensOut.toString() : "",
    };
  } catch {
    return {
      token: unpadTopic(topics[1]),
      creator: unpadTopic(topics[2]),
      quoteSpent: "",
      tokensOut: "",
    };
  }
}

function mapTokenLaunchedLogs(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const decoded = decodeTokenLaunched(log as unknown as Record<string, unknown>);
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    const q = quoteLabel(decoded.quote);
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: L(locale, "Recent TokenLaunched", "历史 TokenLaunched"),
      tags: ["HIST", "BASE", "STONKS", "TOKENLAUNCHED", "pad:stonks-exchange", "RADAR"],
      title: shortAddr(decoded.token) || "—",
      body: `pad:stonks-exchange · token ${shortAddr(decoded.token)} · tokenId ${decoded.tokenId || "—"} · creator ${shortAddr(decoded.creator)} · quote ${q} ${shortAddr(decoded.quote)} · pool ${shortAddr(decoded.pool)} · fee ${decoded.fee || "—"} · launchTick ${decoded.launchTick || "—"} · totalSupply ${compactSupply(decoded.totalSupply) || "—"} · feeLocker ${shortAddr(decoded.feeLocker)} · #${bn}`,
      address: decoded.token || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "BASE",
      at: now - i * 400,
      metric: q,
      metricLabel: L(locale, "quote", "报价"),
      metric2: decoded.fee ? feePct(decoded.fee) : `#${bn}`,
      metric2Label: decoded.fee ? L(locale, "fee", "费率") : L(locale, "Block", "区块"),
      highlight: decoded.quote.toLowerCase() === QUOTE_BASECAT.toLowerCase(),
      links: log.transactionHash
        ? [
            { label: "thestonks.exchange", href: SITE_STONKS },
            { label: "BaseScan", href: basescanTxUrl(log.transactionHash) },
          ]
        : [{ label: "thestonks.exchange", href: SITE_STONKS }],
    };
  });
}

/**
 * Stonks Exchange (thestonks.exchange) StonkLauncher2 listen — TokenLaunched primary
 * (+ optional TokenMetaSet / DevBuy). Layout: launch-feed AnonStream (flashy open-card radar).
 * endpointKey: base — BlockReq Base public only. Distinct from BaseStonk AdvancedLauncherV2.
 */
export function StonksExchangeBaseLauncherListenDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [tokenLaunchedTopic, setTokenLaunchedTopic] = useState(DEFAULT_TOKEN_LAUNCHED_TOPIC0);
  const [tokenMetaSetTopic, setTokenMetaSetTopic] = useState(DEFAULT_TOKEN_META_SET_TOPIC0);
  const [devBuyTopic, setDevBuyTopic] = useState(DEFAULT_DEV_BUY_TOPIC0);
  const [subMeta, setSubMeta] = useState(true);
  const [subDevBuy, setSubDevBuy] = useState(true);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits();
  const ep = useEditableEndpoints(SLUG, "base");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildStonksExchangeBaseLauncherFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || DEFAULT_FACTORY,
    topics: [tokenLaunchedTopic.trim() || DEFAULT_TOKEN_LAUNCHED_TOPIC0],
    map: (logs) => mapTokenLaunchedLogs(logs, locale),
    enabled: isAddr(factory.trim() || DEFAULT_FACTORY) && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launchDedup = useRef(new Set<string>());
  const metaByToken = useRef(new Map<string, { image: string; description: string; website: string }>());
  const devBuyByToken = useRef(new Map<string, { quoteSpent: string; tokensOut: string }>());
  const fields = useRef({
    factory,
    tokenLaunchedTopic,
    tokenMetaSetTopic,
    devBuyTopic,
    subMeta,
    subDevBuy,
  });
  fields.current = {
    factory,
    tokenLaunchedTopic,
    tokenMetaSetTopic,
    devBuyTopic,
    subMeta,
    subDevBuy,
  };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildStonksExchangeBaseLauncherFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const fn = localStorage.getItem(LS + "factory");
      const tp = localStorage.getItem(LS + "tokenLaunchedTopic");
      const mt = localStorage.getItem(LS + "tokenMetaSetTopic");
      const dt = localStorage.getItem(LS + "devBuyTopic");
      const sm = localStorage.getItem(LS + "subMeta");
      const sd = localStorage.getItem(LS + "subDevBuy");
      if (fn) setFactory(fn);
      if (tp) setTokenLaunchedTopic(tp);
      if (mt) setTokenMetaSetTopic(mt);
      if (dt) setDevBuyTopic(dt);
      if (sm != null) setSubMeta(sm === "1" || sm === "true");
      if (sd != null) setSubDevBuy(sd === "1" || sd === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim() || DEFAULT_FACTORY);
      localStorage.setItem(
        LS + "tokenLaunchedTopic",
        fields.current.tokenLaunchedTopic.trim() || DEFAULT_TOKEN_LAUNCHED_TOPIC0
      );
      localStorage.setItem(
        LS + "tokenMetaSetTopic",
        fields.current.tokenMetaSetTopic.trim() || DEFAULT_TOKEN_META_SET_TOPIC0
      );
      localStorage.setItem(LS + "devBuyTopic", fields.current.devBuyTopic.trim() || DEFAULT_DEV_BUY_TOPIC0);
      localStorage.setItem(LS + "subMeta", fields.current.subMeta ? "1" : "0");
      localStorage.setItem(LS + "subDevBuy", fields.current.subDevBuy ? "1" : "0");
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
      const q = quoteLabel(card.quote);
      const metaBits =
        card.image || card.website || card.description
          ? ` · image ${card.image ? "yes" : "—"} · website ${card.website || "—"}`
          : "";
      const buyBits =
        card.quoteSpent || card.tokensOut
          ? ` · quoteSpent ${card.quoteSpent || "—"} · tokensOut ${compactSupply(card.tokensOut || "") || "—"}`
          : "";
      const links: { label: string; href: string }[] = [
        { label: "thestonks.exchange", href: SITE_STONKS },
      ];
      if (card.launchTx) links.push({ label: "BaseScan", href: basescanTxUrl(card.launchTx) });
      if (card.quote.toLowerCase() === QUOTE_BASECAT.toLowerCase()) {
        links.push({
          label: L(locale, "Hot post · Basecat listed as quote", "热点 · Basecat 已加报价"),
          href: HOT_POST_URL,
        });
      }
      pushEvent({
        kind: L(locale, "Stonks Exchange TokenLaunched", "Stonks Exchange TokenLaunched"),
        tags: [
          "NEW",
          "BASE",
          "STONKS",
          "TOKENLAUNCHED",
          `pad:${card.pad}`,
          "RADAR",
          q,
          ...extraTags,
        ],
        title: shortAddr(card.token) || "—",
        body: `pad:${card.pad} · token ${shortAddr(card.token)} · tokenId ${card.tokenId || "—"} · creator ${shortAddr(card.creator)} · quote ${q} ${shortAddr(card.quote)} · pool ${shortAddr(card.pool)} · fee ${card.fee || "—"} · launchTick ${card.launchTick || "—"} · totalSupply ${compactSupply(card.totalSupply) || "—"} · feeLocker ${shortAddr(card.feeLocker)} · launchTx ${shortAddr(card.launchTx)} · #${card.blockNumber}${metaBits}${buyBits}`,
        address: card.token || undefined,
        block: card.blockNumber,
        tx: card.launchTx || undefined,
        chain: "BASE",
        metric: q,
        metricLabel: L(locale, "quote", "报价"),
        metric2: card.fee ? feePct(card.fee) : `#${card.blockNumber}`,
        metric2Label: card.fee ? L(locale, "fee", "费率") : L(locale, "Block", "区块"),
        highlight: card.quote.toLowerCase() === QUOTE_BASECAT.toLowerCase(),
        links,
        at: card.ts,
      });
    },
    [locale, pushEvent]
  );

  const onTokenLaunched = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeTokenLaunched(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      const meta = metaByToken.current.get(decoded.token.toLowerCase());
      const buy = devBuyByToken.current.get(decoded.token.toLowerCase());
      emitLaunch(
        {
          pad: "stonks-exchange",
          token: decoded.token.toLowerCase(),
          tokenId: decoded.tokenId,
          creator: (decoded.creator || "").toLowerCase(),
          quote: (decoded.quote || "").toLowerCase(),
          pool: (decoded.pool || "").toLowerCase(),
          fee: decoded.fee,
          launchTick: decoded.launchTick,
          totalSupply: decoded.totalSupply,
          feeLocker: (decoded.feeLocker || "").toLowerCase(),
          launchTx: tx,
          blockNumber: bn,
          ts: Date.now(),
          image: meta?.image,
          description: meta?.description,
          website: meta?.website,
          quoteSpent: buy?.quoteSpent,
          tokensOut: buy?.tokensOut,
        },
        ["SNIPER", "OPEN"]
      );
    },
    [emitLaunch]
  );

  const onTokenMetaSet = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeTokenMetaSet(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `meta:${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      metaByToken.current.set(decoded.token.toLowerCase(), {
        image: decoded.image,
        description: decoded.description,
        website: decoded.website,
      });
      pushEvent({
        kind: L(locale, "Stonks Exchange TokenMetaSet", "Stonks Exchange TokenMetaSet"),
        tags: ["NEW", "BASE", "STONKS", "TOKENMETASET", "pad:stonks-exchange", "META"],
        title: shortAddr(decoded.token) || "—",
        body: `pad:stonks-exchange · token ${shortAddr(decoded.token)} · creator ${shortAddr(decoded.creator)} · website ${decoded.website || "—"} · twitter ${decoded.twitter || "—"} · telegram ${decoded.telegram || "—"} · tx ${shortAddr(tx)} · #${bn}`,
        address: decoded.token,
        block: bn,
        tx: tx || undefined,
        chain: "BASE",
        metric: decoded.website ? "web" : "meta",
        metricLabel: "meta",
        metric2: `#${bn}`,
        metric2Label: L(locale, "Block", "区块"),
        links: tx
          ? [
              { label: "thestonks.exchange", href: SITE_STONKS },
              { label: "BaseScan", href: basescanTxUrl(tx) },
            ]
          : [{ label: "thestonks.exchange", href: SITE_STONKS }],
      });
    },
    [locale, pushEvent]
  );

  const onDevBuy = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeDevBuy(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `dev:${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      devBuyByToken.current.set(decoded.token.toLowerCase(), {
        quoteSpent: decoded.quoteSpent,
        tokensOut: decoded.tokensOut,
      });
      pushEvent({
        kind: L(locale, "Stonks Exchange DevBuy", "Stonks Exchange DevBuy"),
        tags: ["NEW", "BASE", "STONKS", "DEVBUY", "pad:stonks-exchange", "DEVBUY"],
        title: shortAddr(decoded.token) || "—",
        body: `pad:stonks-exchange · token ${shortAddr(decoded.token)} · creator ${shortAddr(decoded.creator)} · quoteSpent ${decoded.quoteSpent || "—"} · tokensOut ${compactSupply(decoded.tokensOut) || "—"} · tx ${shortAddr(tx)} · #${bn}`,
        address: decoded.token,
        block: bn,
        tx: tx || undefined,
        chain: "BASE",
        metric: compactSupply(decoded.tokensOut) || "devbuy",
        metricLabel: "tokensOut",
        metric2: `#${bn}`,
        metric2Label: L(locale, "Block", "区块"),
        links: tx
          ? [
              { label: "thestonks.exchange", href: SITE_STONKS },
              { label: "BaseScan", href: basescanTxUrl(tx) },
            ]
          : [{ label: "thestonks.exchange", href: SITE_STONKS }],
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
      const launchT = (fields.current.tokenLaunchedTopic.trim() || DEFAULT_TOKEN_LAUNCHED_TOPIC0).toLowerCase();
      const metaT = (fields.current.tokenMetaSetTopic.trim() || DEFAULT_TOKEN_META_SET_TOPIC0).toLowerCase();
      const buyT = (fields.current.devBuyTopic.trim() || DEFAULT_DEV_BUY_TOPIC0).toLowerCase();
      if (t0 === launchT) return onTokenLaunched(r);
      if (fields.current.subMeta && t0 === metaT) return onTokenMetaSet(r);
      if (fields.current.subDevBuy && t0 === buyT) return onDevBuy(r);
    },
    [onTokenLaunched, onTokenMetaSet, onDevBuy]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const addr = (fields.current.factory.trim() || DEFAULT_FACTORY).toLowerCase();
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
    const lt = (fields.current.tokenLaunchedTopic.trim() || DEFAULT_TOKEN_LAUNCHED_TOPIC0).toLowerCase();
    if (!isTopic0(lt)) {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("error");
      return;
    }
    send("eth_subscribe", ["logs", { address: addr, topics: [lt] }]);
    if (fields.current.subMeta) {
      const mt = (fields.current.tokenMetaSetTopic.trim() || DEFAULT_TOKEN_META_SET_TOPIC0).toLowerCase();
      if (isTopic0(mt)) send("eth_subscribe", ["logs", { address: addr, topics: [mt] }]);
    }
    if (fields.current.subDevBuy) {
      const dt = (fields.current.devBuyTopic.trim() || DEFAULT_DEV_BUY_TOPIC0).toLowerCase();
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
    const addr = (fields.current.factory.trim() || DEFAULT_FACTORY).toLowerCase();
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
    { label: "FACTORY", value: factory || DEFAULT_FACTORY, mono: true },
    {
      label: "TOKEN_LAUNCHED_TOPIC0",
      value: tokenLaunchedTopic || DEFAULT_TOKEN_LAUNCHED_TOPIC0,
      mono: true,
    },
    {
      label: "TOKEN_META_SET_TOPIC0",
      value: subMeta ? shortAddr(tokenMetaSetTopic || DEFAULT_TOKEN_META_SET_TOPIC0) : L(locale, "off", "关闭"),
      mono: true,
    },
    {
      label: "DEV_BUY_TOPIC0",
      value: subDevBuy ? shortAddr(devBuyTopic || DEFAULT_DEV_BUY_TOPIC0) : L(locale, "off", "关闭"),
      mono: true,
    },
    { label: "PAD", value: "stonks-exchange", mono: true },
  ];
  const sourceItems = [
    { k: L(locale, "SRC", "源"), v: "Stonks Exchange / StonkLauncher2 TokenLaunched" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "stonks-exchange-base-launcher-listen" },
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
            <CardTitle>
              {L(locale, "Stonks Exchange · TokenLaunched", "Stonks Exchange · TokenLaunched")}
            </CardTitle>
            <CardDescription>{t(locale, "stonks.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sx-factory">FACTORY / StonkLauncher2</Label>
              <Input
                id="sx-factory"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sx-topic">TOKEN_LAUNCHED_TOPIC0</Label>
              <Input
                id="sx-topic"
                value={tokenLaunchedTopic}
                onChange={(e) => setTokenLaunchedTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <label className="inline-flex items-center gap-2 border border-[rgba(0,240,255,0.22)] bg-[rgba(0,240,255,0.04)] px-2.5 py-2 text-sm text-[var(--color-foreground)]">
              <input
                type="checkbox"
                checked={subMeta}
                onChange={(e) => {
                  setSubMeta(e.target.checked);
                  persistFlag("subMeta", e.target.checked);
                  reconnectIfRunning();
                }}
                className="h-4 w-4"
              />
              {L(locale, "Optional TokenMetaSet topic0 chip", "可选 TokenMetaSet topic0 芯片")}
            </label>
            {subMeta ? (
              <div className="space-y-1.5">
                <Label htmlFor="sx-meta">TOKEN_META_SET_TOPIC0</Label>
                <Input
                  id="sx-meta"
                  value={tokenMetaSetTopic}
                  onChange={(e) => setTokenMetaSetTopic(e.target.value)}
                  onBlur={saveFields}
                  spellCheck={false}
                />
              </div>
            ) : null}
            <label className="inline-flex items-center gap-2 border border-[rgba(0,240,255,0.22)] bg-[rgba(0,240,255,0.04)] px-2.5 py-2 text-sm text-[var(--color-foreground)]">
              <input
                type="checkbox"
                checked={subDevBuy}
                onChange={(e) => {
                  setSubDevBuy(e.target.checked);
                  persistFlag("subDevBuy", e.target.checked);
                  reconnectIfRunning();
                }}
                className="h-4 w-4"
              />
              {L(locale, "Optional DevBuy topic0 chip", "可选 DevBuy topic0 芯片")}
            </label>
            {subDevBuy ? (
              <div className="space-y-1.5">
                <Label htmlFor="sx-devbuy">DEV_BUY_TOPIC0</Label>
                <Input
                  id="sx-devbuy"
                  value={devBuyTopic}
                  onChange={(e) => setDevBuyTopic(e.target.value)}
                  onBlur={saveFields}
                  spellCheck={false}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {hintChip("IMPL", HINT_IMPL)}
              {hintChip("QUOTE_REG", HINT_QUOTE_REGISTRY)}
              {hintChip("FEE_LOCKER", HINT_FEE_LOCKER)}
              {hintChip("WETH", QUOTE_WETH)}
              {hintChip("BASECAT", QUOTE_BASECAT, HOT_POST_URL)}
              {hintChip("TX_META", SAMPLE_TX_META, basescanTxUrl(SAMPLE_TX_META))}
              {hintChip("TX_CAT", SAMPLE_TX_BASECAT, basescanTxUrl(SAMPLE_TX_BASECAT))}
              {hintChip("HOT", HOT_POST_URL, HOT_POST_URL)}
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {L(
                locale,
                "Hint chips read-only / paste · click to copy. Stonks Exchange StonkLauncher2",
                "提示芯片只读/可粘贴 · 点复制。Stonks Exchange StonkLauncher2"
              )}
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
        title={t(locale, "stonks.title")}
        tag={t(locale, "stonks.tag")}
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
        guide={t(locale, "stonks.guide")}
        watching={t(locale, "stonks.watching")}
        hint={t(locale, "stonks.hint")}
        emptyTitle={t(locale, "stonks.emptyTitle")}
        emptySub={t(locale, "stonks.emptySub")}
        latestLabel={t(locale, "stonks.latest")}
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
