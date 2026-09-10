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
import { OpenWaitLayout } from "../components/layouts/open-wait-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildPonsFixtures, useDemoHits } from "../lib/demo-hits";
import { mapTokenLaunchedLogs, useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

const DEFAULT_FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const TOKEN_LAUNCHED =
  "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const POOL_GRADUATED =
  "0x0a44ef75df69c534f43cd6c1aa3ef8983065fe5fe79ef9e79f6494e6f258c259";
const LS = "blockreq.pons-launchpad.";
const SLUG = "pons-launchpad-listen";

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

export function PonsLaunchpadDemo({ locale }: { locale: Locale }) {
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [subLaunch, setSubLaunch] = useState(true);
  const [subGrad, setSubGrad] = useState(true);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "robinhood");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildPonsFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || DEFAULT_FACTORY,
    topics: [TOKEN_LAUNCHED],
    map: (logs) => mapTokenLaunchedLogs(logs, locale, "RH"),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const fields = useRef({ factory, subLaunch, subGrad });
  fields.current = { factory, subLaunch, subGrad };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 40));
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildPonsFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 40));
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LS + "factory");
      if (f) setFactory(f);
      const g = localStorage.getItem(LS + "subGrad");
      if (g != null) setSubGrad(g === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim() || DEFAULT_FACTORY);
      localStorage.setItem(LS + "subGrad", fields.current.subGrad ? "1" : "0");
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

  const onTokenLaunched = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const token = unpadTopic(topics[1]);
      const curve = unpadTopic(topics[2]);
      const deployer = unpadTopic(topics[3]);
      const pairToken = wordAddr(r.data as string, 0);
      const configId = wordU256(r.data as string, 1);
      const threshold = wordU256(r.data as string, 2);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      pushEvent({
        kind: locale === "zh" ? "Pons 发射" : "Pons launch",
        tags: ["NEW", "PONS", "RH"],
        title: shortAddr(token),
        body: `deployer ${shortAddr(deployer)} · curve ${shortAddr(curve)} · pair ${shortAddr(pairToken)} · cfg ${configId.toString()} · thr ${threshold.toString()} · #${bn}`,
        address: token || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "RH",
        metric: shortAddr(curve),
        metricLabel: "curve",
        metric2: `#${bn}`,
        metric2Label: locale === "zh" ? "区块" : "Block",
      });
    },
    [locale, pushEvent]
  );

  const onGraduated = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const token = unpadTopic(topics[1]);
      const positionId = wordU256(r.data as string, 0);
      const tokenAmt = wordU256(r.data as string, 1);
      const pairAmt = wordU256(r.data as string, 2);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      pushEvent({
        kind: locale === "zh" ? "Pons 毕业" : "Pons graduated",
        tags: ["GRAD", "PONS", "RH"],
        title: shortAddr(token),
        body: `pos ${positionId.toString()} · tokenAmt ${tokenAmt.toString()} · pairAmt ${pairAmt.toString()} · #${bn}`,
        address: token || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "RH",
        metric: shortAddr(token),
        metricLabel: "token",
        metric2: `#${bn}`,
        metric2Label: locale === "zh" ? "区块" : "Block",
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
      if (t0 === TOKEN_LAUNCHED) return onTokenLaunched(r);
      if (t0 === POOL_GRADUATED) return onGraduated(r);
    },
    [onGraduated, onTokenLaunched]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = (fields.current.factory.trim() || DEFAULT_FACTORY).toLowerCase();
    if (!isAddr(f)) {
      setStatus("error");
      return;
    }
    if (fields.current.subLaunch) {
      send("eth_subscribe", ["logs", { address: f, topics: [TOKEN_LAUNCHED] }]);
    }
    if (fields.current.subGrad) {
      send("eth_subscribe", ["logs", { address: f, topics: [POOL_GRADUATED] }]);
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
      setStatus("error");
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
    { label: t(locale, "pons.factoryLabel"), value: factory.trim() || DEFAULT_FACTORY, mono: true },
    { label: "TokenLaunched", value: subLaunch ? "on" : "off" },
    { label: "PoolGraduated", value: subGrad ? "on" : "off" },
    { label: "Topic0", value: shortAddr(TOKEN_LAUNCHED), mono: true },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "pons.rh / launchpad" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "pons-listen" },
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
            <CardTitle>{t(locale, "pons.factoryLabel")}</CardTitle>
            <CardDescription>
              {locale === "zh"
                ? "默认 Pons V2 工厂；可改。可选同时听 PoolGraduated。"
                : "Default Pons V2 factory; editable. Optional PoolGraduated."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pons-factory">{t(locale, "pons.factoryLabel")}</Label>
              <Input
                id="pons-factory"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subLaunch} onChange={(e) => setSubLaunch(e.target.checked)} className="h-4 w-4" />
                TokenLaunched
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subGrad} onChange={(e) => setSubGrad(e.target.checked)} className="h-4 w-4" />
                {t(locale, "pons.gradOpt")}
              </label>
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
    <div className="flex min-h-screen flex-col pb-24" data-layout="single-focus">
      <MonitorChrome
        lastUpdateAt={lastUpdateAt}
        locale={locale}
        title={t(locale, "pons.title")}
        tag={t(locale, "pons.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
        blogUrl={demoBlogUrl(SLUG, locale)}
        siteUrl={demoSiteUrl(getDemo(SLUG))}
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
        guide={t(locale, "pons.guide")}
        watching={t(locale, "pons.watching")}
        stripTitle={t(locale, "pons.stripTitle")}
        stripSub={t(locale, "pons.stripSub")}
        stageIdle={t(locale, "pons.stageIdle")}
        stageConn={t(locale, "pons.stageConn")}
        stageListen={t(locale, "pons.stageListen")}
        stageHit={t(locale, "pons.stageHit")}
        heroIdle={t(locale, "pons.hero.idle")}
        heroConnecting={t(locale, "pons.hero.connecting")}
        heroListening={t(locale, "pons.hero.listening")}
        heroHit={t(locale, "pons.hero.hit")}
        recentTitle={t(locale, "pons.recent")}
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
                try { wsRef.current?.close(); } catch { /* ignore */ }
                connect();
              }
            }}
            onReset={() => {
              ep.reset();
              if (wantRun.current) {
                try { wsRef.current?.close(); } catch { /* ignore */ }
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
