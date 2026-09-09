import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
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
import {
  PUBLIC_ENDPOINTS,
  isAddr,
  shortAddr,
  unpadTopic,
  wordAddr,
  wordU256,
} from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildAnonFixtures, useDemoHits } from "../lib/demo-hits";
import { mapPairCreatedLogs, useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";

const EP = PUBLIC_ENDPOINTS.robinhood;
const WSS = EP.wss;
const CHAIN_ID = EP.chainIdHex;
const MINT =
  "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f";
const DEFAULT_PAIR_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const LS = "blockreq.anoncoin-rh.";
const SLUG = "anoncoin-rh-launch-listen";

type PairRec = {
  token0: string;
  token1: string;
  baseSide: string;
  quote: string;
  block: number;
  tx?: string;
  firstLp: boolean;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

export function AnoncoinDemo({ locale }: { locale: Locale }) {
  const [factory, setFactory] = useState("");
  const [quote, setQuote] = useState("");
  const [topicPair, setTopicPair] = useState(DEFAULT_PAIR_TOPIC);
  const [subPair, setSubPair] = useState(true);
  const [subMint, setSubMint] = useState(true);
  const [onlyQuote, setOnlyQuote] = useState(false);
  const [minLiq, setMinLiq] = useState("0");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });

  const seedEvents = useMemo(() => buildAnonFixtures(locale, 6), [locale]);
  const history = useRecentHistory({
    locale,
    https: EP.https,
    address: factory.trim() || undefined,
    topics: [topicPair],
    map: (logs) => mapPairCreatedLogs(logs, locale, "RH"),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const pairs = useRef(new Map<string, PairRec>());
  const fields = useRef({ factory, quote, topicPair, subPair, subMint, onlyQuote, minLiq });
  fields.current = { factory, quote, topicPair, subPair, subMint, onlyQuote, minLiq };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildAnonFixtures(locale, 4);
    for (const ev of fixtures) {
      setEvents((prev) => [ev, ...prev].slice(0, 80));
    }
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      setFactory(localStorage.getItem(LS + "factory") || "");
      setQuote(localStorage.getItem(LS + "quote") || "");
      const tp = localStorage.getItem(LS + "topicPair");
      if (tp) setTopicPair(tp);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "quote", fields.current.quote.trim());
      localStorage.setItem(LS + "topicPair", fields.current.topicPair.trim());
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
      const q = fields.current.quote.trim().toLowerCase();
      const topics = (r.topics as string[]) || [];
      const token0 = unpadTopic(topics[1]);
      const token1 = unpadTopic(topics[2]);
      const pair = wordAddr(r.data as string, 0);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const hit0 = !!q && token0 === q;
      const hit1 = !!q && token1 === q;
      const quoteHit = hit0 || hit1;
      if (!quoteHit && fields.current.onlyQuote) return;

      const baseSide = hit0 ? token1 : hit1 ? token0 : "";
      const tags = ["NEW", "ANON"];
      if (quoteHit) tags.push("QUOTE");
      const rec: PairRec = {
        token0,
        token1,
        baseSide,
        quote: quoteHit ? q : "",
        block: bn,
        tx: String(r.transactionHash || ""),
        firstLp: false,
      };
      if (pair) pairs.current.set(pair.toLowerCase(), rec);
      pushEvent({
        kind: locale === "zh" ? "新开盘" : "New launch",
        tags,
        title: shortAddr(pair),
        body: `${shortAddr(baseSide || "?")} · #${bn}`,
        address: pair || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "RH",
      });
    },
    [locale, pushEvent]
  );

  const onMint = useCallback(
    (r: Record<string, unknown>) => {
      const pool = String(r.address || "").toLowerCase();
      const known = pairs.current.get(pool);
      if (!known || known.firstLp) return;
      const a0 = wordU256(r.data as string, 0);
      const a1 = wordU256(r.data as string, 1);
      const minRaw = BigInt(Math.floor(Number(fields.current.minLiq || 0) * 1e18));
      if (minRaw > 0n && a0 + a1 < minRaw) return;
      known.firstLp = true;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      pushEvent({
        kind: locale === "zh" ? "LP 到位" : "LP ready",
        tags: ["LP"],
        title: shortAddr(pool),
        body: `#${bn}`,
        address: pool,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "RH",
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
      const topic = fields.current.topicPair.trim().toLowerCase();
      if (t0 === topic) return onPairCreated(r);
      if (t0 === MINT) return onMint(r);
    },
    [onMint, onPairCreated]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = fields.current.factory.trim();
    const topic = fields.current.topicPair.trim().toLowerCase();
    const factoryOk = isAddr(f);
    if (fields.current.subPair) {
      const filt: { topics: string[]; address?: string } = { topics: [topic] };
      if (factoryOk) filt.address = f.toLowerCase();
      send("eth_subscribe", ["logs", filt]);
    }
    if (fields.current.subMint) {
      send("eth_subscribe", ["logs", { topics: [MINT] }]);
    }
    setStatus("listening");
  }, []);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    setStatus("connecting");
    const ws = new WebSocket(WSS);
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
    const q = fields.current.quote.trim();
    if (fields.current.onlyQuote && !isAddr(q)) {
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

  // Live on by default at first paint
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

  // Dense idle: pre-select first seed / history row for right panel
  useEffect(() => {
    if (selectedId) return;
    const pool = events.length ? events : history.events.length ? history.events : seedEvents;
    if (pool[0]) setSelectedId(pool[0].id);
  }, [events, history.events, seedEvents, selectedId]);

  const running = status === "connecting" || status === "listening";
  const watchParams = [
    { label: "Factory", value: factory.trim() || (locale === "zh" ? "（宽听 · 未限定）" : "(wide · unset)") },
    { label: "Topic0", value: topicPair, mono: true },
    { label: "Mint", value: shortAddr(MINT), mono: true },
    { label: "Quote", value: quote.trim() || (locale === "zh" ? "任意" : "any") },
    { label: "Pair", value: subPair ? "on" : "off" },
    { label: "LP", value: subMint ? "on" : "off" },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "anoncoin.rh / stream" },
    { k: "CHAIN", v: EP.label },
    { k: "METHOD", v: "launch-watch" },
    { k: "WSS", v: WSS },
    { k: "HTTPS", v: EP.https },
  ];

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
            <CardTitle>{locale === "zh" ? "可选参数" : "Optional knobs"}</CardTitle>
            <CardDescription>
              {locale === "zh"
                ? "一般不用改。粘贴工厂地址可更安静。"
                : "Leave empty for the default wide listen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="factory">Factory</Label>
              <Input id="factory" placeholder="0x…" value={factory} onChange={(e) => setFactory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote">Quote token</Label>
              <Input id="quote" placeholder="0x…" value={quote} onChange={(e) => setQuote(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subPair} onChange={(e) => setSubPair(e.target.checked)} className="h-4 w-4" />
                Pair open
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subMint} onChange={(e) => setSubMint(e.target.checked)} className="h-4 w-4" />
                LP ready
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={onlyQuote} onChange={(e) => setOnlyQuote(e.target.checked)} className="h-4 w-4" />
                Quote only
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic0</Label>
              <Input id="topic" value={topicPair} onChange={(e) => setTopicPair(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minLiq">Min LP (×1e18)</Label>
              <Input id="minLiq" type="number" min={0} step="0.01" value={minLiq} onChange={(e) => setMinLiq(e.target.value)} />
            </div>

            <label className="inline-flex items-center gap-2 border border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.06)] px-2.5 py-2 text-sm text-[var(--color-warn)]">
              <input
                type="checkbox"
                checked={demoHits}
                onChange={(e) => setDemoHits(e.target.checked)}
                className="h-4 w-4"
              />
              {t(locale, "demoHits.toggle")}
              <span className="font-mono text-[10px] opacity-80">?demoHits=1</span>
            </label>

            <p className="break-all font-mono text-[11px] text-[var(--color-muted-foreground)]">
              {WSS} · {CHAIN_ID}
            </p>
          </CardContent>
        </Card>
      </SettingsPanel>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col pb-24" data-layout="anon">
      <MonitorChrome
        locale={locale}
        title={t(locale, "anoncoin.title")}
        tag={t(locale, "anoncoin.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
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
        endpointSlot={<EndpointBar locale={locale} wss={WSS} https={EP.https} chainLabel={EP.label} />}
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
