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
import { isAddr, shortAddr, unpadTopic, wordU256 } from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildBaseLaptopFixtures, useDemoHits } from "../lib/demo-hits";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

const TOPIC_MINT =
  "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f";
const TOPIC_BURN =
  "0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496";
const TOPIC_SWAP =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const TOPIC_TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Empty — paste TOKEN / PAIR_OR_POOL when known. No invented token address. */
const DEFAULT_TOKEN = "";
const DEFAULT_PAIR = "";
const DEFAULT_SPIKE_WINDOW = "90";
const DEFAULT_SWAP_BURST = "8";
const DEFAULT_TOP_HOLDER = "35";
const DEFAULT_BURN_MIN = "1";
const LS = "blockreq.base-laptop-sniper.";
const SLUG = "base-laptop-sniper-liquidity-listen";

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

/**
 * Base $LAPTOP liquidity detector — Mint/Burn/Swap + Transfer early-wallet panel.
 * Technical detector tone (what to listen for); zero trading-advice.
 * Layout: launch-feed.
 */
export function BaseLaptopSniperLiquidityDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [pairOrPool, setPairOrPool] = useState(DEFAULT_PAIR);
  const [spikeWindow, setSpikeWindow] = useState(DEFAULT_SPIKE_WINDOW);
  const [swapBurst, setSwapBurst] = useState(DEFAULT_SWAP_BURST);
  const [topHolderShare, setTopHolderShare] = useState(DEFAULT_TOP_HOLDER);
  const [burnMin, setBurnMin] = useState(DEFAULT_BURN_MIN);
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

  const seedEvents = useMemo(() => buildBaseLaptopFixtures(locale, 6), [locale]);
  // No factory history without paste — empty history panel until TOKEN/PAIR set
  const history = useMemo(
    () => ({
      status: "empty" as const,
      events: [] as FeedEvent[],
      reason: locale === "zh" ? "粘贴 TOKEN / PAIR_OR_POOL 后开始侦测" : "Paste TOKEN / PAIR_OR_POOL to start detection",
      fromBlock: 0,
      toBlock: 0,
      windowBlocks: 0,
    }),
    [locale]
  );

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const firstMintSeen = useRef(false);
  const swapTimes = useRef<number[]>([]);
  const holders = useRef(new Map<string, bigint>());
  const totalXfer = useRef(0n);
  const fields = useRef({
    token,
    pairOrPool,
    spikeWindow,
    swapBurst,
    topHolderShare,
    burnMin,
  });
  fields.current = { token, pairOrPool, spikeWindow, swapBurst, topHolderShare, burnMin };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildBaseLaptopFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const tok = localStorage.getItem(LS + "token");
      const pair = localStorage.getItem(LS + "pair");
      const sw = localStorage.getItem(LS + "spikeWindow");
      const sb = localStorage.getItem(LS + "swapBurst");
      const th = localStorage.getItem(LS + "topHolder");
      const bm = localStorage.getItem(LS + "burnMin");
      if (tok) setToken(tok);
      if (pair) setPairOrPool(pair);
      if (sw) setSpikeWindow(sw);
      if (sb) setSwapBurst(sb);
      if (th) setTopHolderShare(th);
      if (bm) setBurnMin(bm);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "token", fields.current.token.trim());
      localStorage.setItem(LS + "pair", fields.current.pairOrPool.trim());
      localStorage.setItem(LS + "spikeWindow", fields.current.spikeWindow.trim() || DEFAULT_SPIKE_WINDOW);
      localStorage.setItem(LS + "swapBurst", fields.current.swapBurst.trim() || DEFAULT_SWAP_BURST);
      localStorage.setItem(LS + "topHolder", fields.current.topHolderShare.trim() || DEFAULT_TOP_HOLDER);
      localStorage.setItem(LS + "burnMin", fields.current.burnMin.trim() || DEFAULT_BURN_MIN);
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

  const onMint = useCallback(
    (r: Record<string, unknown>) => {
      const amount0 = wordU256(r.data as string, 0);
      const amount1 = wordU256(r.data as string, 1);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const pair = String(r.address || fields.current.pairOrPool);
      const isFirst = !firstMintSeen.current;
      if (isFirst) firstMintSeen.current = true;
      pushEvent({
        kind: isFirst
          ? locale === "zh"
            ? "首池 Mint"
            : "firstMint"
          : locale === "zh"
            ? "Mint"
            : "mint",
        tags: isFirst
          ? ["FIRST", "MINT", "BASE", "LAPTOP", "kind:firstMint", "pad:laptop-liq"]
          : ["MINT", "BASE", "LAPTOP", "pad:laptop-liq"],
        title: shortAddr(pair),
        body: `pad:laptop-liq · kind=${isFirst ? "firstMint" : "mint"} · token ${shortAddr(fields.current.token)} · pair ${shortAddr(pair)} · a0 ${amount0.toString()} · a1 ${amount1.toString()} · #${bn}`,
        address: pair || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "BASE",
        metric: amount0.toString(),
        metricLabel: "amount0",
        metric2: amount1.toString(),
        metric2Label: "amount1",
      });
    },
    [locale, pushEvent]
  );

  const onBurn = useCallback(
    (r: Record<string, unknown>) => {
      const amount0 = wordU256(r.data as string, 0);
      const amount1 = wordU256(r.data as string, 1);
      const min = BigInt(Math.max(0, Number(fields.current.burnMin) || 1));
      if (amount0 + amount1 < min) return;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const pair = String(r.address || fields.current.pairOrPool);
      pushEvent({
        kind: locale === "zh" ? "薄 LP 退出" : "thinExit",
        tags: ["BURN", "BASE", "LAPTOP", "kind:thinExit", "pad:laptop-liq"],
        title: shortAddr(pair),
        body: `pad:laptop-liq · kind=thinExit · pair ${shortAddr(pair)} · burn a0 ${amount0.toString()} a1 ${amount1.toString()} · #${bn}`,
        address: pair || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "BASE",
        metric: amount0.toString(),
        metricLabel: "burn0",
        metric2: amount1.toString(),
        metric2Label: "burn1",
      });
    },
    [locale, pushEvent]
  );

  const onSwap = useCallback(
    (r: Record<string, unknown>) => {
      const now = Date.now();
      const windowMs = Math.max(5, Number(fields.current.spikeWindow) || Number(DEFAULT_SPIKE_WINDOW)) * 1000;
      const burstThr = Math.max(1, Number(fields.current.swapBurst) || Number(DEFAULT_SWAP_BURST));
      swapTimes.current.push(now);
      swapTimes.current = swapTimes.current.filter((t) => now - t <= windowMs);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const pair = String(r.address || fields.current.pairOrPool);
      if (swapTimes.current.length >= burstThr) {
        pushEvent({
          kind: locale === "zh" ? "换手簇" : "swapBurst",
          tags: ["SWAP", "BURST", "BASE", "LAPTOP", "kind:swapBurst", "pad:laptop-liq"],
          title: shortAddr(pair),
          body: `pad:laptop-liq · kind=swapBurst · pair ${shortAddr(pair)} · swaps ${swapTimes.current.length}/${fields.current.spikeWindow}s · #${bn}`,
          address: pair || undefined,
          block: bn,
          tx: String(r.transactionHash || "") || undefined,
          chain: "BASE",
          metric: String(swapTimes.current.length),
          metricLabel: locale === "zh" ? "窗口换手" : "window swaps",
          metric2: `${fields.current.spikeWindow}s`,
          metric2Label: "SPIKE_WINDOW",
        });
        swapTimes.current = [];
      }
    },
    [locale, pushEvent]
  );

  const onTransfer = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const to = unpadTopic(topics[2]);
      if (!to || to === "0x0000000000000000000000000000000000000000") return;
      const value = wordU256(r.data as string, 0);
      holders.current.set(to, (holders.current.get(to) || 0n) + value);
      totalXfer.current += value;
      if (totalXfer.current <= 0n) return;
      const topSharePct = Math.max(1, Number(fields.current.topHolderShare) || Number(DEFAULT_TOP_HOLDER));
      let top = 0n;
      let topAddr = "";
      for (const [a, v] of holders.current) {
        if (v > top) {
          top = v;
          topAddr = a;
        }
      }
      const share = Number((top * 10000n) / totalXfer.current) / 100;
      if (share < topSharePct) return;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      pushEvent({
        kind: locale === "zh" ? "持仓集中" : "holderConc",
        tags: ["XFER", "CONC", "BASE", "LAPTOP", "kind:holderConc", "pad:laptop-liq"],
        title: shortAddr(topAddr),
        body: `pad:laptop-liq · kind=holderConc · token ${shortAddr(fields.current.token)} · top ${shortAddr(topAddr)} · share ${share.toFixed(1)}% · #${bn}`,
        address: fields.current.token || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: "BASE",
        metric: `${share.toFixed(1)}%`,
        metricLabel: locale === "zh" ? "顶仓占比" : "top share",
        metric2: shortAddr(topAddr),
        metric2Label: "wallet",
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
      if (t0 === TOPIC_MINT) return onMint(r);
      if (t0 === TOPIC_BURN) return onBurn(r);
      if (t0 === TOPIC_SWAP) return onSwap(r);
      if (t0 === TOPIC_TRANSFER) return onTransfer(r);
    },
    [onBurn, onMint, onSwap, onTransfer]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const pair = fields.current.pairOrPool.trim().toLowerCase();
    const tok = fields.current.token.trim().toLowerCase();
    if (!isAddr(pair) && !isAddr(tok)) {
      setStatus("error");
      return;
    }
    if (isAddr(pair)) {
      // Mint/Burn/Swap OR-list on pair
      send("eth_subscribe", ["logs", { address: pair, topics: [TOPIC_MINT] }]);
      send("eth_subscribe", ["logs", { address: pair, topics: [TOPIC_BURN] }]);
      send("eth_subscribe", ["logs", { address: pair, topics: [TOPIC_SWAP] }]);
    }
    if (isAddr(tok)) {
      send("eth_subscribe", ["logs", { address: tok, topics: [TOPIC_TRANSFER] }]);
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
    const pair = fields.current.pairOrPool.trim();
    const tok = fields.current.token.trim();
    if (!isAddr(pair) && !isAddr(tok)) {
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
    if (isAddr(token.trim()) || isAddr(pairOrPool.trim())) resume();
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
      label: "TOKEN",
      value: token.trim() || (locale === "zh" ? "（粘贴）" : "(paste)"),
      mono: true,
    },
    {
      label: "PAIR_OR_POOL",
      value: pairOrPool.trim() || (locale === "zh" ? "（粘贴）" : "(paste)"),
      mono: true,
    },
    { label: "SPIKE_WINDOW_SEC", value: spikeWindow },
    { label: "SWAP_BURST", value: swapBurst },
    { label: "TOP_HOLDER_SHARE", value: `${topHolderShare}%` },
    { label: "BURN_MIN", value: burnMin },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "base.laptop.liq" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "mint|burn|swap|xfer" },
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
            <CardTitle>{locale === "zh" ? "TOKEN / PAIR + 阈值" : "TOKEN / PAIR + thresholds"}</CardTitle>
            <CardDescription>{t(locale, "laptop.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lap-token">TOKEN</Label>
              <Input
                id="lap-token"
                value={token}
                placeholder="0x… (paste $LAPTOP token)"
                onChange={(e) => setToken(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lap-pair">PAIR_OR_POOL</Label>
              <Input
                id="lap-pair"
                value={pairOrPool}
                placeholder="0x… (paste pair / pool)"
                onChange={(e) => setPairOrPool(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lap-win">SPIKE_WINDOW_SEC</Label>
                <Input id="lap-win" value={spikeWindow} onChange={(e) => setSpikeWindow(e.target.value)} onBlur={saveFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lap-burst">SWAP_BURST</Label>
                <Input id="lap-burst" value={swapBurst} onChange={(e) => setSwapBurst(e.target.value)} onBlur={saveFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lap-top">TOP_HOLDER_SHARE %</Label>
                <Input id="lap-top" value={topHolderShare} onChange={(e) => setTopHolderShare(e.target.value)} onBlur={saveFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lap-burn">BURN_MIN</Label>
                <Input id="lap-burn" value={burnMin} onChange={(e) => setBurnMin(e.target.value)} onBlur={saveFields} />
              </div>
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
        title={t(locale, "laptop.title")}
        tag={t(locale, "laptop.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
        blogUrl={demoBlogUrl(SLUG, locale)}
        siteUrl={demoSiteUrl(getDemo(SLUG))}
        localeMode={onLocaleChange ? "catalog" : "links"}
        onLocaleChange={onLocaleChange}
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
        guide={t(locale, "laptop.guide")}
        watching={t(locale, "laptop.watching")}
        hint={t(locale, "laptop.hint")}
        emptyTitle={t(locale, "laptop.emptyTitle")}
        emptySub={t(locale, "laptop.emptySub")}
        latestLabel={t(locale, "laptop.latest")}
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
