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
import { isAddr, shortAddr, unpadTopic, type JsonRpcLog } from "@blockreq/rpc";
import { decodeEventLog, parseAbiItem, type Hex } from "viem";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointConfigSlot } from "../components/endpoint-config-slot";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildCompanypadRhcFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Verified CompanyPad PAD factory (RH) — MUST prefill */
const DEFAULT_PAD_FACTORY = "0xe7A07A059B9dF760AAdd3F877760d4fbC1d7D193";
/** Launched(address indexed market, bytes32 indexed key, address indexed creator, address curve, uint256 metricId, string ticker, uint64 firstEventAt) */
const DEFAULT_LAUNCHED_TOPIC0 =
  "0x8ef1af4ed9eefbc0fb2f9108f306c0eef37798141ad233ce9bfd344e1b8f756f";
/** Settled(uint256 indexed epoch, int256 value, bool beat, uint256 potSpent, uint64 nextEventAt) — keccak of ABI; editable */
const DEFAULT_SETTLED_TOPIC0 =
  "0x651c3e69fb56971bb76be0a044a853e697260530f267870d6a2581689320a107";

/** Hint chips (read-only / paste refs) */
const HINT_ORACLE = "0x35f8De73DD80FbAF9A04d2BF4484D6b604099649";
const HINT_CURVE_DEPLOYER = "0x372dCf7F2B1121453711f5CB3B27B3650c9e4916";
const HINT_PROJECT_TOKEN = "0x05a70a73a787863d7259abfbcd84452ad2de714a";
const HINT_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const SAMPLE_NVDA_MARKET = "0x094cA423757D96B5334AF5D5386a2105a8B3fCE1";
const SAMPLE_CURVE = "0xffE27a2037faE2001ab3A2045d5B6f979Ba500Ce";

const LS = "blockreq.companypad-rhc-company-market.";
const SLUG = "companypad-rhc-company-market-listen";

const LAUNCHED_ABI = parseAbiItem(
  "event Launched(address indexed market, bytes32 indexed key, address indexed creator, address curve, uint256 metricId, string ticker, uint64 firstEventAt)"
);
const SETTLED_ABI = parseAbiItem(
  "event Settled(uint256 indexed epoch, int256 value, bool beat, uint256 potSpent, uint64 nextEventAt)"
);

type LaunchCard = {
  pad: "companypad";
  market: string;
  key: string;
  creator: string;
  curve: string;
  metricId: string;
  ticker: string;
  firstEventAt: string;
  epoch?: string;
  value?: string;
  beat?: boolean;
  potSpent?: string;
  nextEventAt?: string;
  launchTx: string;
  blockNumber: number;
  ts: number;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function isTopic0(v: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(v.trim());
}

function decodeLaunched(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [LAUNCHED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      market?: string;
      key?: Hex;
      creator?: string;
      curve?: string;
      metricId?: bigint;
      ticker?: string;
      firstEventAt?: bigint | number;
    };
    return {
      market: (args.market || unpadTopic(topics[1]) || "").toLowerCase(),
      key: String(args.key || topics[2] || ""),
      creator: (args.creator || unpadTopic(topics[3]) || "").toLowerCase(),
      curve: (args.curve || "").toLowerCase(),
      metricId: args.metricId != null ? args.metricId.toString() : "",
      ticker: args.ticker || "",
      firstEventAt:
        args.firstEventAt != null ? String(args.firstEventAt) : "",
    };
  } catch {
    return {
      market: unpadTopic(topics[1]),
      key: topics[2] || "",
      creator: unpadTopic(topics[3]),
      curve: "",
      metricId: "",
      ticker: "",
      firstEventAt: "",
    };
  }
}

function decodeSettled(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [SETTLED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      epoch?: bigint;
      value?: bigint;
      beat?: boolean;
      potSpent?: bigint;
      nextEventAt?: bigint | number;
    };
    return {
      epoch: args.epoch != null ? args.epoch.toString() : unpadTopic(topics[1]) || "",
      value: args.value != null ? args.value.toString() : "",
      beat: !!args.beat,
      potSpent: args.potSpent != null ? args.potSpent.toString() : "",
      nextEventAt: args.nextEventAt != null ? String(args.nextEventAt) : "",
    };
  } catch {
    return {
      epoch: topics[1] ? BigInt(topics[1]).toString() : "",
      value: "",
      beat: false,
      potSpent: "",
      nextEventAt: "",
    };
  }
}

function mapLaunchedLogs(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const decoded = decodeLaunched(log as unknown as Record<string, unknown>);
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    const ticker = decoded.ticker || shortAddr(decoded.market);
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: locale === "zh" ? "历史 Launched" : "Recent Launched",
      tags: ["HIST", "RH", "COMPANYPAD", "LAUNCHED", "pad:companypad"],
      title: ticker,
      body: `pad:companypad · ticker ${ticker} · metricId ${decoded.metricId || "—"} · market ${shortAddr(decoded.market)} · creator ${shortAddr(decoded.creator)} · curve ${shortAddr(decoded.curve)} · #${bn}`,
      address: decoded.market || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "RH",
      at: now - i * 400,
      metric: decoded.metricId || shortAddr(decoded.curve),
      metricLabel: "metricId",
      metric2: `#${bn}`,
      metric2Label: locale === "zh" ? "区块" : "Block",
    };
  });
}

/**
 * CompanyPad RHC company-market listen — PAD Launched primary + optional Settled follow.
 * Layout: launch-feed AnonStream (flashy radar / sticky card). RPC collapsed secondary.
 */
export function CompanypadRhcCompanyMarketDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [padFactory, setPadFactory] = useState(DEFAULT_PAD_FACTORY);
  const [launchedTopic, setLaunchedTopic] = useState(DEFAULT_LAUNCHED_TOPIC0);
  const [settledTopic, setSettledTopic] = useState(DEFAULT_SETTLED_TOPIC0);
  const [followMarket, setFollowMarket] = useState("");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "robinhood");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildCompanypadRhcFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: padFactory.trim() || DEFAULT_PAD_FACTORY,
    topics: [launchedTopic.trim() || DEFAULT_LAUNCHED_TOPIC0],
    map: (logs) => mapLaunchedLogs(logs, locale),
    enabled: isAddr(padFactory.trim() || DEFAULT_PAD_FACTORY) && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launchDedup = useRef(new Set<string>());
  const fields = useRef({
    padFactory,
    launchedTopic,
    settledTopic,
    followMarket,
  });
  fields.current = { padFactory, launchedTopic, settledTopic, followMarket };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildCompanypadRhcFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) {
      setSelectedId(fixtures[0].id);
      if (fixtures[0].address) setFollowMarket(fixtures[0].address);
    }
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const pf = localStorage.getItem(LS + "padFactory");
      const lt = localStorage.getItem(LS + "launchedTopic");
      const st = localStorage.getItem(LS + "settledTopic");
      const fm = localStorage.getItem(LS + "followMarket");
      if (pf) setPadFactory(pf);
      if (lt) setLaunchedTopic(lt);
      if (st != null) setSettledTopic(st);
      if (fm) setFollowMarket(fm);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "padFactory", fields.current.padFactory.trim() || DEFAULT_PAD_FACTORY);
      localStorage.setItem(
        LS + "launchedTopic",
        fields.current.launchedTopic.trim() || DEFAULT_LAUNCHED_TOPIC0
      );
      localStorage.setItem(LS + "settledTopic", fields.current.settledTopic.trim());
      localStorage.setItem(LS + "followMarket", fields.current.followMarket.trim());
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
    (card: LaunchCard, kindZh: string, kindEn: string, extraTags: string[] = []) => {
      const title = card.ticker || shortAddr(card.market);
      pushEvent({
        kind: locale === "zh" ? kindZh : kindEn,
        tags: ["NEW", "RH", "COMPANYPAD", "LAUNCHED", `pad:${card.pad}`, ...extraTags],
        title,
        body: `pad:${card.pad} · ticker ${title} · metricId ${card.metricId || "—"} · market ${shortAddr(card.market)} · creator ${shortAddr(card.creator)} · curve ${shortAddr(card.curve)} · key ${shortAddr(card.key)} · firstEventAt ${card.firstEventAt || "—"} · launchTx ${shortAddr(card.launchTx)} · #${card.blockNumber}`,
        address: card.market || undefined,
        block: card.blockNumber,
        tx: card.launchTx || undefined,
        chain: "RH",
        metric: card.metricId || shortAddr(card.curve),
        metricLabel: "metricId",
        metric2: `#${card.blockNumber}`,
        metric2Label: locale === "zh" ? "区块" : "Block",
        at: card.ts,
      });
    },
    [locale, pushEvent]
  );

  const emitSettled = useCallback(
    (
      market: string,
      settled: ReturnType<typeof decodeSettled>,
      tx: string,
      bn: number
    ) => {
      pushEvent({
        kind: locale === "zh" ? "Settled 结算" : "Settled",
        tags: ["NEW", "RH", "COMPANYPAD", "SETTLED", "pad:companypad", "FOLLOW"],
        title: `epoch ${settled.epoch || "—"}`,
        body: `pad:companypad · Settled · market ${shortAddr(market)} · epoch ${settled.epoch} · value ${settled.value} · beat ${settled.beat ? "yes" : "no"} · potSpent ${settled.potSpent} · nextEventAt ${settled.nextEventAt} · tx ${shortAddr(tx)} · #${bn}`,
        address: market || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "RH",
        metric: settled.value || settled.epoch,
        metricLabel: settled.value ? "value" : "epoch",
        metric2: settled.beat ? "BEAT" : "MISS",
        metric2Label: "beat",
        at: Date.now(),
      });
    },
    [locale, pushEvent]
  );

  const onLaunched = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeLaunched(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.market || !isAddr(decoded.market)) return;
      const dedupeKey = `${decoded.market.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      emitLaunch(
        {
          pad: "companypad",
          market: decoded.market.toLowerCase(),
          key: decoded.key,
          creator: (decoded.creator || "").toLowerCase(),
          curve: (decoded.curve || "").toLowerCase(),
          metricId: decoded.metricId,
          ticker: decoded.ticker,
          firstEventAt: decoded.firstEventAt,
          launchTx: tx,
          blockNumber: bn,
          ts: Date.now(),
        },
        "PAD Launched",
        "PAD Launched",
        ["SNIPER", "RADAR"]
      );
      setFollowMarket(decoded.market.toLowerCase());
    },
    [emitLaunch]
  );

  const onSettledLog = useCallback(
    (r: Record<string, unknown>) => {
      const market = String(r.address || "").toLowerCase();
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const dedupeKey = `settled:${market}:${tx}:${r.logIndex}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      emitSettled(market, decodeSettled(r), tx, bn);
    },
    [emitSettled]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      const launchT = (fields.current.launchedTopic.trim() || DEFAULT_LAUNCHED_TOPIC0).toLowerCase();
      const settledT = fields.current.settledTopic.trim().toLowerCase();
      if (t0 === launchT) return onLaunched(r);
      if (settledT && t0 === settledT) return onSettledLog(r);
    },
    [onLaunched, onSettledLog]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const pad = (fields.current.padFactory.trim() || DEFAULT_PAD_FACTORY).toLowerCase();
    if (!isAddr(pad)) {
      setStatus("error");
      return;
    }
    const lt = (fields.current.launchedTopic.trim() || DEFAULT_LAUNCHED_TOPIC0).toLowerCase();
    send("eth_subscribe", ["logs", { address: pad, topics: [lt] }]);
    const follow = fields.current.followMarket.trim().toLowerCase();
    const st = fields.current.settledTopic.trim().toLowerCase();
    if (isAddr(follow) && isTopic0(st)) {
      send("eth_subscribe", ["logs", { address: follow, topics: [st] }]);
    }
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
    const pad = (fields.current.padFactory.trim() || DEFAULT_PAD_FACTORY).toLowerCase();
    if (!isAddr(pad)) {
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

  const onSelectCard = useCallback(
    (id: string) => {
      setSelectedId(id);
      const pool = events.length ? events : history.events.length ? history.events : seedEvents;
      const ev = pool.find((e) => e.id === id);
      if (ev?.address && isAddr(ev.address)) {
        const m = ev.address.toLowerCase();
        setFollowMarket(m);
        fields.current.followMarket = m;
        saveFields();
        reconnectIfRunning();
      }
    },
    [events, history.events, seedEvents, reconnectIfRunning]
  );

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
    { label: "PAD_FACTORY", value: padFactory || DEFAULT_PAD_FACTORY, mono: true },
    {
      label: "LAUNCHED_TOPIC0",
      value: launchedTopic || DEFAULT_LAUNCHED_TOPIC0,
      mono: true,
    },
    {
      label: "FOLLOW_MARKET",
      value: followMarket.trim() ? shortAddr(followMarket) : locale === "zh" ? "点卡片跟 Settled" : "click card → Settled",
      mono: true,
    },
    {
      label: "SETTLED_TOPIC0",
      value: settledTopic.trim() ? shortAddr(settledTopic) : "—",
      mono: true,
    },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "companypad.fun / PAD Launched" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "company-market-listen" },
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

  const hintChip = (label: string, addr: string) => (
    <button
      key={label}
      type="button"
      className="inline-flex items-center gap-1.5 border border-[rgba(0,240,255,0.22)] bg-[rgba(0,240,255,0.04)] px-2 py-1 font-mono text-[10px] text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.45)] hover:text-[var(--color-neon-cyan)]"
      title={addr}
      onClick={() => {
        void navigator.clipboard?.writeText(addr);
      }}
    >
      <span className="font-bold uppercase tracking-[0.06em] text-[var(--color-neon-cyan)]">{label}</span>
      {shortAddr(addr)}
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
              {locale === "zh" ? "公司盘 · PAD Launched / Settled" : "Company markets · PAD Launched / Settled"}
            </CardTitle>
            <CardDescription>{t(locale, "companypad.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-pad">PAD_FACTORY</Label>
              <Input
                id="cp-pad"
                value={padFactory}
                onChange={(e) => setPadFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-lt">LAUNCHED_TOPIC0</Label>
              <Input
                id="cp-lt"
                value={launchedTopic}
                onChange={(e) => setLaunchedTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-follow">FOLLOW_MARKET {locale === "zh" ? "（点卡片跟 Settled）" : "(click card → Settled)"}</Label>
              <Input
                id="cp-follow"
                value={followMarket}
                onChange={(e) => setFollowMarket(e.target.value)}
                onBlur={() => {
                  saveFields();
                  reconnectIfRunning();
                }}
                spellCheck={false}
                placeholder={SAMPLE_NVDA_MARKET}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-st">SETTLED_TOPIC0</Label>
              <Input
                id="cp-st"
                value={settledTopic}
                onChange={(e) => setSettledTopic(e.target.value)}
                onBlur={() => {
                  saveFields();
                  reconnectIfRunning();
                }}
                spellCheck={false}
                placeholder={locale === "zh" ? "可编辑 · 空则不跟 Settled" : "editable · empty = skip Settled"}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hintChip("ORACLE", HINT_ORACLE)}
              {hintChip("CURVE_DEPLOYER", HINT_CURVE_DEPLOYER)}
              {hintChip("PROJECT_TOKEN", HINT_PROJECT_TOKEN)}
              {hintChip("POOL_MANAGER", HINT_POOL_MANAGER)}
              {hintChip("NVDA_MARKET", SAMPLE_NVDA_MARKET)}
              {hintChip("SAMPLE_CURVE", SAMPLE_CURVE)}
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {locale === "zh"
                ? "提示芯片只读/可粘贴 · 点复制。companypad.fun"
                : "Hint chips read-only / paste · click to copy. companypad.fun"}
            </p>
            <label className="inline-flex items-center gap-2 border border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.06)] px-2.5 py-2 text-sm text-[var(--color-warn)]">
              <input type="checkbox" checked={demoHits} onChange={(e) => setDemoHits(e.target.checked)} className="h-4 w-4" />
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
        title={t(locale, "companypad.title")}
        tag={t(locale, "companypad.tag")}
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
        guide={t(locale, "companypad.guide")}
        watching={t(locale, "companypad.watching")}
        hint={t(locale, "companypad.hint")}
        emptyTitle={t(locale, "companypad.emptyTitle")}
        emptySub={t(locale, "companypad.emptySub")}
        latestLabel={t(locale, "companypad.latest")}
        chainBadge="RH"
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
