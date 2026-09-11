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
import { buildBrewDoublePairFixtures, useDemoHits } from "../lib/demo-hits";
import { mapPairCreatedLogs, useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Uniswap V2 / Pancake-style PairCreated — editable for Brew factory ABI. */
const TOPIC_PAIR =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
/** Editable sample — PancakeSwap V2 factory on BSC; replace with Brew launch factory. */
const DEFAULT_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const DEFAULT_CAP = "69000";
const DEFAULT_QUOTES =
  "# editable quote hints (SYMBOL 0xaddr)\nWBNB 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c\nUSDT 0x55d398326f99059fF775485246999027B3197955\nUSDC 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const LS = "blockreq.brew-bnb-double-pair.";
const SLUG = "brew-bnb-double-pair-listen";

type TwinRec = {
  launchId: string;
  token: string;
  pools: string[];
  quotes: string[];
  token0: string;
  token1: string;
  capUsd: string;
  txHash: string;
  block: number;
  twinReady: boolean;
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
 * Brew BNB same-cap twin-pool PairCreated listen.
 * Layout: launch-feed — continuous twin progress + sticky twinReady card.
 */
export function BrewBnbDoublePairDemo({ locale }: { locale: Locale }) {
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [topicPair, setTopicPair] = useState(TOPIC_PAIR);
  const [capUsd, setCapUsd] = useState(DEFAULT_CAP);
  const [quoteHint, setQuoteHint] = useState(DEFAULT_QUOTES);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "bsc");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildBrewDoublePairFixtures(locale, 6), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || undefined,
    topics: [topicPair],
    map: (logs) => mapPairCreatedLogs(logs, locale, "BSC"),
    enabled: !!ep.https.trim() && isAddr(factory.trim()),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const twins = useRef(new Map<string, TwinRec>());
  const twinEmitted = useRef(new Set<string>());
  const quoteMap = useRef(new Map<string, string>());
  const fields = useRef({ factory, topicPair, capUsd, quoteHint });
  fields.current = { factory, topicPair, capUsd, quoteHint };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildBrewDoublePairFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LS + "factory");
      const c = localStorage.getItem(LS + "capUsd");
      const q = localStorage.getItem(LS + "quoteHint");
      const tp = localStorage.getItem(LS + "topicPair");
      if (f) setFactory(f);
      if (c) setCapUsd(c);
      if (q) setQuoteHint(q);
      if (tp) setTopicPair(tp);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim() || DEFAULT_FACTORY);
      localStorage.setItem(LS + "capUsd", fields.current.capUsd.trim() || DEFAULT_CAP);
      localStorage.setItem(LS + "quoteHint", fields.current.quoteHint);
      localStorage.setItem(LS + "topicPair", fields.current.topicPair.trim());
      quoteMap.current = parseQuoteHint(fields.current.quoteHint);
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
      const pair = wordAddr(r.data as string, 0).toLowerCase();
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "").toLowerCase();
      if (!pair) return;

      const q0 = quoteMap.current.get(token0);
      const q1 = quoteMap.current.get(token1);
      // Prefer non-quote side as launch token; fall back to token0.
      let launchToken = token0;
      let quoteSide = token1;
      let quoteSym = q1 || "";
      if (q0 && !q1) {
        launchToken = token1;
        quoteSide = token0;
        quoteSym = q0;
      } else if (!q0 && q1) {
        launchToken = token0;
        quoteSide = token1;
        quoteSym = q1;
      } else if (q0 && q1) {
        // Both quotes — keep token0 as launchKey for grouping by tx
        launchToken = token0;
        quoteSide = token1;
        quoteSym = q1;
      }

      // Group by launch token (same-cap twin pools share the launched token).
      const launchId = launchToken || tx;
      const cap = fields.current.capUsd.trim() || DEFAULT_CAP;
      let rec = twins.current.get(launchId);
      if (!rec) {
        rec = {
          launchId,
          token: launchToken,
          pools: [],
          quotes: [],
          token0,
          token1,
          capUsd: cap,
          txHash: tx,
          block: bn,
          twinReady: false,
        };
        twins.current.set(launchId, rec);
      }
      if (!rec.pools.includes(pair)) rec.pools.push(pair);
      if (quoteSide && !rec.quotes.includes(quoteSide)) rec.quotes.push(quoteSide);
      rec.token0 = token0;
      rec.token1 = token1;
      rec.txHash = tx || rec.txHash;
      rec.block = bn || rec.block;
      rec.capUsd = cap;
      rec.twinReady = rec.pools.length >= 2;

      const poolA = rec.pools[0] || "";
      const poolB = rec.pools[1] || "";
      const quoteChip = quoteSym || (quoteSide ? shortAddr(quoteSide) : "—");

      if (!rec.twinReady) {
        pushEvent({
          kind: locale === "zh" ? "双池进度" : "Twin progress",
          tags: ["PART", "BREW", "BSC", quoteChip].filter(Boolean),
          title: shortAddr(launchToken),
          body: `pad brew-double-pair · launch ${shortAddr(launchId)} · pools ${rec.pools.length}/2 · cap $${cap} · ${shortAddr(poolA)} · #${bn}`,
          address: launchToken || pair,
          block: bn,
          tx: tx || undefined,
          chain: "BSC",
          metric: `${rec.pools.length}/2`,
          metricLabel: locale === "zh" ? "池进度" : "Pools",
          metric2: `$${cap}`,
          metric2Label: "CAP_USD",
        });
        return;
      }

      const dedupeKey = `${launchId}:${[...rec.pools].sort().join("|")}`;
      if (twinEmitted.current.has(dedupeKey)) return;
      twinEmitted.current.add(dedupeKey);

      pushEvent({
        kind: locale === "zh" ? "双池齐听 twinReady" : "Twin ready",
        tags: ["TWIN", "READY", "BREW", "BSC", quoteChip].filter(Boolean),
        title: shortAddr(launchToken),
        body: `pad brew-double-pair · launchId ${shortAddr(launchId)} · token ${shortAddr(launchToken)} · capUsd $${cap} · poolA ${shortAddr(poolA)} · poolB ${shortAddr(poolB)} · ${shortAddr(token0)}/${shortAddr(token1)} · #${bn}`,
        address: launchToken || poolA,
        block: bn,
        tx: tx || undefined,
        chain: "BSC",
        metric: "twinReady",
        metricLabel: locale === "zh" ? "双池齐" : "Twin",
        metric2: `$${cap}`,
        metric2Label: "CAP_USD",
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
      if (t0 === fields.current.topicPair.trim().toLowerCase()) return onPairCreated(r);
    },
    [onPairCreated]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = (fields.current.factory.trim() || DEFAULT_FACTORY).toLowerCase();
    const tp = fields.current.topicPair.trim().toLowerCase();
    const filt: { topics: string[]; address?: string } = { topics: [tp] };
    if (isAddr(f)) filt.address = f;
    send("eth_subscribe", ["logs", filt]);
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
    { label: t(locale, "brew.factoryLabel"), value: factory.trim() || DEFAULT_FACTORY, mono: true },
    { label: "CAP_USD", value: `$${capUsd.trim() || DEFAULT_CAP}` },
    { label: locale === "zh" ? "报价提示" : "Quote hints", value: String(parseQuoteHint(quoteHint).size) },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "brew.double-pair" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "paircreated-twin-cap" },
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
  const { tipAt } = useTipHeartbeat({ https: ep.https, enabled: runningLive && !!ep.https.trim() });

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
            <CardTitle>{t(locale, "brew.factoryLabel")}</CardTitle>
            <CardDescription>{t(locale, "brew.factoryHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="brew-factory">{t(locale, "brew.factoryLabel")}</Label>
              <Input
                id="brew-factory"
                placeholder="0x…"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brew-cap">CAP_USD</Label>
              <Input
                id="brew-cap"
                value={capUsd}
                onChange={(e) => setCapUsd(e.target.value)}
                onBlur={saveFields}
                placeholder="69000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brew-quotes">{t(locale, "brew.quoteLabel")}</Label>
              <textarea
                id="brew-quotes"
                className="min-h-[96px] w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2.5 py-2 font-mono text-xs text-[var(--color-foreground)]"
                value={quoteHint}
                onChange={(e) => setQuoteHint(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
              <p className="text-[11px] text-[var(--color-muted-foreground)]">{t(locale, "brew.quoteHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brew-tp">PAIR_CREATED_TOPIC0</Label>
              <Input id="brew-tp" value={topicPair} onChange={(e) => setTopicPair(e.target.value)} onBlur={saveFields} />
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
        title={t(locale, "brew.title")}
        tag={t(locale, "brew.tag")}
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
        guide={t(locale, "brew.guide")}
        watching={t(locale, "brew.watching")}
        hint={t(locale, "brew.hint")}
        emptyTitle={t(locale, "brew.emptyTitle")}
        emptySub={t(locale, "brew.emptySub")}
        latestLabel={t(locale, "brew.latest")}
        chainBadge="BSC"
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
