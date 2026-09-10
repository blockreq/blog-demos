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
import { buildArcDay1Fixtures, useDemoHits } from "../lib/demo-hits";
import { mapPairCreatedLogs, useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Uniswap V2 PairCreated — editable for Arc launchpad factory day-1. */
const TOPIC_PAIR =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const TOPIC_SWAP =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const DEFAULT_FACTORY = "";
const DEFAULT_MIN_SWAPS = 3;
const DEFAULT_WINDOW_SEC = 90;
const LS = "blockreq.arc-mainnet-day1.";
const SLUG = "arc-mainnet-day1-listen";

type LaunchRec = {
  pair: string;
  token0: string;
  token1: string;
  createdAt: number;
  createdBlock: number;
  swapCount: number;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

/**
 * Arc day-1 Factory PairCreated prep — endpoints empty until BlockReq Arc public live.
 * Layout: launch-feed (continuous creates + optional swap density, same family as Base spike).
 */
export function ArcMainnetDay1Demo({ locale }: { locale: Locale }) {
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
  const [showSettings, setShowSettings] = useState(true);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "arc");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildArcDay1Fixtures(locale, 6), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || undefined,
    topics: [topicPair],
    map: (logs) => mapPairCreatedLogs(logs, locale, "ARC"),
    enabled: !!ep.https.trim(),
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
    const fixtures = buildArcDay1Fixtures(locale, 3);
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
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
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
      const factoryAddr = String(r.address || "").toLowerCase();
      const tx = String(r.transactionHash || "");
      if (pair) {
        launches.current.set(pair.toLowerCase(), {
          pair: pair.toLowerCase(),
          token0,
          token1,
          createdAt: Date.now(),
          createdBlock: bn,
          swapCount: 0,
        });
      }
      pushEvent({
        kind: locale === "zh" ? "Factory PairCreated" : "Factory PairCreated",
        tags: ["NEW", "ARC", "DAY1"],
        title: shortAddr(pair),
        body: `pad ${shortAddr(factoryAddr)} · pair ${shortAddr(pair)} · ${shortAddr(token0)}/${shortAddr(token1)} · #${bn}`,
        address: pair || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "ARC",
        metric: shortAddr(token0),
        metricLabel: "token0",
        metric2: shortAddr(token1),
        metric2Label: "token1",
      });
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
      if (rec.swapCount >= min || rec.swapCount === 1 || rec.swapCount % 2 === 0) {
        pushEvent({
          kind: locale === "zh" ? "早期 Swap 密度" : "Early Swap density",
          tags: ["DENS", "ARC"],
          title: shortAddr(pair),
          body: `swaps ${rec.swapCount} · thr ≥${min} · #${bn}`,
          address: pair,
          block: bn,
          tx: String(r.transactionHash || "") || undefined,
          chain: "ARC",
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
    const f = fields.current.factory.trim().toLowerCase();
    const tp = fields.current.topicPair.trim().toLowerCase();
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
    const wss = epRef.current.wss.trim();
    if (!wss) {
      setStatus("idle");
      wantRun.current = false;
      return;
    }
    setStatus("connecting");
    const ws = new WebSocket(wss);
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
    // Auto-live only when Arc WSS is filled; otherwise stay idle with placeholder hint.
    if (ep.wss.trim()) resume();
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
    { label: t(locale, "arc.factoryLabel"), value: factory.trim() || (locale === "zh" ? "（待填）" : "(unset)"), mono: true },
    { label: "PairCreated", value: subPair ? "on" : "off" },
    { label: "Swap dens", value: subSwap ? "on" : "off" },
    { label: locale === "zh" ? "尖刺阈值" : "Dens thr", value: `≥${minSwaps}` },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "arc.day1.factory" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "paircreated+swap-density" },
    { k: "WSS", v: ep.wss || (locale === "zh" ? "（空 · 待上线）" : "(empty · pending live)") },
    { k: "HTTPS", v: ep.https || (locale === "zh" ? "（空 · 待上线）" : "(empty · pending live)") },
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
  const { tipAt } = useTipHeartbeat({ https: ep.https, enabled: runningLive && !!ep.https.trim() });

  const settings = (
    <div className="space-y-3">
      <div className="border border-[rgba(255,209,102,0.35)] bg-[rgba(255,209,102,0.08)] px-3 py-2 text-xs text-[var(--color-warn)]">
        {t(locale, "arc.endpointHint")}
      </div>
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
            <CardTitle>{t(locale, "arc.factoryLabel")}</CardTitle>
            <CardDescription>
              {locale === "zh"
                ? "预埋 LAUNCHPAD_FACTORY + PairCreated topic0。命中 pair 后可窄听 Swap 密度。"
                : "Pre-wire LAUNCHPAD_FACTORY + PairCreated topic0. Optional narrow Swap density on hit pair."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="arc-factory">{t(locale, "arc.factoryLabel")}</Label>
              <Input
                id="arc-factory"
                placeholder="0x…"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="arc-min">{locale === "zh" ? "最少换手数" : "Min early swaps"}</Label>
                <Input id="arc-min" value={minSwaps} onChange={(e) => setMinSwaps(e.target.value)} onBlur={saveFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="arc-win">{locale === "zh" ? "窗口（秒）" : "Window (sec)"}</Label>
                <Input id="arc-win" value={windowSec} onChange={(e) => setWindowSec(e.target.value)} onBlur={saveFields} />
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
              <Label htmlFor="arc-tp">PAIR_CREATED_TOPIC0</Label>
              <Input id="arc-tp" value={topicPair} onChange={(e) => setTopicPair(e.target.value)} onBlur={saveFields} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="arc-ts">Swap topic0</Label>
              <Input id="arc-ts" value={topicSwap} onChange={(e) => setTopicSwap(e.target.value)} onBlur={saveFields} />
            </div>
            <label className="inline-flex items-center gap-2 border border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.06)] px-2.5 py-2 text-sm text-[var(--color-warn)]">
              <input type="checkbox" checked={demoHits} onChange={(e) => setDemoHits(e.target.checked)} className="h-4 w-4" />
              {t(locale, "demoHits.toggle")}
            </label>
            <p className="break-all font-mono text-[11px] text-[var(--color-muted-foreground)]">
              {ep.wss || "ARC_WSS=''"} · {ep.chainIdHex}
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
        title={t(locale, "arc.title")}
        tag={t(locale, "arc.tag")}
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
        guide={t(locale, "arc.guide")}
        watching={t(locale, "arc.watching")}
        hint={t(locale, "arc.hint")}
        emptyTitle={t(locale, "arc.emptyTitle")}
        emptySub={t(locale, "arc.emptySub")}
        latestLabel={t(locale, "arc.latest")}
        chainBadge="Arc"
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
              const nextWss = ep.draftWss.trim();
              const nextHttps = ep.draftHttps.trim();
              ep.commit();
              epRef.current = {
                ...epRef.current,
                wss: nextWss,
                https: nextHttps,
                draftWss: nextWss,
                draftHttps: nextHttps,
              };
              if (nextWss) {
                wantRun.current = true;
                try {
                  wsRef.current?.close();
                } catch {
                  /* ignore */
                }
                connect();
              } else {
                wantRun.current = false;
                try {
                  wsRef.current?.close();
                } catch {
                  /* ignore */
                }
                setStatus("idle");
              }
            }}
            onReset={() => {
              ep.reset();
              wantRun.current = false;
              try {
                wsRef.current?.close();
              } catch {
                /* ignore */
              }
              setStatus("idle");
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
