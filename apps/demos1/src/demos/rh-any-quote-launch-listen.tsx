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
import { isAddr, shortAddr, unpadTopic, wordAddr, wordU256 } from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildAnyQuoteFixtures, useDemoHits } from "../lib/demo-hits";
import { mapInitializeLogs, mapPairCreatedLogs, useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

const TOPIC_INIT =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";
const TOPIC_PAIR =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
/** RH Uniswap v4 PoolManager — same default as rh-uniswap-v4-direct-launch-listen */
const DEFAULT_PM = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
const DEFAULT_FACTORY = "";
const LS = "blockreq.rh-any-quote-launch.";
const SLUG = "rh-any-quote-launch-listen";
const DEFAULT_QUOTES =
  "USDC 0x1111111111111111111111111111111111111111\nWETH 0x2222222222222222222222222222222222222222\nRHUSD 0x3333333333333333333333333333333333333333";

function parseQuote(text: string) {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const parts = raw.split(/\s+/);
    let sym = "";
    let addr = "";
    if (parts.length === 1 && /^0x[a-fA-F0-9]{40}$/.test(parts[0])) {
      addr = parts[0].toLowerCase();
      sym = shortAddr(addr);
    } else if (parts.length >= 2) {
      if (/^0x[a-fA-F0-9]{40}$/.test(parts[0])) {
        addr = parts[0].toLowerCase();
        sym = parts[1];
      } else if (/^0x[a-fA-F0-9]{40}$/.test(parts[1])) {
        sym = parts[0];
        addr = parts[1].toLowerCase();
      }
    }
    if (addr) map.set(addr, sym || shortAddr(addr));
  }
  return map;
}

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

/**
 * RH any-quote launch — parallel PoolManager Initialize + Factory PairCreated,
 * gated by editable QUOTE_WHITELIST (either side → quoteSide / launchSide).
 * Layout: launch-feed (same family as stock-pair / long-eco).
 */
export function RhAnyQuoteLaunchDemo({ locale }: { locale: Locale }) {
  const [poolManager, setPoolManager] = useState(DEFAULT_PM);
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [quoteText, setQuoteText] = useState(DEFAULT_QUOTES);
  const [topicInit, setTopicInit] = useState(TOPIC_INIT);
  const [topicPair, setTopicPair] = useState(TOPIC_PAIR);
  const [subInit, setSubInit] = useState(true);
  const [subPair, setSubPair] = useState(true);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "robinhood");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildAnyQuoteFixtures(locale, 6), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: poolManager.trim() || DEFAULT_PM,
    topics: [topicInit],
    map: (logs) => [
      ...mapInitializeLogs(logs, locale, "RH"),
      ...mapPairCreatedLogs(logs, locale, "RH"),
    ],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const quoteMap = useRef(new Map<string, string>());
  const fields = useRef({
    poolManager,
    factory,
    quoteText,
    topicInit,
    topicPair,
    subInit,
    subPair,
  });
  fields.current = { poolManager, factory, quoteText, topicInit, topicPair, subInit, subPair };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildAnyQuoteFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const pm = localStorage.getItem(LS + "poolManager");
      const f = localStorage.getItem(LS + "factory");
      const q = localStorage.getItem(LS + "quotes");
      const ti = localStorage.getItem(LS + "topicInit");
      const tp = localStorage.getItem(LS + "topicPair");
      if (pm) setPoolManager(pm);
      if (f) setFactory(f);
      if (q) setQuoteText(q);
      if (ti) setTopicInit(ti);
      if (tp) setTopicPair(tp);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "poolManager", fields.current.poolManager.trim() || DEFAULT_PM);
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "quotes", fields.current.quoteText);
      localStorage.setItem(LS + "topicInit", fields.current.topicInit.trim());
      localStorage.setItem(LS + "topicPair", fields.current.topicPair.trim());
      quoteMap.current = parseQuote(fields.current.quoteText);
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

  const sideHit = (a: string, b: string) => {
    const sa = quoteMap.current.get(a);
    const sb = quoteMap.current.get(b);
    if (sa) return { quoteSide: a, launchSide: b, symbol: sa };
    if (sb) return { quoteSide: b, launchSide: a, symbol: sb };
    return null;
  };

  const onInitialize = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const poolId = topics[1] || "";
      const currency0 = unpadTopic(topics[2]);
      const currency1 = unpadTopic(topics[3]);
      const hit = sideHit(currency0, currency1);
      if (!hit) return;
      const fee = wordU256(r.data as string, 0);
      const hooks = wordAddr(r.data as string, 2);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      pushEvent({
        kind: locale === "zh" ? "任意报价 Initialize" : "any-quote Initialize",
        tags: ["NEW", "V4", "ANYQUOTE", hit.symbol],
        title: shortAddr(hit.launchSide || poolId),
        body: `path=any-quote · quoteSide ${hit.symbol} ${shortAddr(hit.quoteSide)} · launchSide ${shortAddr(hit.launchSide)} · fee ${fee.toString()} · hooks ${shortAddr(hooks)} · #${bn}`,
        address: hit.launchSide || poolId || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "RH",
        metric: hit.symbol,
        metricLabel: locale === "zh" ? "报价侧" : "quoteSide",
        metric2: shortAddr(hit.launchSide),
        metric2Label: locale === "zh" ? "发射侧" : "launchSide",
      });
    },
    [locale, pushEvent]
  );

  const onPairCreated = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const token0 = unpadTopic(topics[1]);
      const token1 = unpadTopic(topics[2]);
      const pair = wordAddr(r.data as string, 0);
      const hit = sideHit(token0, token1);
      if (!hit) return;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      pushEvent({
        kind: locale === "zh" ? "任意报价 PairCreated" : "any-quote PairCreated",
        tags: ["NEW", "PAIR", "ANYQUOTE", hit.symbol],
        title: shortAddr(hit.launchSide || pair),
        body: `path=any-quote · quoteSide ${hit.symbol} ${shortAddr(hit.quoteSide)} · launchSide ${shortAddr(hit.launchSide)} · poolOrPair ${shortAddr(pair)} · #${bn}`,
        address: hit.launchSide || pair || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "RH",
        metric: hit.symbol,
        metricLabel: locale === "zh" ? "报价侧" : "quoteSide",
        metric2: shortAddr(hit.launchSide),
        metric2Label: locale === "zh" ? "发射侧" : "launchSide",
      });
    },
    [locale, pushEvent]
  );

  const onLogMsg = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      if (t0 === fields.current.topicInit.trim().toLowerCase()) return onInitialize(r);
      if (t0 === fields.current.topicPair.trim().toLowerCase()) return onPairCreated(r);
    },
    [onInitialize, onPairCreated]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    quoteMap.current = parseQuote(fields.current.quoteText);
    const pm = (fields.current.poolManager.trim() || DEFAULT_PM).toLowerCase();
    const f = fields.current.factory.trim().toLowerCase();
    const ti = fields.current.topicInit.trim().toLowerCase();
    const tp = fields.current.topicPair.trim().toLowerCase();
    if (fields.current.subInit) {
      const filt: { topics: string[]; address?: string } = { topics: [ti] };
      if (isAddr(pm)) filt.address = pm;
      send("eth_subscribe", ["logs", filt]);
    }
    if (fields.current.subPair) {
      const filt: { topics: string[]; address?: string } = { topics: [tp] };
      if (isAddr(f)) filt.address = f;
      send("eth_subscribe", ["logs", filt]);
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
      onLogMsg(r);
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
  }, [onLogMsg, subscribeAll]);

  const resume = useCallback(() => {
    quoteMap.current = parseQuote(fields.current.quoteText);
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
    quoteMap.current = parseQuote(quoteText);
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
    { label: "PoolManager", value: shortAddr(poolManager) || poolManager, mono: true },
    { label: "V2_FACTORY", value: factory.trim() || (locale === "zh" ? "（宽听）" : "(wide)"), mono: true },
    { label: "Quotes", value: String(quoteMap.current.size || parseQuote(quoteText).size) },
    { label: "Initialize", value: subInit ? "on" : "off" },
    { label: "PairCreated", value: subPair ? "on" : "off" },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "rh.any-quote.launch" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "init+paircreated-quote-gate" },
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
            <CardTitle>{t(locale, "anyquote.whitelistLabel")}</CardTitle>
            <CardDescription>{t(locale, "anyquote.whitelistHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="aq-quotes">{t(locale, "anyquote.whitelistLabel")}</Label>
              <textarea
                id="aq-quotes"
                className="min-h-[88px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aq-pm">POOL_MANAGER</Label>
              <Input
                id="aq-pm"
                value={poolManager}
                onChange={(e) => setPoolManager(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aq-factory">V2_FACTORY</Label>
              <Input
                id="aq-factory"
                placeholder="0x… (optional address filter)"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subInit} onChange={(e) => setSubInit(e.target.checked)} className="h-4 w-4" />
                Initialize
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subPair} onChange={(e) => setSubPair(e.target.checked)} className="h-4 w-4" />
                PairCreated
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aq-ti">INIT_TOPIC0</Label>
              <Input id="aq-ti" value={topicInit} onChange={(e) => setTopicInit(e.target.value)} onBlur={saveFields} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aq-tp">PAIR_CREATED_TOPIC0</Label>
              <Input id="aq-tp" value={topicPair} onChange={(e) => setTopicPair(e.target.value)} onBlur={saveFields} />
            </div>
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
        title={t(locale, "anyquote.title")}
        tag={t(locale, "anyquote.tag")}
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
        onSelect={setSelectedId}
        onPause={pause}
        onResume={resume}
        running={running}
        connecting={status === "connecting"}
        history={history}
        watchParams={watchParams}
        sourceItems={sourceItems}
        guide={t(locale, "anyquote.guide")}
        watching={t(locale, "anyquote.watching")}
        hint={t(locale, "anyquote.hint")}
        emptyTitle={t(locale, "anyquote.emptyTitle")}
        emptySub={t(locale, "anyquote.emptySub")}
        latestLabel={t(locale, "anyquote.latest")}
        chainBadge="RH"
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
