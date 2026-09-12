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
import { isAddr, shortAddr, wordU256 } from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildEthV4StablePairFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";
import type { JsonRpcLog } from "@blockreq/rpc";

/** Uniswap v4 PoolManager Swap */
const TOPIC_SWAP =
  "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f";
/** Uniswap v4 ModifyLiquidity */
const TOPIC_MODIFY_LIQ =
  "0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec";
/** Canonical Uniswap v4 PoolManager — Ethereum mainnet */
const DEFAULT_PM = "0x000000000004444c5dc75cB358380D2e3dE08A90";
/** Official StablePairHook proxy (Uniswap Labs deployments) */
const DEFAULT_HOOK = "0x0000113dCf4ADd69999Fad8F20F2b63F979bfcC0";
/** Official StablePair poolIds (USDC/USDT + USDC/USDG) — editable POOL_ID_LIST */
const DEFAULT_POOL_IDS = `# POOL_ID_LIST — one poolId hex per line (official StablePair deployments)
# USDC/USDT
0x2b21c65d9a7dc6926ee330a1c6e5a8037fd81774f3dc066536f800128e39f634
# USDC/USDG
0xeda62d2906d0edf26d40c793d581609552a44a87f618a98ff76ebe8dde4b7edb`;
const DEFAULT_PEG_BPS = "50";
const DEFAULT_LP_DELTA_MIN = "1";
const LS = "blockreq.eth-uniswap-v4-stablepair.";
const SLUG = "ethereum-uniswap-v4-stablepair-hook-listen";

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function parsePoolIds(text: string): Set<string> {
  const set = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const m = raw.match(/0x[a-fA-F0-9]{64}/);
    if (m) set.add(m[0].toLowerCase());
  }
  return set;
}

/** Approximate peg deviation in bps from sqrtPriceX96 for 1:1 6-dec stables. */
function pegBpsFromSqrt(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 <= 0n) return 0;
  // price = (sqrtP / 2^96)^2 ; Q96 = 2^96
  const Q96 = 2n ** 96n;
  // use float for UI only
  const sqrt = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrt * sqrt;
  return Math.round(Math.abs(price - 1) * 10_000);
}

function signedWord(data: string | undefined, i: number): bigint {
  const u = wordU256(data, i);
  // interpret as int256 two's complement for liquidityDelta / amounts
  const signBit = 1n << 255n;
  if (u & signBit) return u - (1n << 256n);
  return u;
}

function mapStableSwapLogs(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const poolId = (log.topics || [])[1] || "";
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: locale === "zh" ? "历史 Swap" : "Recent swap",
      tags: ["HIST", "V4", "ETH"],
      title: shortAddr(poolId),
      body: `pad:stablepair-hook · pool ${shortAddr(poolId)} · #${bn}`,
      address: poolId || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "ETH",
      at: now - i * 400,
      metric: shortAddr(poolId),
      metricLabel: "poolId",
      metric2: `#${bn}`,
      metric2Label: locale === "zh" ? "区块" : "Block",
    };
  });
}

/**
 * ETH StablePair Hook listen — PoolManager Swap + ModifyLiquidity filtered by poolId.
 * Cards: kind swap|peg|fee|lp. Official PoolManager / StablePairHook / poolIds.
 */
export function EthUniswapV4StablePairHookDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [poolManager, setPoolManager] = useState(DEFAULT_PM);
  const [hook, setHook] = useState(DEFAULT_HOOK);
  const [poolIdList, setPoolIdList] = useState(DEFAULT_POOL_IDS);
  const [pegBpsThr, setPegBpsThr] = useState(DEFAULT_PEG_BPS);
  const [lpDeltaMin, setLpDeltaMin] = useState(DEFAULT_LP_DELTA_MIN);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "ethereum");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildEthV4StablePairFixtures(locale, 6), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: poolManager.trim() || DEFAULT_PM,
    topics: [TOPIC_SWAP],
    map: (logs) => mapStableSwapLogs(logs, locale),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const fields = useRef({ poolManager, hook, poolIdList, pegBpsThr, lpDeltaMin });
  fields.current = { poolManager, hook, poolIdList, pegBpsThr, lpDeltaMin };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildEthV4StablePairFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const pm = localStorage.getItem(LS + "poolManager");
      const hk = localStorage.getItem(LS + "hook");
      const pl = localStorage.getItem(LS + "poolIdList");
      const pb = localStorage.getItem(LS + "pegBps");
      const ld = localStorage.getItem(LS + "lpDeltaMin");
      if (pm) setPoolManager(pm);
      if (hk) setHook(hk);
      if (pl) setPoolIdList(pl);
      if (pb) setPegBpsThr(pb);
      if (ld) setLpDeltaMin(ld);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "poolManager", fields.current.poolManager.trim() || DEFAULT_PM);
      localStorage.setItem(LS + "hook", fields.current.hook.trim() || DEFAULT_HOOK);
      localStorage.setItem(LS + "poolIdList", fields.current.poolIdList);
      localStorage.setItem(LS + "pegBps", fields.current.pegBpsThr.trim() || DEFAULT_PEG_BPS);
      localStorage.setItem(LS + "lpDeltaMin", fields.current.lpDeltaMin.trim() || DEFAULT_LP_DELTA_MIN);
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

  const poolAllowed = (poolId: string) => {
    const set = parsePoolIds(fields.current.poolIdList);
    if (set.size === 0) return true;
    return set.has(poolId.toLowerCase());
  };

  const onSwap = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const poolId = topics[1] || "";
      if (!poolAllowed(poolId)) return;
      const data = r.data as string;
      // amount0, amount1, sqrtPriceX96, liquidity, tick, fee
      const sqrtPriceX96 = wordU256(data, 2);
      const fee = Number(wordU256(data, 5) & 0xffffffn);
      const pegBps = pegBpsFromSqrt(sqrtPriceX96);
      const thr = Math.max(0, Number(fields.current.pegBpsThr) || Number(DEFAULT_PEG_BPS));
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const hookAddr = fields.current.hook.trim() || DEFAULT_HOOK;

      let kind: "swap" | "peg" | "fee" = "swap";
      if (pegBps >= thr) kind = "peg";
      else if (fee > 0) kind = "fee";

      const kindLabel =
        kind === "peg"
          ? locale === "zh"
            ? "peg 偏离"
            : "peg drift"
          : kind === "fee"
            ? locale === "zh"
              ? "费率"
              : "fee"
            : locale === "zh"
              ? "Swap"
              : "swap";

      pushEvent({
        kind: kindLabel,
        tags: ["V4", "STABLEPAIR", "ETH", `kind:${kind}`, "pad:stablepair-hook"],
        title: shortAddr(poolId),
        body: `pad:stablepair-hook · kind=${kind} · poolId ${shortAddr(poolId)} · hook ${shortAddr(hookAddr)} · pegBps ${pegBps} · fee ${fee} · sqrtPriceX96 ${sqrtPriceX96.toString()} · #${bn}`,
        address: poolId || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "ETH",
        metric: String(pegBps),
        metricLabel: "pegBps",
        metric2: String(fee),
        metric2Label: "fee",
      });
    },
    [locale, pushEvent]
  );

  const onModifyLiq = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const poolId = topics[1] || "";
      if (!poolAllowed(poolId)) return;
      const data = r.data as string;
      // tickLower, tickUpper, liquidityDelta, salt
      const liquidityDelta = signedWord(data, 2);
      const minAbs = BigInt(Math.max(0, Number(fields.current.lpDeltaMin) || 1));
      const absDelta = liquidityDelta < 0n ? -liquidityDelta : liquidityDelta;
      if (absDelta < minAbs) return;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const hookAddr = fields.current.hook.trim() || DEFAULT_HOOK;
      pushEvent({
        kind: locale === "zh" ? "LP 变动" : "lp",
        tags: ["V4", "STABLEPAIR", "LP", "ETH", "kind:lp", "pad:stablepair-hook"],
        title: shortAddr(poolId),
        body: `pad:stablepair-hook · kind=lp · poolId ${shortAddr(poolId)} · hook ${shortAddr(hookAddr)} · liquidityDelta ${liquidityDelta.toString()} · #${bn}`,
        address: poolId || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "ETH",
        metric: liquidityDelta.toString(),
        metricLabel: "liquidityDelta",
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
      if (t0 === TOPIC_SWAP) return onSwap(r);
      if (t0 === TOPIC_MODIFY_LIQ) return onModifyLiq(r);
    },
    [onModifyLiq, onSwap]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const pm = (fields.current.poolManager.trim() || DEFAULT_PM).toLowerCase();
    const poolIds = [...parsePoolIds(fields.current.poolIdList)];
    // Subscribe Swap + ModifyLiquidity on PoolManager; filter client-side by poolId topics[1].
    // When few poolIds, also OR-filter topics[1] per subscription for efficiency.
    if (poolIds.length > 0 && poolIds.length <= 8) {
      for (const pid of poolIds) {
        send("eth_subscribe", ["logs", { address: pm, topics: [TOPIC_SWAP, pid] }]);
        send("eth_subscribe", ["logs", { address: pm, topics: [TOPIC_MODIFY_LIQ, pid] }]);
      }
    } else {
      send("eth_subscribe", ["logs", { address: pm, topics: [TOPIC_SWAP] }]);
      send("eth_subscribe", ["logs", { address: pm, topics: [TOPIC_MODIFY_LIQ] }]);
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
    { label: "PoolManager", value: shortAddr(poolManager), mono: true },
    { label: "StablePairHook", value: shortAddr(hook), mono: true },
    { label: "PEG_BPS", value: pegBpsThr },
    { label: "LP_DELTA_MIN", value: lpDeltaMin },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "eth.uniswap.v4.stablepair" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "swap+modliq·poolId" },
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
            <CardTitle>{locale === "zh" ? "StablePair / PoolManager" : "StablePair / PoolManager"}</CardTitle>
            <CardDescription>{t(locale, "ethv4.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="eth-pm">POOL_MANAGER</Label>
              <Input id="eth-pm" value={poolManager} onChange={(e) => setPoolManager(e.target.value)} onBlur={saveFields} spellCheck={false} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eth-hook">STABLEPAIR_HOOK</Label>
              <Input id="eth-hook" value={hook} onChange={(e) => setHook(e.target.value)} onBlur={saveFields} spellCheck={false} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eth-pools">POOL_ID_LIST</Label>
              <textarea
                id="eth-pools"
                className="min-h-[96px] w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1.5 font-mono text-xs"
                value={poolIdList}
                onChange={(e) => setPoolIdList(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eth-peg">PEG_BPS</Label>
                <Input id="eth-peg" value={pegBpsThr} onChange={(e) => setPegBpsThr(e.target.value)} onBlur={saveFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eth-lp">LP_DELTA_MIN</Label>
                <Input id="eth-lp" value={lpDeltaMin} onChange={(e) => setLpDeltaMin(e.target.value)} onBlur={saveFields} />
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
        title={t(locale, "ethv4.title")}
        tag={t(locale, "ethv4.tag")}
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
        guide={t(locale, "ethv4.guide")}
        watching={t(locale, "ethv4.watching")}
        hint={t(locale, "ethv4.hint")}
        emptyTitle={t(locale, "ethv4.emptyTitle")}
        emptySub={t(locale, "ethv4.emptySub")}
        latestLabel={t(locale, "ethv4.latest")}
        chainBadge="ETH"
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
