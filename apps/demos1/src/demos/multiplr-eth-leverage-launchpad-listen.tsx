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
import { isAddr, shortAddr, unpadTopic, wordAddr } from "@blockreq/rpc";
import type { JsonRpcLog } from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { OpenWaitLayout } from "../components/layouts/open-wait-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildMultiplrLeverageFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Multiplr launchpad factory — verified deployments/config */
const DEFAULT_FACTORY = "0xe0a5b04c2c9147124b5c720be11a5fe225dc1d64";
const DEFAULT_BONDING_CURVE = "0xb50ccf18caff564737b93fd6f7cc80a6e98f33ba";
const DEFAULT_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const DEFAULT_ETH2X_FLI = "0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd";
/** Factory LAUNCH (token launch) */
const LAUNCH_TOPIC0 =
  "0x6463f19bda11319a1f6386f04409a12ac72660f134d541e3dd38aa0c27e284dd";
/** Curve TRADE (early prints) */
const TRADE_TOPIC0 =
  "0x770154dd94b2cc206923a3ad58af013c86d55fdbe62b2bbcf13bff9c19ff4d02";
/** Uniswap V3 PoolCreated */
const V3_POOL_CREATED =
  "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118";
/** ERC-20 Transfer */
const TOPIC_TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_WHITELIST = `# QUOTE_WHITELIST — ETH2x-FLI default (CSV / one addr per line)
ETH2x-FLI 0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd`;
const TRANSFER_BURST_WINDOW_MS = 8_000;
const TRANSFER_BURST_MIN = 4;
const LS = "blockreq.multiplr-eth-leverage.";
const SLUG = "multiplr-eth-leverage-launchpad-listen";

type LaunchRec = {
  token: string;
  creator: string;
  quote: string;
  factory: string;
  launchTx: string;
  blockNumber: number;
  curvePrintTx?: string;
  v3Pool?: string;
  transferBurst?: number;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function parseWhitelist(text: string): Set<string> {
  const set = new Set<string>();
  for (const line of text.split(/[\r\n,]+/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    for (const p of parts) {
      if (/^0x[a-fA-F0-9]{40}$/.test(p)) set.add(p.toLowerCase());
    }
  }
  return set;
}

function mapLaunchLogs(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const topics = log.topics || [];
    const token = unpadTopic(topics[1]);
    const creator = unpadTopic(topics[2]);
    const quote = wordAddr(log.data, 0);
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: locale === "zh" ? "历史开池" : "Recent launch",
      tags: ["HIST", "ETH", "MULTIPLR", "pad:multiplr-leverage"],
      title: shortAddr(token),
      body: `pad:multiplr-leverage · token ${shortAddr(token)} · creator ${shortAddr(creator)} · quote ${shortAddr(quote)} · #${bn}`,
      address: token || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "ETH",
      at: now - i * 400,
      metric: shortAddr(quote),
      metricLabel: "quote",
      metric2: `#${bn}`,
      metric2Label: locale === "zh" ? "区块" : "Block",
    };
  });
}

/**
 * Multiplr ETH leverage launchpad listen — Factory LAUNCH filtered by ETH2x quote whitelist,
 * optional TRADE / V3 PoolCreated / ETH2x Transfer side channels.
 * Layout: single-focus OpenWaitLayout (launchpad opens).
 */
export function MultiplrEthLeverageLaunchpadDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [launchTopic, setLaunchTopic] = useState(LAUNCH_TOPIC0);
  const [whitelist, setWhitelist] = useState(DEFAULT_WHITELIST);
  const [tradeTopic, setTradeTopic] = useState(TRADE_TOPIC0);
  const [bondingCurve, setBondingCurve] = useState(DEFAULT_BONDING_CURVE);
  const [v3Factory, setV3Factory] = useState(DEFAULT_V3_FACTORY);
  const [eth2x, setEth2x] = useState(DEFAULT_ETH2X_FLI);
  const [subTrade, setSubTrade] = useState(true);
  const [subV3, setSubV3] = useState(true);
  const [subXfer, setSubXfer] = useState(false);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "ethereum");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildMultiplrLeverageFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || DEFAULT_FACTORY,
    topics: [launchTopic.trim() || LAUNCH_TOPIC0],
    map: (logs) => mapLaunchLogs(logs, locale),
    enabled: isAddr(factory.trim() || DEFAULT_FACTORY) && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launchDedup = useRef(new Set<string>());
  const launches = useRef(new Map<string, LaunchRec>());
  const xferTs = useRef<number[]>([]);
  const fields = useRef({
    factory,
    launchTopic,
    whitelist,
    tradeTopic,
    bondingCurve,
    v3Factory,
    eth2x,
    subTrade,
    subV3,
    subXfer,
  });
  fields.current = {
    factory,
    launchTopic,
    whitelist,
    tradeTopic,
    bondingCurve,
    v3Factory,
    eth2x,
    subTrade,
    subV3,
    subXfer,
  };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 40));
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildMultiplrLeverageFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 40));
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LS + "factory");
      const lt = localStorage.getItem(LS + "launchTopic");
      const wl = localStorage.getItem(LS + "whitelist");
      const tt = localStorage.getItem(LS + "tradeTopic");
      const bc = localStorage.getItem(LS + "bondingCurve");
      const v3 = localStorage.getItem(LS + "v3Factory");
      const e2 = localStorage.getItem(LS + "eth2x");
      const st = localStorage.getItem(LS + "subTrade");
      const sv = localStorage.getItem(LS + "subV3");
      const sx = localStorage.getItem(LS + "subXfer");
      if (f) setFactory(f);
      if (lt) setLaunchTopic(lt);
      if (wl) setWhitelist(wl);
      if (tt) setTradeTopic(tt);
      if (bc) setBondingCurve(bc);
      if (v3) setV3Factory(v3);
      if (e2) setEth2x(e2);
      if (st != null) setSubTrade(st === "1");
      if (sv != null) setSubV3(sv === "1");
      if (sx != null) setSubXfer(sx === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim() || DEFAULT_FACTORY);
      localStorage.setItem(LS + "launchTopic", fields.current.launchTopic.trim() || LAUNCH_TOPIC0);
      localStorage.setItem(LS + "whitelist", fields.current.whitelist);
      localStorage.setItem(LS + "tradeTopic", fields.current.tradeTopic.trim() || TRADE_TOPIC0);
      localStorage.setItem(LS + "bondingCurve", fields.current.bondingCurve.trim() || DEFAULT_BONDING_CURVE);
      localStorage.setItem(LS + "v3Factory", fields.current.v3Factory.trim() || DEFAULT_V3_FACTORY);
      localStorage.setItem(LS + "eth2x", fields.current.eth2x.trim() || DEFAULT_ETH2X_FLI);
      localStorage.setItem(LS + "subTrade", fields.current.subTrade ? "1" : "0");
      localStorage.setItem(LS + "subV3", fields.current.subV3 ? "1" : "0");
      localStorage.setItem(LS + "subXfer", fields.current.subXfer ? "1" : "0");
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

  const emitLaunchCard = useCallback(
    (rec: LaunchRec, kindZh: string, kindEn: string, extraTags: string[] = []) => {
      pushEvent({
        kind: locale === "zh" ? kindZh : kindEn,
        tags: ["NEW", "ETH", "MULTIPLR", "LEVERAGE", "pad:multiplr-leverage", ...extraTags],
        title: shortAddr(rec.token),
        body: `pad:multiplr-leverage · factory ${shortAddr(rec.factory)} · token ${shortAddr(rec.token)} · creator ${shortAddr(rec.creator)} · quote ${shortAddr(rec.quote)} · launchTx ${shortAddr(rec.launchTx)} · curvePrintTx ${rec.curvePrintTx ? shortAddr(rec.curvePrintTx) : "—"} · v3Pool ${rec.v3Pool ? shortAddr(rec.v3Pool) : "—"} · transferBurst ${rec.transferBurst ?? 0} · #${rec.blockNumber}`,
        address: rec.token,
        block: rec.blockNumber,
        tx: rec.launchTx || undefined,
        chain: "ETH",
        metric: shortAddr(rec.quote),
        metricLabel: "quote",
        metric2: `#${rec.blockNumber}`,
        metric2Label: locale === "zh" ? "区块" : "Block",
      });
    },
    [locale, pushEvent]
  );

  const onLaunch = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const token = unpadTopic(topics[1]);
      const creator = unpadTopic(topics[2]);
      const quote = wordAddr(r.data as string, 0);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const factoryAddr = String(r.address || fields.current.factory).toLowerCase();
      if (!token || !isAddr(token)) return;
      const wl = parseWhitelist(fields.current.whitelist);
      if (wl.size > 0 && quote && !wl.has(quote.toLowerCase())) return;
      const dedupeKey = `${token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      const rec: LaunchRec = {
        token: token.toLowerCase(),
        creator: (creator || "").toLowerCase(),
        quote: (quote || "").toLowerCase(),
        factory: factoryAddr,
        launchTx: tx,
        blockNumber: bn,
      };
      launches.current.set(rec.token, rec);
      emitLaunchCard(rec, "杠杆开池", "Leverage open", ["LAUNCH"]);
    },
    [emitLaunchCard]
  );

  const onTrade = useCallback(
    (r: Record<string, unknown>) => {
      const tx = String(r.transactionHash || "");
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      // Prefer linking to a recent launch in the same tx or latest open
      let linked: LaunchRec | undefined;
      for (const rec of launches.current.values()) {
        if (rec.launchTx && tx && rec.launchTx.toLowerCase() === tx.toLowerCase()) {
          linked = rec;
          break;
        }
      }
      if (!linked) {
        // attach to most recent launch without curvePrint yet
        for (const rec of [...launches.current.values()].reverse()) {
          if (!rec.curvePrintTx) {
            linked = rec;
            break;
          }
        }
      }
      if (linked) {
        linked.curvePrintTx = tx;
        emitLaunchCard(linked, "曲线早打印", "Curve print", ["TRADE", "CURVE"]);
      } else {
        pushEvent({
          kind: locale === "zh" ? "曲线 TRADE" : "Curve TRADE",
          tags: ["TRADE", "CURVE", "ETH", "MULTIPLR", "pad:multiplr-leverage"],
          title: shortAddr(tx),
          body: `pad:multiplr-leverage · curvePrintTx ${shortAddr(tx)} · #${bn}`,
          block: bn,
          tx: tx || undefined,
          chain: "ETH",
          metric: shortAddr(tx),
          metricLabel: "tx",
          metric2: `#${bn}`,
          metric2Label: locale === "zh" ? "区块" : "Block",
        });
      }
    },
    [emitLaunchCard, locale, pushEvent]
  );

  const onV3Pool = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const token0 = unpadTopic(topics[1]);
      const token1 = unpadTopic(topics[2]);
      const pool = wordAddr(r.data as string, 0);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const t0 = (token0 || "").toLowerCase();
      const t1 = (token1 || "").toLowerCase();
      const linked =
        launches.current.get(t0) || launches.current.get(t1) || undefined;
      if (!linked) return;
      if (pool) linked.v3Pool = pool.toLowerCase();
      emitLaunchCard(linked, "V3 毕业", "V3 graduate", ["V3", "GRAD"]);
      pushEvent({
        kind: locale === "zh" ? "V3 PoolCreated" : "V3 PoolCreated",
        tags: ["V3", "POOL", "ETH", "MULTIPLR", "pad:multiplr-leverage"],
        title: shortAddr(pool),
        body: `pad:multiplr-leverage · v3Pool ${shortAddr(pool)} · token ${shortAddr(linked.token)} · ${shortAddr(token0)} / ${shortAddr(token1)} · #${bn}`,
        address: pool || linked.token,
        block: bn,
        tx: tx || undefined,
        chain: "ETH",
        metric: shortAddr(pool),
        metricLabel: "pool",
        metric2: shortAddr(linked.token),
        metric2Label: "token",
      });
    },
    [emitLaunchCard, locale, pushEvent]
  );

  const onTransfer = useCallback(
    (r: Record<string, unknown>) => {
      const now = Date.now();
      xferTs.current = xferTs.current.filter((ts) => now - ts < TRANSFER_BURST_WINDOW_MS);
      xferTs.current.push(now);
      const burst = xferTs.current.length;
      if (burst < TRANSFER_BURST_MIN) return;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      // Annotate most recent launch
      const recent = [...launches.current.values()].pop();
      if (recent) recent.transferBurst = burst;
      pushEvent({
        kind: locale === "zh" ? "ETH2x 转账爆发" : "ETH2x transfer burst",
        tags: ["XFER", "BURST", "ETH", "MULTIPLR", "pad:multiplr-leverage"],
        title: `×${burst}`,
        body: `pad:multiplr-leverage · transferBurst ${burst} · eth2x ${shortAddr(fields.current.eth2x || DEFAULT_ETH2X_FLI)} · #${bn}`,
        address: (fields.current.eth2x || DEFAULT_ETH2X_FLI).toLowerCase(),
        block: bn,
        tx: tx || undefined,
        chain: "ETH",
        metric: String(burst),
        metricLabel: "burst",
        metric2: `#${bn}`,
        metric2Label: locale === "zh" ? "区块" : "Block",
      });
      // reset window so we don't flood
      xferTs.current = [];
    },
    [locale, pushEvent]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      const launchT = (fields.current.launchTopic.trim() || LAUNCH_TOPIC0).toLowerCase();
      const tradeT = (fields.current.tradeTopic.trim() || TRADE_TOPIC0).toLowerCase();
      if (t0 === launchT) return onLaunch(r);
      if (t0 === tradeT) return onTrade(r);
      if (t0 === V3_POOL_CREATED) return onV3Pool(r);
      if (t0 === TOPIC_TRANSFER) return onTransfer(r);
    },
    [onLaunch, onTrade, onTransfer, onV3Pool]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = (fields.current.factory.trim() || DEFAULT_FACTORY).toLowerCase();
    const lt = (fields.current.launchTopic.trim() || LAUNCH_TOPIC0).toLowerCase();
    if (!isAddr(f)) {
      setStatus("error");
      return;
    }
    send("eth_subscribe", ["logs", { address: f, topics: [lt] }]);
    if (fields.current.subTrade) {
      const bc = (fields.current.bondingCurve.trim() || DEFAULT_BONDING_CURVE).toLowerCase();
      const tt = (fields.current.tradeTopic.trim() || TRADE_TOPIC0).toLowerCase();
      const addrs = [f, bc].filter(isAddr);
      send("eth_subscribe", ["logs", { address: addrs, topics: [tt] }]);
    }
    if (fields.current.subV3) {
      const v3 = (fields.current.v3Factory.trim() || DEFAULT_V3_FACTORY).toLowerCase();
      if (isAddr(v3)) send("eth_subscribe", ["logs", { address: v3, topics: [V3_POOL_CREATED] }]);
    }
    if (fields.current.subXfer) {
      const e2 = (fields.current.eth2x.trim() || DEFAULT_ETH2X_FLI).toLowerCase();
      if (isAddr(e2)) send("eth_subscribe", ["logs", { address: e2, topics: [TOPIC_TRANSFER] }]);
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
    const f = fields.current.factory.trim() || DEFAULT_FACTORY;
    if (!isAddr(f)) {
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
    { label: "LAUNCHPAD_FACTORY", value: shortAddr(factory.trim() || DEFAULT_FACTORY), mono: true },
    { label: "LAUNCH_TOPIC0", value: shortAddr(launchTopic || LAUNCH_TOPIC0), mono: true },
    {
      label: "QUOTE_WHITELIST",
      value: locale === "zh" ? "ETH2x-FLI 默认" : "ETH2x-FLI default",
      mono: false,
    },
    {
      label: "sides",
      value: [subTrade && "TRADE", subV3 && "V3", subXfer && "XFER"].filter(Boolean).join("+") || "LAUNCH",
      mono: true,
    },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "multiplr.leverage" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "LAUNCH+quote-wl" },
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
  const { tipAt } = useTipHeartbeat({ https: ep.https, enabled: runningLive && !!ep.https });

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
            <CardTitle>LAUNCHPAD_FACTORY</CardTitle>
            <CardDescription>{t(locale, "multiplr.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mplr-factory">LAUNCHPAD_FACTORY</Label>
              <Input
                id="mplr-factory"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mplr-lt">LAUNCH_TOPIC0</Label>
              <Input
                id="mplr-lt"
                value={launchTopic}
                onChange={(e) => setLaunchTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mplr-wl">QUOTE_WHITELIST</Label>
              <textarea
                id="mplr-wl"
                className="min-h-[72px] w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1.5 font-mono text-xs"
                value={whitelist}
                onChange={(e) => setWhitelist(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={subTrade}
                  onChange={(e) => setSubTrade(e.target.checked)}
                  onBlur={saveFields}
                  className="h-4 w-4"
                />
                TRADE
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={subV3}
                  onChange={(e) => setSubV3(e.target.checked)}
                  onBlur={saveFields}
                  className="h-4 w-4"
                />
                V3 PoolCreated
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={subXfer}
                  onChange={(e) => setSubXfer(e.target.checked)}
                  onBlur={saveFields}
                  className="h-4 w-4"
                />
                ETH2x Transfer
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mplr-tt">TRADE_TOPIC0</Label>
              <Input
                id="mplr-tt"
                value={tradeTopic}
                onChange={(e) => setTradeTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mplr-bc">BONDING_CURVE</Label>
              <Input
                id="mplr-bc"
                value={bondingCurve}
                onChange={(e) => setBondingCurve(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mplr-v3">V3_FACTORY</Label>
              <Input
                id="mplr-v3"
                value={v3Factory}
                onChange={(e) => setV3Factory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mplr-e2">ETH2X_FLI</Label>
              <Input
                id="mplr-e2"
                value={eth2x}
                onChange={(e) => setEth2x(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
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
    <div className="flex min-h-screen flex-col pb-24" data-layout="single-focus">
      <MonitorChrome
        lastUpdateAt={lastUpdateAt}
        locale={locale}
        title={t(locale, "multiplr.title")}
        tag={t(locale, "multiplr.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
        blogUrl={demoBlogUrl(SLUG, locale)}
        siteUrl={demoSiteUrl(getDemo(SLUG))}
        localeMode={onLocaleChange ? "catalog" : "links"}
        onLocaleChange={onLocaleChange}
      />
      <OpenWaitLayout
        locale={locale}
        status={status}
        hasHit={hasHit}
        events={events}
        seedEvents={seedEvents}
        onPause={pause}
        onResume={resume}
        running={running}
        connecting={status === "connecting"}
        history={history}
        watchParams={watchParams}
        sourceItems={sourceItems}
        guide={t(locale, "multiplr.guide")}
        watching={t(locale, "multiplr.watching")}
        stripTitle={t(locale, "multiplr.stripTitle")}
        stripSub={t(locale, "multiplr.stripSub")}
        stageIdle={t(locale, "multiplr.stageIdle")}
        stageConn={t(locale, "multiplr.stageConn")}
        stageListen={t(locale, "multiplr.stageListen")}
        stageHit={t(locale, "multiplr.stageHit")}
        heroIdle={t(locale, "multiplr.hero.idle")}
        heroConnecting={t(locale, "multiplr.hero.connecting")}
        heroListening={t(locale, "multiplr.hero.listening")}
        heroHit={t(locale, "multiplr.hero.hit")}
        recentTitle={t(locale, "multiplr.recent")}
        chainBadge="ETH"
        endpointSlot={
          <EndpointBar
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
              if (wantRun.current) {
                try {
                  wsRef.current?.close();
                } catch {
                  /* ignore */
                }
                connect();
              }
            }}
            onReset={() => {
              ep.reset();
              if (wantRun.current) {
                try {
                  wsRef.current?.close();
                } catch {
                  /* ignore */
                }
                connect();
              }
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
