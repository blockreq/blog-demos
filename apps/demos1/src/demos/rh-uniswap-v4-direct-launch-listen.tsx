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
import { isAddr, shortAddr, unpadTopic } from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildRhV4DirectFixtures, useDemoHits } from "../lib/demo-hits";
import { mapInitializeLogs, useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Uniswap v4 PoolManager Initialize — same topic0 as Base / canonical v4. */
const TOPIC_INIT =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";
/** Optional related signal: ModifyLiquidity (first LP after direct init). */
const TOPIC_MODIFY_LIQ =
  "0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec";
/**
 * RH Uniswap v4 PoolManager (chain 4663) — documented across Uniswap sdk-core /
 * UniswapX playbook / bags.fm. Editable in Advanced if RH redeploys.
 */
const DEFAULT_PM = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
const LS = "blockreq.rh-uniswap-v4-direct.";
const SLUG = "rh-uniswap-v4-direct-launch-listen";

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

/**
 * RH V4 直开雷达 — PoolManager Initialize only (no bonding / Pons curve).
 * Layout: launch-feed (AnonStreamLayout). Catalog "radar" is the discovery wall,
 * not a product shell — continuous Initialize stream fits launch-feed.
 */
export function RhUniswapV4DirectDemo({ locale }: { locale: Locale }) {
  const [poolManager, setPoolManager] = useState(DEFAULT_PM);
  const [topicInit, setTopicInit] = useState(TOPIC_INIT);
  const [topicLiq, setTopicLiq] = useState(TOPIC_MODIFY_LIQ);
  const [subInit, setSubInit] = useState(true);
  const [subLiq, setSubLiq] = useState(true);
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

  const seedEvents = useMemo(() => buildRhV4DirectFixtures(locale, 6), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: poolManager.trim() || DEFAULT_PM,
    topics: [topicInit],
    map: (logs) => mapInitializeLogs(logs, locale, "RH"),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const fields = useRef({ poolManager, topicInit, topicLiq, subInit, subLiq });
  fields.current = { poolManager, topicInit, topicLiq, subInit, subLiq };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildRhV4DirectFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const pm = localStorage.getItem(LS + "poolManager");
      const ti = localStorage.getItem(LS + "topicInit");
      const tl = localStorage.getItem(LS + "topicLiq");
      if (pm) setPoolManager(pm);
      if (ti) setTopicInit(ti);
      if (tl) setTopicLiq(tl);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "poolManager", fields.current.poolManager.trim() || DEFAULT_PM);
      localStorage.setItem(LS + "topicInit", fields.current.topicInit.trim());
      localStorage.setItem(LS + "topicLiq", fields.current.topicLiq.trim());
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

  const onInitialize = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const poolId = topics[1] || "";
      const currency0 = unpadTopic(topics[2]);
      const currency1 = unpadTopic(topics[3]);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      pushEvent({
        kind: locale === "zh" ? "V4 直开" : "V4 direct open",
        tags: ["NEW", "V4", "DIRECT", "RH"],
        title: shortAddr(poolId),
        body: `${shortAddr(currency0)} / ${shortAddr(currency1)} · #${bn}`,
        address: poolId || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "RH",
        metric: shortAddr(currency0),
        metricLabel: "c0",
        metric2: shortAddr(currency1),
        metric2Label: "c1",
      });
    },
    [locale, pushEvent]
  );

  const onModifyLiq = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const poolId = topics[1] || "";
      const sender = unpadTopic(topics[2]);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      pushEvent({
        kind: locale === "zh" ? "流动性到位" : "Liquidity in",
        tags: ["LP", "V4", "DIRECT", "RH"],
        title: shortAddr(poolId),
        body: `sender ${shortAddr(sender)} · #${bn}`,
        address: poolId || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "RH",
        metric: shortAddr(sender),
        metricLabel: "sender",
        metric2: `#${bn}`,
        metric2Label: locale === "zh" ? "区块" : "Block",
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
      if (t0 === fields.current.topicLiq.trim().toLowerCase()) return onModifyLiq(r);
    },
    [onInitialize, onModifyLiq]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const pm = (fields.current.poolManager.trim() || DEFAULT_PM).toLowerCase();
    const ti = fields.current.topicInit.trim().toLowerCase();
    const tl = fields.current.topicLiq.trim().toLowerCase();
    if (fields.current.subInit) {
      const filt: { topics: string[]; address?: string } = { topics: [ti] };
      if (isAddr(pm)) filt.address = pm;
      send("eth_subscribe", ["logs", filt]);
    }
    if (fields.current.subLiq) {
      const filt: { topics: string[]; address?: string } = { topics: [tl] };
      if (isAddr(pm)) filt.address = pm;
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
    { label: "PoolManager", value: shortAddr(poolManager) || poolManager, mono: true },
    { label: "Init", value: subInit ? "on" : "off" },
    { label: "ModifyLiq", value: subLiq ? "on" : "off" },
    { label: "Mode", value: locale === "zh" ? "直开 · 无 bonding" : "direct · no bonding" },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "rh.uniswap.v4.direct" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "v4-initialize" },
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
            <CardTitle>{locale === "zh" ? "PoolManager / topics" : "PoolManager / topics"}</CardTitle>
            <CardDescription>
              {locale === "zh"
                ? "听 Uniswap v4 Initialize（直开，无 bonding/Pons 曲线）。PoolManager 可改。"
                : "Listen Uniswap v4 Initialize (direct pool open — no bonding/Pons curve). PoolManager editable."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rh-pm">PoolManager</Label>
              <Input
                id="rh-pm"
                value={poolManager}
                onChange={(e) => setPoolManager(e.target.value)}
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
                <input type="checkbox" checked={subLiq} onChange={(e) => setSubLiq(e.target.checked)} className="h-4 w-4" />
                ModifyLiquidity
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rh-ti">Initialize topic0</Label>
              <Input id="rh-ti" value={topicInit} onChange={(e) => setTopicInit(e.target.value)} onBlur={saveFields} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rh-tl">ModifyLiquidity topic0</Label>
              <Input id="rh-tl" value={topicLiq} onChange={(e) => setTopicLiq(e.target.value)} onBlur={saveFields} />
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
        title={t(locale, "rhv4.title")}
        tag={t(locale, "rhv4.tag")}
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
        guide={t(locale, "rhv4.guide")}
        watching={t(locale, "rhv4.watching")}
        hint={t(locale, "rhv4.hint")}
        emptyTitle={t(locale, "rhv4.emptyTitle")}
        emptySub={t(locale, "rhv4.emptySub")}
        latestLabel={t(locale, "rhv4.latest")}
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
