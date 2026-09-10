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
import {
  decodeEventLog,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbiItem,
  type Hex,
} from "viem";
import { MonitorChrome } from "../components/monitor-chrome";
import { OpenWaitLayout } from "../components/layouts/open-wait-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildBasketFixtures, useDemoHits } from "../lib/demo-hits";
import { mapBasketCreatedLogs, useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Sample BasketFactory from RH chain dapp walkthrough (editable — may be testnet-only). */
const DEFAULT_FACTORY = "0xC1940D5fd58ce735A44a53f910852B12250F6a14";
/** BasketCreated(address indexed basket, address indexed creator, string name, string symbol) */
const DEFAULT_TOPIC =
  "0x7ba33f470a1a1c7ac3ac4d836add99fb4116100ddd864beb383ef502e7519aaf";
const LS = "blockreq.rh-basket-factory.";
const SLUG = "rh-basket-factory-listen";

const BASKET_CREATED_ABI = parseAbiItem(
  "event BasketCreated(address indexed basket, address indexed creator, string name, string symbol)"
);
const COMPONENTS_ABI = parseAbiItem(
  "function components() view returns ((address token, address feed, uint256 unitsPerShare)[])"
);

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function decodeBasketCreated(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [BASKET_CREATED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      basket?: string;
      creator?: string;
      name?: string;
      symbol?: string;
    };
    return {
      basket: (args.basket || unpadTopic(topics[1]) || "").toLowerCase(),
      creator: (args.creator || unpadTopic(topics[2]) || "").toLowerCase(),
      name: args.name || "",
      symbol: args.symbol || "",
    };
  } catch {
    return {
      basket: unpadTopic(topics[1]),
      creator: unpadTopic(topics[2]),
      name: "",
      symbol: "",
    };
  }
}

async function fetchComponents(https: string, basket: string): Promise<string[]> {
  if (!https || !isAddr(basket)) return [];
  try {
    const data = encodeFunctionData({ abi: [COMPONENTS_ABI], functionName: "components" });
    const res = await fetch(https, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: basket, data }, "latest"],
      }),
    });
    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (!json.result || json.error) return [];
    const comps = decodeFunctionResult({
      abi: [COMPONENTS_ABI],
      functionName: "components",
      data: json.result as Hex,
    }) as { token: string; feed: string; unitsPerShare: bigint }[];
    return (comps || []).map((c) => String(c.token || "").toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function formatComponents(addrs: string[]) {
  if (!addrs.length) return "—";
  return addrs.map((a) => shortAddr(a)).join(" + ");
}

export function RhBasketFactoryDemo({ locale }: { locale: Locale }) {
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [topic0, setTopic0] = useState(DEFAULT_TOPIC);
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

  const seedEvents = useMemo(() => buildBasketFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || DEFAULT_FACTORY,
    topics: [topic0.trim() || DEFAULT_TOPIC],
    map: (logs) => mapBasketCreatedLogs(logs, locale, "RH"),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const fields = useRef({ factory, topic0 });
  fields.current = { factory, topic0 };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 40));
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildBasketFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 40));
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LS + "factory");
      if (f) setFactory(f);
      const tp = localStorage.getItem(LS + "topic0");
      if (tp) setTopic0(tp);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim() || DEFAULT_FACTORY);
      localStorage.setItem(LS + "topic0", fields.current.topic0.trim() || DEFAULT_TOPIC);
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

  const onBasketCreated = useCallback(
    async (r: Record<string, unknown>) => {
      const decoded = decodeBasketCreated(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const comps = decoded.basket
        ? await fetchComponents(epRef.current.https, decoded.basket)
        : [];
      const title =
        decoded.symbol || decoded.name
          ? `${decoded.symbol || "?"} · ${decoded.name || "?"}`
          : shortAddr(decoded.basket);
      const compsLabel = formatComponents(comps);
      pushEvent({
        kind: locale === "zh" ? "篮筐创建" : "Basket created",
        tags: ["NEW", "BASKET", "RH"],
        title,
        body: `basket ${shortAddr(decoded.basket)} · creator ${shortAddr(decoded.creator)} · comps ${compsLabel} · #${bn}`,
        address: decoded.basket || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "RH",
        metric: decoded.symbol || shortAddr(decoded.basket),
        metricLabel: locale === "zh" ? "符号" : "Symbol",
        metric2: compsLabel,
        metric2Label: locale === "zh" ? "成分" : "Components",
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
      const want = (fields.current.topic0.trim() || DEFAULT_TOPIC).toLowerCase();
      if (t0 === want) void onBasketCreated(r);
    },
    [onBasketCreated]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = (fields.current.factory.trim() || DEFAULT_FACTORY).toLowerCase();
    const topic = (fields.current.topic0.trim() || DEFAULT_TOPIC).toLowerCase();
    if (!isAddr(f) || !topic.startsWith("0x")) {
      setStatus("error");
      return;
    }
    send("eth_subscribe", ["logs", { address: f, topics: [topic] }]);
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
    { label: t(locale, "basket.factoryLabel"), value: factory.trim() || DEFAULT_FACTORY, mono: true },
    { label: "BasketCreated", value: "on" },
    { label: "Topic0", value: shortAddr(topic0.trim() || DEFAULT_TOPIC), mono: true },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "basket.rh / factory" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "basket-factory-listen" },
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
            <CardTitle>{t(locale, "basket.factoryLabel")}</CardTitle>
            <CardDescription>{t(locale, "basket.advancedHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="basket-factory">{t(locale, "basket.factoryLabel")}</Label>
              <Input
                id="basket-factory"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="basket-topic">BasketCreated topic0</Label>
              <Input
                id="basket-topic"
                value={topic0}
                onChange={(e) => setTopic0(e.target.value)}
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
        title={t(locale, "basket.title")}
        tag={t(locale, "basket.tag")}
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
        guide={t(locale, "basket.guide")}
        watching={t(locale, "basket.watching")}
        stripTitle={t(locale, "basket.stripTitle")}
        stripSub={t(locale, "basket.stripSub")}
        stageIdle={t(locale, "basket.stageIdle")}
        stageConn={t(locale, "basket.stageConn")}
        stageListen={t(locale, "basket.stageListen")}
        stageHit={t(locale, "basket.stageHit")}
        heroIdle={t(locale, "basket.hero.idle")}
        heroConnecting={t(locale, "basket.hero.connecting")}
        heroListening={t(locale, "basket.hero.listening")}
        heroHit={t(locale, "basket.hero.hit")}
        recentTitle={t(locale, "basket.recent")}
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
