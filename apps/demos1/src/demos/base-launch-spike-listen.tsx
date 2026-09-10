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
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildBaseSpikeFixtures, useDemoHits } from "../lib/demo-hits";
import { mapPairCreatedLogs, useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Uniswap V2 PairCreated (Base Uniswap V2 factory default). */
const TOPIC_PAIR =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
/** Uniswap V2 Swap — early swap density after create. */
const TOPIC_SWAP =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
/** Base Uniswap V2 factory — editable; swap to V3 factory + PoolCreated if needed. */
const DEFAULT_FACTORY = "0x8909dc15e40173ff4699343b6eb8132c65e18ec6";
const DEFAULT_MIN_SWAPS = 5;
const DEFAULT_WINDOW_SEC = 90;
const LS = "blockreq.base-launch-spike.";
const SLUG = "base-launch-spike-listen";

type LaunchRec = {
  pair: string;
  token0: string;
  token1: string;
  createdAt: number;
  createdBlock: number;
  swapCount: number;
  spiked: boolean;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

/**
 * Base 开盘尖刺 — factory PairCreated + early Swap density in a time window.
 * Layout: launch-feed — density/rate across many launches fits sticky feed better
 * than single-focus one-shot stage.
 */
export function BaseLaunchSpikeDemo({ locale }: { locale: Locale }) {
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [topicPair, setTopicPair] = useState(TOPIC_PAIR);
  const [topicSwap, setTopicSwap] = useState(TOPIC_SWAP);
  const [minSwaps, setMinSwaps] = useState(String(DEFAULT_MIN_SWAPS));
  const [windowSec, setWindowSec] = useState(String(DEFAULT_WINDOW_SEC));
  const [subPair, setSubPair] = useState(true);
  const [subSwap, setSubSwap] = useState(true);
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

  const seedEvents = useMemo(() => buildBaseSpikeFixtures(locale, 6), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || DEFAULT_FACTORY,
    topics: [topicPair],
    map: (logs) => mapPairCreatedLogs(logs, locale, "BASE"),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launches = useRef(new Map<string, LaunchRec>());
  const fields = useRef({
    factory,
    topicPair,
    topicSwap,
    minSwaps,
    windowSec,
    subPair,
    subSwap,
  });
  fields.current = { factory, topicPair, topicSwap, minSwaps, windowSec, subPair, subSwap };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildBaseSpikeFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LS + "factory");
      const ms = localStorage.getItem(LS + "minSwaps");
      const ws = localStorage.getItem(LS + "windowSec");
      const tp = localStorage.getItem(LS + "topicPair");
      const ts = localStorage.getItem(LS + "topicSwap");
      if (f) setFactory(f);
      if (ms) setMinSwaps(ms);
      if (ws) setWindowSec(ws);
      if (tp) setTopicPair(tp);
      if (ts) setTopicSwap(ts);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim() || DEFAULT_FACTORY);
      localStorage.setItem(LS + "minSwaps", fields.current.minSwaps.trim() || String(DEFAULT_MIN_SWAPS));
      localStorage.setItem(LS + "windowSec", fields.current.windowSec.trim() || String(DEFAULT_WINDOW_SEC));
      localStorage.setItem(LS + "topicPair", fields.current.topicPair.trim());
      localStorage.setItem(LS + "topicSwap", fields.current.topicSwap.trim());
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

  const onPairCreated = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const token0 = unpadTopic(topics[1]);
      const token1 = unpadTopic(topics[2]);
      const pair = wordAddr(r.data as string, 0);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      if (pair) {
        launches.current.set(pair.toLowerCase(), {
          pair: pair.toLowerCase(),
          token0,
          token1,
          createdAt: Date.now(),
          createdBlock: bn,
          swapCount: 0,
          spiked: false,
        });
      }
      pushEvent({
        kind: locale === "zh" ? "工厂开盘" : "Factory create",
        tags: ["NEW", "BASE"],
        title: shortAddr(pair),
        body: `${shortAddr(token0)} / ${shortAddr(token1)} · #${bn}`,
        address: pair || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "BASE",
        metric: "0",
        metricLabel: locale === "zh" ? "早期换手" : "Early swaps",
        metric2: locale === "zh" ? "开盘" : "OPEN",
        metric2Label: locale === "zh" ? "信号" : "Signal",
      });
      // Also subscribe to swaps on this pair for density (topic-wide swap is noisy; prefer address filter).
      if (pair && isAddr(pair) && fields.current.subSwap) {
        send("eth_subscribe", [
          "logs",
          { address: pair.toLowerCase(), topics: [fields.current.topicSwap.trim().toLowerCase()] },
        ]);
      }
    },
    [locale, pushEvent]
  );

  const onSwap = useCallback(
    (r: Record<string, unknown>) => {
      const pair = String(r.address || "").toLowerCase();
      const rec = launches.current.get(pair);
      if (!rec) return;
      const windowMs = Math.max(5, Number(fields.current.windowSec) || DEFAULT_WINDOW_SEC) * 1000;
      if (Date.now() - rec.createdAt > windowMs) return;
      rec.swapCount += 1;
      const min = Math.max(1, Number(fields.current.minSwaps) || DEFAULT_MIN_SWAPS);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      if (rec.swapCount >= min && !rec.spiked) {
        rec.spiked = true;
        pushEvent({
          kind: locale === "zh" ? "开盘尖刺" : "Launch spike",
          tags: ["SPIKE", "BASE"],
          title: shortAddr(pair),
          body: `${shortAddr(rec.token0)} / ${shortAddr(rec.token1)} · swaps ${rec.swapCount}/${fields.current.windowSec}s · #${bn}`,
          address: pair,
          block: bn,
          tx: String(r.transactionHash || "") || undefined,
          chain: "BASE",
          metric: String(rec.swapCount),
          metricLabel: locale === "zh" ? "早期换手" : "Early swaps",
          metric2: locale === "zh" ? "尖刺" : "SPIKE",
          metric2Label: locale === "zh" ? "信号" : "Signal",
        });
      } else if (!rec.spiked && rec.swapCount > 0 && rec.swapCount % 2 === 0) {
        // Periodic density tick while still under threshold
        pushEvent({
          kind: locale === "zh" ? "早期换手密" : "Early swap dens",
          tags: ["DENS", "BASE"],
          title: shortAddr(pair),
          body: `swaps ${rec.swapCount} · need ≥${min} · #${bn}`,
          address: pair,
          block: bn,
          tx: String(r.transactionHash || "") || undefined,
          chain: "BASE",
          metric: String(rec.swapCount),
          metricLabel: locale === "zh" ? "早期换手" : "Early swaps",
          metric2: `${rec.swapCount}/${min}`,
          metric2Label: "vs thr",
        });
      }
    },
    [locale, pushEvent]
  );

  const onLogMsg = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      if (t0 === fields.current.topicPair.trim().toLowerCase()) return onPairCreated(r);
      if (t0 === fields.current.topicSwap.trim().toLowerCase()) return onSwap(r);
    },
    [onPairCreated, onSwap]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = (fields.current.factory.trim() || DEFAULT_FACTORY).toLowerCase();
    const tp = fields.current.topicPair.trim().toLowerCase();
    if (fields.current.subPair) {
      const filt: { topics: string[]; address?: string } = { topics: [tp] };
      if (isAddr(f)) filt.address = f;
      send("eth_subscribe", ["logs", filt]);
    }
    // Broad swap subscribe is too noisy on Base — we attach per-pair after PairCreated.
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
    { label: locale === "zh" ? "工厂" : "Factory", value: shortAddr(factory) || factory, mono: true },
    { label: locale === "zh" ? "尖刺阈值" : "Spike thr", value: `≥${minSwaps} swaps` },
    { label: locale === "zh" ? "窗口" : "Window", value: `${windowSec}s` },
    { label: "PairCreated", value: subPair ? "on" : "off" },
    { label: "Swap dens", value: subSwap ? "on" : "off" },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "base.launch.spike" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "factory+swap-density" },
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
            <CardTitle>{locale === "zh" ? "工厂 + 尖刺阈值" : "Factory + spike thresholds"}</CardTitle>
            <CardDescription>
              {locale === "zh"
                ? "默认 Base Uniswap V2 工厂。新 PairCreated 后在窗口内计 Swap；达阈值 → 开盘尖刺。"
                : "Default Base Uniswap V2 factory. After PairCreated, count Swaps in the window; hit threshold → launch spike."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="spike-factory">{locale === "zh" ? "工厂" : "Factory"}</Label>
              <Input
                id="spike-factory"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="spike-min">{locale === "zh" ? "最少换手数" : "Min early swaps"}</Label>
                <Input
                  id="spike-min"
                  value={minSwaps}
                  onChange={(e) => setMinSwaps(e.target.value)}
                  onBlur={saveFields}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spike-win">{locale === "zh" ? "窗口（秒）" : "Window (sec)"}</Label>
                <Input
                  id="spike-win"
                  value={windowSec}
                  onChange={(e) => setWindowSec(e.target.value)}
                  onBlur={saveFields}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subPair} onChange={(e) => setSubPair(e.target.checked)} className="h-4 w-4" />
                PairCreated
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subSwap} onChange={(e) => setSubSwap(e.target.checked)} className="h-4 w-4" />
                Early Swap density
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spike-tp">PairCreated topic0</Label>
              <Input id="spike-tp" value={topicPair} onChange={(e) => setTopicPair(e.target.value)} onBlur={saveFields} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spike-ts">Swap topic0</Label>
              <Input id="spike-ts" value={topicSwap} onChange={(e) => setTopicSwap(e.target.value)} onBlur={saveFields} />
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
        title={t(locale, "spike.title")}
        tag={t(locale, "spike.tag")}
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
        guide={t(locale, "spike.guide")}
        watching={t(locale, "spike.watching")}
        hint={t(locale, "spike.hint")}
        emptyTitle={t(locale, "spike.emptyTitle")}
        emptySub={t(locale, "spike.emptySub")}
        latestLabel={t(locale, "spike.latest")}
        chainBadge="Base"
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
