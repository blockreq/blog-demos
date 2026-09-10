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
import { shortAddr, wordU256 } from "@blockreq/rpc";

function wordI256(data: string | undefined, i: number): bigint {
  const u = wordU256(data, i);
  const half = 1n << 255n;
  return u >= half ? u - (1n << 256n) : u;
}
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildBaseStockSwapFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";
import type { JsonRpcLog } from "@blockreq/rpc";

/** Uniswap V2 / Aerodrome-style Swap */
const TOPIC_V2_SWAP =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
/** Uniswap V3 Swap */
const TOPIC_V3_SWAP =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
const LS = "blockreq.base-stock-token-swap.";
const SLUG = "base-stock-token-swap-listen";
const DEFAULT_STOCK =
  "AAPL 0x1111111111111111111111111111111111111111\nTSLA 0x2222222222222222222222222222222222222222\nNVDA 0x3333333333333333333333333333333333333333";
const DEFAULT_PAIRS = "";
const DEFAULT_V3 = "";
const DEFAULT_MIN_USD = "1000";
const DEFAULT_MIN_RAW = "1000000";

function parseAddrList(text: string) {
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

function parsePoolList(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    for (const p of raw.split(/[\s,]+/)) {
      if (/^0x[a-fA-F0-9]{40}$/.test(p)) out.push(p.toLowerCase());
    }
  }
  return [...new Set(out)];
}

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function formatRaw(n: bigint): string {
  if (n < 0n) n = -n;
  if (n >= 10n ** 12n) return `${(Number(n / 10n ** 9n) / 1e3).toFixed(2)}B`;
  if (n >= 10n ** 9n) return `${(Number(n / 10n ** 6n) / 1e3).toFixed(2)}M`;
  if (n >= 10n ** 6n) return `${(Number(n / 10n ** 3n) / 1e3).toFixed(2)}K`;
  return n.toString();
}

async function ethCallAddr(https: string, to: string, data: string): Promise<string> {
  try {
    const res = await fetch(https, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to, data }, "latest"],
      }),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { result?: string };
    const hex = json.result || "";
    if (hex.length < 66) return "";
    return ("0x" + hex.slice(-40)).toLowerCase();
  } catch {
    return "";
  }
}

/** token0() / token1() — works for Uniswap V2 pairs and V3 pools. */
async function resolvePoolTokens(
  https: string,
  pool: string,
  cache: Map<string, { token0: string; token1: string }>
): Promise<{ token0: string; token1: string } | null> {
  const hit = cache.get(pool);
  if (hit) return hit;
  const [token0, token1] = await Promise.all([
    ethCallAddr(https, pool, "0x0dfe1681"),
    ethCallAddr(https, pool, "0xd21220a7"),
  ]);
  if (!token0 || !token1) return null;
  const rec = { token0, token1 };
  cache.set(pool, rec);
  return rec;
}

function mapSwapHist(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    const pool = String(log.address || "");
    return {
      id: `hist:${log.transactionHash}:${log.logIndex ?? i}`,
      kind: locale === "zh" ? "历史 Swap" : "Recent Swap",
      tags: ["HIST", "BASE"],
      title: shortAddr(pool),
      body: `pool ${shortAddr(pool)} · #${bn}`,
      address: pool || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "BASE",
      at: now - i * 400,
    };
  });
}

/**
 * Base stock-token Swap whitelist big-print watch (Aerodrome / Uniswap V2+V3).
 * Layout: launch-feed — continuous big-print stream with sticky detail.
 */
export function BaseStockTokenSwapDemo({ locale }: { locale: Locale }) {
  const [stockText, setStockText] = useState(DEFAULT_STOCK);
  const [pairList, setPairList] = useState(DEFAULT_PAIRS);
  const [v3List, setV3List] = useState(DEFAULT_V3);
  const [minUsd, setMinUsd] = useState(DEFAULT_MIN_USD);
  const [minRaw, setMinRaw] = useState(DEFAULT_MIN_RAW);
  const [topicV2, setTopicV2] = useState(TOPIC_V2_SWAP);
  const [topicV3, setTopicV3] = useState(TOPIC_V3_SWAP);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "base");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildBaseStockSwapFixtures(locale, 6), [locale]);
  const pairs = parsePoolList(pairList);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: pairs[0],
    topics: [topicV2],
    map: (logs) => mapSwapHist(logs, locale),
    enabled: !!ep.https.trim() && pairs.length > 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const stockMap = useRef(new Map<string, string>());
  const pairMeta = useRef(new Map<string, { venue: "V2" | "V3" }>());
  const poolTokens = useRef(new Map<string, { token0: string; token1: string }>());
  const fields = useRef({ stockText, pairList, v3List, minUsd, minRaw, topicV2, topicV3 });
  fields.current = { stockText, pairList, v3List, minUsd, minRaw, topicV2, topicV3 };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildBaseStockSwapFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(LS + "stock");
      const p = localStorage.getItem(LS + "pairs");
      const v = localStorage.getItem(LS + "v3");
      const u = localStorage.getItem(LS + "minUsd");
      const r = localStorage.getItem(LS + "minRaw");
      if (s) setStockText(s);
      if (p) setPairList(p);
      if (v) setV3List(v);
      if (u) setMinUsd(u);
      if (r) setMinRaw(r);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "stock", fields.current.stockText);
      localStorage.setItem(LS + "pairs", fields.current.pairList);
      localStorage.setItem(LS + "v3", fields.current.v3List);
      localStorage.setItem(LS + "minUsd", fields.current.minUsd.trim() || DEFAULT_MIN_USD);
      localStorage.setItem(LS + "minRaw", fields.current.minRaw.trim() || DEFAULT_MIN_RAW);
      stockMap.current = parseAddrList(fields.current.stockText);
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

  const passesSize = (raw: bigint) => {
    const abs = raw < 0n ? -raw : raw;
    const minR = BigInt(fields.current.minRaw.trim() || DEFAULT_MIN_RAW);
    if (abs >= minR) return true;
    const usd = Number(fields.current.minUsd.trim() || DEFAULT_MIN_USD);
    if (Number.isFinite(usd) && usd > 0) {
      // Heuristic: treat 6-decimal stable notional (USDC-style) as USD proxy.
      const asUsd6 = abs / 10n ** 6n;
      if (asUsd6 >= BigInt(Math.floor(usd))) return true;
    }
    return false;
  };

  const onSwap = useCallback(
    (r: Record<string, unknown>, venue: "V2" | "V3") => {
      const pool = String(r.address || "").toLowerCase();
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const data = r.data as string;
      let amountIn = 0n;
      let amountOut = 0n;
      let tokenInGuess = "";
      let tokenOutGuess = "";
      if (venue === "V2") {
        const a0in = wordU256(data, 0);
        const a1in = wordU256(data, 1);
        const a0out = wordU256(data, 2);
        const a1out = wordU256(data, 3);
        amountIn = a0in > a1in ? a0in : a1in;
        amountOut = a0out > a1out ? a0out : a1out;
      } else {
        const a0 = wordI256(data, 0);
        const a1 = wordI256(data, 1);
        const abs0 = a0 < 0n ? -a0 : a0;
        const abs1 = a1 < 0n ? -a1 : a1;
        amountIn = abs0 > abs1 ? abs0 : abs1;
        amountOut = abs0 < abs1 ? abs0 : abs1;
      }
      const size = amountIn > amountOut ? amountIn : amountOut;
      if (!passesSize(size)) return;

      const emit = (token0: string, token1: string) => {
        const s0 = stockMap.current.get(token0);
        const s1 = stockMap.current.get(token1);
        if (stockMap.current.size > 0 && !s0 && !s1) return;
        const sym = s0 || s1 || "STOCK";
        const tokenIn = s0 ? token0 : s1 ? token1 : token0 || pool;
        const tokenOut = tokenIn === token0 ? token1 : token0;
        tokenInGuess = tokenIn;
        tokenOutGuess = tokenOut;
        pushEvent({
          kind: locale === "zh" ? "股币大单" : "Stock big print",
          tags: ["BIG", "BASE", venue, sym],
          title: `${sym} · ${venue}`,
          body: `chain=base · venue=${venue} · tokenIn ${shortAddr(tokenInGuess)} · tokenOut ${shortAddr(tokenOutGuess)} · in ${formatRaw(amountIn)} · out ${formatRaw(amountOut)} · pairOrPool ${shortAddr(pool)} · #${bn}`,
          address: pool,
          block: bn,
          tx: tx || undefined,
          chain: "BASE",
          metric: formatRaw(size),
          metricLabel: locale === "zh" ? "大单" : "Print",
          metric2: venue,
          metric2Label: "venue",
        });
      };

      const cached = poolTokens.current.get(pool);
      if (cached) {
        emit(cached.token0, cached.token1);
        return;
      }
      // Resolve token0/token1 via public HTTPS eth_call, then whitelist-gate.
      void resolvePoolTokens(epRef.current.https, pool, poolTokens.current).then((tok) => {
        if (tok) emit(tok.token0, tok.token1);
        else if (stockMap.current.size === 0) emit("", "");
        // If whitelist set but tokens unknown, skip (avoid false big prints).
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
      const addr = String(r.address || "").toLowerCase();
      const meta = pairMeta.current.get(addr);
      if (t0 === fields.current.topicV2.trim().toLowerCase()) {
        if (meta && meta.venue !== "V2") return;
        return onSwap(r, "V2");
      }
      if (t0 === fields.current.topicV3.trim().toLowerCase()) {
        if (meta && meta.venue !== "V3") return;
        return onSwap(r, "V3");
      }
    },
    [onSwap]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    stockMap.current = parseAddrList(fields.current.stockText);
    pairMeta.current.clear();
    const v2Pools = parsePoolList(fields.current.pairList);
    const v3Pools = parsePoolList(fields.current.v3List);
    const tv2 = fields.current.topicV2.trim().toLowerCase();
    const tv3 = fields.current.topicV3.trim().toLowerCase();

    if (v2Pools.length) {
      for (const p of v2Pools) pairMeta.current.set(p, { venue: "V2" });
      send("eth_subscribe", ["logs", { address: v2Pools, topics: [tv2] }]);
    } else {
      // Wide V2 topic listen — still filtered by size; whitelist symbols annotate cards.
      send("eth_subscribe", ["logs", { topics: [tv2] }]);
    }
    if (v3Pools.length) {
      for (const p of v3Pools) pairMeta.current.set(p, { venue: "V3" });
      send("eth_subscribe", ["logs", { address: v3Pools, topics: [tv3] }]);
    } else {
      send("eth_subscribe", ["logs", { topics: [tv3] }]);
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
    stockMap.current = parseAddrList(fields.current.stockText);
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
    stockMap.current = parseAddrList(stockText);
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
    { label: "STOCK", value: String(stockMap.current.size || parseAddrList(stockText).size) },
    { label: "V2 pools", value: String(parsePoolList(pairList).length || "wide") },
    { label: "V3 pools", value: String(parsePoolList(v3List).length || "wide") },
    { label: "MIN_USD", value: minUsd },
    { label: "MIN_RAW", value: minRaw },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "base.stock.swap" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "v2+v3-swap-parallel" },
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
            <CardTitle>{t(locale, "baseswap.whitelistLabel")}</CardTitle>
            <CardDescription>{t(locale, "baseswap.whitelistHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bs-stock">{t(locale, "baseswap.whitelistLabel")}</Label>
              <textarea
                id="bs-stock"
                className="min-h-[88px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                value={stockText}
                onChange={(e) => setStockText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-pairs">PAIR_OR_POOL_LIST (V2)</Label>
              <textarea
                id="bs-pairs"
                className="min-h-[64px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                placeholder="0xpair… (one per line; empty = wide V2 topic)"
                value={pairList}
                onChange={(e) => setPairList(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-v3">V3_POOL_LIST</Label>
              <textarea
                id="bs-v3"
                className="min-h-[64px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                placeholder="0xpool… (one per line; empty = wide V3 topic)"
                value={v3List}
                onChange={(e) => setV3List(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bs-usd">MIN_AMOUNT_USD</Label>
                <Input id="bs-usd" value={minUsd} onChange={(e) => setMinUsd(e.target.value)} onBlur={saveFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bs-raw">MIN_RAW</Label>
                <Input id="bs-raw" value={minRaw} onChange={(e) => setMinRaw(e.target.value)} onBlur={saveFields} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-tv2">V2 Swap topic0</Label>
              <Input id="bs-tv2" value={topicV2} onChange={(e) => setTopicV2(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-tv3">V3 Swap topic0</Label>
              <Input id="bs-tv3" value={topicV3} onChange={(e) => setTopicV3(e.target.value)} />
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
        title={t(locale, "baseswap.title")}
        tag={t(locale, "baseswap.tag")}
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
        guide={t(locale, "baseswap.guide")}
        watching={t(locale, "baseswap.watching")}
        hint={t(locale, "baseswap.hint")}
        emptyTitle={t(locale, "baseswap.emptyTitle")}
        emptySub={t(locale, "baseswap.emptySub")}
        latestLabel={t(locale, "baseswap.latest")}
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
