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
import { buildCronosLaunchpadFixtures, useDemoHits } from "../lib/demo-hits";
import { mapPairCreatedLogs, useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Empty — paste LAUNCHPAD_FACTORY when official announcement posts. No invented address. */
const DEFAULT_FACTORY = "";
const TOPIC_PAIR =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const TOPIC_MINT =
  "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f";
const TOPIC_TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_QUOTE_HINT =
  "# QUOTE_HINT — SYMBOL 0xaddr (optional)\nWCRO 0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23";
const LS = "blockreq.cronos-app-launchpad.";
const SLUG = "cronos-app-launchpad-listen";

type PairRec = {
  pair: string;
  token0: string;
  token1: string;
  factory: string;
  createdBlock: number;
  firstMintTx?: string;
  amount0?: string;
  amount1?: string;
};

function parseQuoteHint(text: string) {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    let sym = "";
    let addr = "";
    for (const p of parts) {
      if (/^0x[a-fA-F0-9]{40}$/.test(p)) addr = p.toLowerCase();
      else if (!sym) sym = p;
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
 * Cronos launchpad listen — PairCreated on pasteable LAUNCHPAD_FACTORY,
 * then narrow Mint + Transfer on decoded pair (first-liquidity).
 * Layout: single-focus OpenWaitLayout.
 */
export function CronosAppLaunchpadDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [topicPair, setTopicPair] = useState(TOPIC_PAIR);
  const [topicMint, setTopicMint] = useState(TOPIC_MINT);
  const [quoteHint, setQuoteHint] = useState(DEFAULT_QUOTE_HINT);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "cronos");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildCronosLaunchpadFixtures(locale, 5), [locale]);
  const factoryOk = isAddr(factory.trim());
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || undefined,
    topics: [topicPair],
    map: (logs) => mapPairCreatedLogs(logs, locale, "CRO"),
    enabled: factoryOk && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const pairs = useRef(new Map<string, PairRec>());
  const fields = useRef({ factory, topicPair, topicMint, quoteHint });
  fields.current = { factory, topicPair, topicMint, quoteHint };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 40));
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildCronosLaunchpadFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 40));
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LS + "factory");
      const tp = localStorage.getItem(LS + "topicPair");
      const tm = localStorage.getItem(LS + "topicMint");
      const qh = localStorage.getItem(LS + "quoteHint");
      if (f) setFactory(f);
      if (tp) setTopicPair(tp);
      if (tm) setTopicMint(tm);
      if (qh) setQuoteHint(qh);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "topicPair", fields.current.topicPair.trim() || TOPIC_PAIR);
      localStorage.setItem(LS + "topicMint", fields.current.topicMint.trim() || TOPIC_MINT);
      localStorage.setItem(LS + "quoteHint", fields.current.quoteHint);
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

  const labelToken = (addr: string) => {
    const hints = parseQuoteHint(fields.current.quoteHint);
    return hints.get(addr.toLowerCase()) || shortAddr(addr);
  };

  const onPairCreated = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const token0 = unpadTopic(topics[1]);
      const token1 = unpadTopic(topics[2]);
      const pair = wordAddr(r.data as string, 0);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const factoryAddr = String(r.address || fields.current.factory).toLowerCase();
      if (!pair || !isAddr(pair)) return;
      const rec: PairRec = {
        pair: pair.toLowerCase(),
        token0,
        token1,
        factory: factoryAddr,
        createdBlock: bn,
      };
      pairs.current.set(rec.pair, rec);
      // Narrow: Mint + Transfer on decoded pair
      send("eth_subscribe", [
        "logs",
        { address: rec.pair, topics: [fields.current.topicMint.trim().toLowerCase() || TOPIC_MINT] },
      ]);
      send("eth_subscribe", [
        "logs",
        { address: [token0, token1].filter(isAddr), topics: [TOPIC_TRANSFER] },
      ]);
      pushEvent({
        kind: locale === "zh" ? "池子开了" : "Pool open",
        tags: ["NEW", "CRO", "LAUNCHPAD", "pad:app-launchpad"],
        title: shortAddr(pair),
        body: `pad:app-launchpad · factory ${shortAddr(factoryAddr)} · ${labelToken(token0)} / ${labelToken(token1)} · #${bn}`,
        address: pair,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "CRO",
        metric: labelToken(token0),
        metricLabel: "token0",
        metric2: labelToken(token1),
        metric2Label: "token1",
      });
    },
    [locale, pushEvent]
  );

  const onMint = useCallback(
    (r: Record<string, unknown>) => {
      const pair = String(r.address || "").toLowerCase();
      const rec = pairs.current.get(pair);
      if (!rec) return;
      const amount0 = wordU256(r.data as string, 0);
      const amount1 = wordU256(r.data as string, 1);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const isFirst = !rec.firstMintTx;
      if (isFirst) {
        rec.firstMintTx = tx;
        rec.amount0 = amount0.toString();
        rec.amount1 = amount1.toString();
      }
      pushEvent({
        kind: isFirst
          ? locale === "zh"
            ? "首流动性"
            : "First liquidity"
          : locale === "zh"
            ? "Mint"
            : "Mint",
        tags: isFirst ? ["FIRST", "MINT", "CRO", "LAUNCHPAD"] : ["MINT", "CRO"],
        title: shortAddr(pair),
        body: `pad:app-launchpad · pair ${shortAddr(pair)} · ${labelToken(rec.token0)}=${amount0.toString()} · ${labelToken(rec.token1)}=${amount1.toString()} · firstMintTx ${shortAddr(tx)} · #${bn}`,
        address: pair,
        block: bn,
        tx: tx || undefined,
        chain: "CRO",
        metric: amount0.toString(),
        metricLabel: "amount0",
        metric2: amount1.toString(),
        metric2Label: "amount1",
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
      if (t0 === fields.current.topicPair.trim().toLowerCase()) return onPairCreated(r);
      if (t0 === (fields.current.topicMint.trim().toLowerCase() || TOPIC_MINT)) return onMint(r);
      // Transfer on tokens — light signal only (early buyer tape; not a card flood)
      if (t0 === TOPIC_TRANSFER) {
        const to = unpadTopic(((r.topics as string[]) || [])[2]);
        const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
        if (!to) return;
        // Only emit sparse transfer chips when we already have a tracked pair context
        if (pairs.current.size === 0) return;
        pushEvent({
          kind: locale === "zh" ? "早期转账" : "Early transfer",
          tags: ["XFER", "CRO"],
          title: shortAddr(to),
          body: `token ${shortAddr(String(r.address || ""))} → ${shortAddr(to)} · #${bn}`,
          address: String(r.address || "") || undefined,
          block: bn,
          tx: String(r.transactionHash || "") || undefined,
          chain: "CRO",
          metric: shortAddr(to),
          metricLabel: "to",
          metric2: `#${bn}`,
          metric2Label: locale === "zh" ? "区块" : "Block",
        });
      }
    },
    [locale, onMint, onPairCreated, pushEvent]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = fields.current.factory.trim().toLowerCase();
    const tp = fields.current.topicPair.trim().toLowerCase() || TOPIC_PAIR;
    if (!isAddr(f)) {
      setStatus("error");
      return;
    }
    send("eth_subscribe", ["logs", { address: f, topics: [tp] }]);
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
    const f = fields.current.factory.trim();
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
    if (isAddr(factory.trim())) resume();
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
    {
      label: "LAUNCHPAD_FACTORY",
      value: factory.trim() || (locale === "zh" ? "（粘贴工厂）" : "(paste factory)"),
      mono: true,
    },
    { label: "PairCreated", value: shortAddr(topicPair), mono: true },
    { label: "Mint", value: shortAddr(topicMint), mono: true },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "cronos.app.launchpad" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "pair+first-mint" },
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
            <CardDescription>{t(locale, "cronos.factoryHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cro-factory">LAUNCHPAD_FACTORY</Label>
              <Input
                id="cro-factory"
                value={factory}
                placeholder="0x… (paste when announced)"
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cro-tp">PAIR_CREATED_TOPIC0</Label>
              <Input id="cro-tp" value={topicPair} onChange={(e) => setTopicPair(e.target.value)} onBlur={saveFields} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cro-tm">MINT_TOPIC0</Label>
              <Input id="cro-tm" value={topicMint} onChange={(e) => setTopicMint(e.target.value)} onBlur={saveFields} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cro-qh">QUOTE_HINT</Label>
              <textarea
                id="cro-qh"
                className="min-h-[72px] w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1.5 font-mono text-xs"
                value={quoteHint}
                onChange={(e) => setQuoteHint(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
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
        title={t(locale, "cronos.title")}
        tag={t(locale, "cronos.tag")}
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
        guide={t(locale, "cronos.guide")}
        watching={t(locale, "cronos.watching")}
        stripTitle={t(locale, "cronos.stripTitle")}
        stripSub={t(locale, "cronos.stripSub")}
        stageIdle={t(locale, "cronos.stageIdle")}
        stageConn={t(locale, "cronos.stageConn")}
        stageListen={t(locale, "cronos.stageListen")}
        stageHit={t(locale, "cronos.stageHit")}
        heroIdle={t(locale, "cronos.hero.idle")}
        heroConnecting={t(locale, "cronos.hero.connecting")}
        heroListening={t(locale, "cronos.hero.listening")}
        heroHit={t(locale, "cronos.hero.hit")}
        recentTitle={t(locale, "cronos.recent")}
        chainBadge="CRO"
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
