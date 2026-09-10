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
import {
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
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildStockFixtures, useDemoHits } from "../lib/demo-hits";
import { mapPairCreatedLogs, useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

const MINT =
  "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f";
const PAIR_CREATED =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const LS = "blockreq.stock-pair-meme.";
const STOCKS_LS = "blockreq.rh-stock-pairs.stocks";
const SLUG = "stock-pair-meme-launch-listen";

type PairRec = {
  token0: string;
  token1: string;
  pairedAsset: string;
  memeSide: string;
  symbol: string;
  block: number;
  tx?: string;
  firstLp: boolean;
};

function parseStocks(text: string) {
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

export function StockPairDemo({ locale }: { locale: Locale }) {
  const [factory, setFactory] = useState("");
  const [stocksText, setStocksText] = useState("AAPL 0x1111111111111111111111111111111111111111\nTSLA 0x2222222222222222222222222222222222222222");
  const [subPair, setSubPair] = useState(true);
  const [subMint, setSubMint] = useState(true);
  const [onlyStock, setOnlyStock] = useState(true);
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

  const seedEvents = useMemo(() => buildStockFixtures(locale, 6), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: factory.trim() || undefined,
    topics: [PAIR_CREATED],
    map: (logs) => mapPairCreatedLogs(logs, locale, "RH"),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const pairs = useRef(new Map<string, PairRec>());
  const stockMap = useRef(new Map<string, string>());
  const fields = useRef({ factory, stocksText, subPair, subMint, onlyStock });
  fields.current = { factory, stocksText, subPair, subMint, onlyStock };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildStockFixtures(locale, 4);
    for (const ev of fixtures) {
      setEvents((prev) => [ev, ...prev].slice(0, 80));
    }
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      setFactory(localStorage.getItem(LS + "factory") || "");
      const raw = localStorage.getItem(STOCKS_LS) || localStorage.getItem(LS + "stocks");
      if (raw) setStocksText(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      const map = parseStocks(fields.current.stocksText);
      const lines: string[] = [];
      for (const [a, s] of map) lines.push(`${s} ${a}`);
      const normalized = lines.join("\n");
      localStorage.setItem(STOCKS_LS, normalized);
      localStorage.setItem(LS + "stocks", normalized);
      stockMap.current = map;
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
      const s0 = stockMap.current.get(token0);
      const s1 = stockMap.current.get(token1);
      const hit = s0
        ? { pairedAsset: token0, memeSide: token1, symbol: s0 }
        : s1
          ? { pairedAsset: token1, memeSide: token0, symbol: s1 }
          : null;
      if (!hit && fields.current.onlyStock) return;

      const tags = ["NEW", "PAIR"];
      if (hit) tags.push("STOCK", hit.symbol);
      const rec: PairRec = {
        token0,
        token1,
        pairedAsset: hit?.pairedAsset || "",
        memeSide: hit?.memeSide || "",
        symbol: hit?.symbol || "",
        block: bn,
        tx: String(r.transactionHash || ""),
        firstLp: false,
      };
      if (pair) pairs.current.set(pair.toLowerCase(), rec);
      pushEvent({
        kind: locale === "zh" ? "币股配对开盘" : "pair landed",
        tags,
        title: shortAddr(pair),
        body: hit
          ? `${hit.symbol} ↔ ${shortAddr(hit.memeSide)} · #${bn}`
          : `${shortAddr(token0)} / ${shortAddr(token1)} · #${bn}`,
        address: pair || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "RH",
        metric: hit?.symbol,
        metricLabel: locale === "zh" ? "股票" : "Stock",
      });
    },
    [locale, pushEvent]
  );

  const onMint = useCallback(
    (r: Record<string, unknown>) => {
      const pool = String(r.address || "").toLowerCase();
      const known = pairs.current.get(pool);
      if (!known || known.firstLp) return;
      if (fields.current.onlyStock && !known.symbol) return;
      known.firstLp = true;
      const a0 = wordU256(r.data as string, 0);
      const a1 = wordU256(r.data as string, 1);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tags = ["LP", "STOCK"];
      if (known.symbol) tags.push(known.symbol);
      pushEvent({
        kind: locale === "zh" ? "首次 LP" : "first LP",
        tags,
        title: shortAddr(pool),
        body: known.symbol
          ? `${known.symbol} · a0=${a0.toString()} a1=${a1.toString()} · #${bn}`
          : `#${bn}`,
        address: pool,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "RH",
        metric: known.symbol || undefined,
        metricLabel: locale === "zh" ? "股票" : "Stock",
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
      if (t0 === PAIR_CREATED) return onPairCreated(r);
      if (t0 === MINT) return onMint(r);
    },
    [onMint, onPairCreated]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = fields.current.factory.trim();
    const factoryOk = isAddr(f);
    if (fields.current.subPair) {
      const filt: { topics: string[]; address?: string } = { topics: [PAIR_CREATED] };
      if (factoryOk) filt.address = f.toLowerCase();
      send("eth_subscribe", ["logs", filt]);
    }
    if (fields.current.subMint) {
      send("eth_subscribe", ["logs", { topics: [MINT] }]);
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
    stockMap.current = parseStocks(fields.current.stocksText);
    if (fields.current.onlyStock && stockMap.current.size === 0) {
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
    stockMap.current = parseStocks(stocksText);
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
    { label: "Stocks", value: String(stockMap.current.size || parseStocks(stocksText).size) },
    { label: "Pair", value: subPair ? "on" : "off" },
    { label: "Mint", value: subMint ? "on" : "off" },
    { label: "Filter", value: onlyStock ? "stock-only" : "all" },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "stock-pair.rh / stream" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "stock-pair-watch" },
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
            <CardTitle>{t(locale, "stock.stocksLabel")}</CardTitle>
            <CardDescription>{t(locale, "stock.stocksHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="stocks">{t(locale, "stock.stocksLabel")}</Label>
              <textarea
                id="stocks"
                className="min-h-[96px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                value={stocksText}
                onChange={(e) => setStocksText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
              <p className="text-[11px] text-[var(--color-muted-foreground)]">{t(locale, "stock.stocksHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="factory">Factory</Label>
              <Input id="factory" placeholder="0x…" value={factory} onChange={(e) => setFactory(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subPair} onChange={(e) => setSubPair(e.target.checked)} className="h-4 w-4" />
                PairCreated
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subMint} onChange={(e) => setSubMint(e.target.checked)} className="h-4 w-4" />
                Mint (first LP)
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} className="h-4 w-4" />
                stock-pair only
              </label>
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
        title={t(locale, "stock.title")}
        tag={t(locale, "stock.tag")}
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
        guide={t(locale, "stock.guide")}
        watching={t(locale, "stock.watching")}
        hint={t(locale, "stock.hint")}
        emptyTitle={t(locale, "stock.emptyTitle")}
        emptySub={t(locale, "stock.emptySub")}
        latestLabel={t(locale, "stock.latest")}
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
