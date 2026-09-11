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
import { shortAddr, unpadTopic, wordAddr, wordU256, type JsonRpcLog } from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildArbRwaFlowFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

const TOPIC_TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TOPIC_PAIR =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
/** Editable samples — replace with live RWA contracts on Arb. */
const DEFAULT_RWA =
  "# editable RWA samples (SYMBOL 0xaddr) — verify / replace\nUSDY 0x35e5dB674D8e93a03d891489ff2Bd2113235824c\nBUIDL 0xA900A17a49Bc46D962587771Ae815E7991e7e6E0";
/** Live Arb stables — editable. */
const DEFAULT_STABLE =
  "# editable stables on Arbitrum One\nUSDC 0xaf88d065e77c8cC2239327C5EDb3A432268e5831\nUSDT 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9\nUSDC.e 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
/** Editable sample — SushiSwap V2 factory on Arb (PairCreated). */
const DEFAULT_FACTORY =
  "# editable factory list\nSushiV2 0xc35DADB65012eC5796536bD9864eD8773aBc74C4";
const DEFAULT_MIN_USD = "10000";
const DEFAULT_MIN_RAW = "10000000000"; // 1e10 raw (~10k @ 6 decimals)
const LS = "blockreq.arbitrum-rwa-flow.";
const SLUG = "arbitrum-rwa-flow-listen";

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

function parseFactoryList(text: string): string[] {
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

function mapTransferHist(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    const token = String(log.address || "");
    const from = unpadTopic(log.topics?.[1]);
    const isMint = !from || from === "0x0000000000000000000000000000000000000000";
    return {
      id: `hist:${log.transactionHash}:${log.logIndex ?? i}`,
      kind: isMint
        ? locale === "zh"
          ? "历史 mint"
          : "Recent mint"
        : locale === "zh"
          ? "历史 Transfer"
          : "Recent Transfer",
      tags: ["HIST", "ARB", isMint ? "MINT" : "XFER"],
      title: shortAddr(token),
      body: `pad rwa-flow · ${shortAddr(token)} · #${bn}`,
      address: token || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "ARB",
      at: now - i * 400,
    };
  });
}

/**
 * Arb RWA mint / Transfer / PairCreated flow panel.
 * Layout: launch-feed — continuous flow tape + sticky kind card.
 */
export function ArbitrumRwaFlowDemo({ locale }: { locale: Locale }) {
  const [rwaText, setRwaText] = useState(DEFAULT_RWA);
  const [stableText, setStableText] = useState(DEFAULT_STABLE);
  const [factoryText, setFactoryText] = useState(DEFAULT_FACTORY);
  const [minUsd, setMinUsd] = useState(DEFAULT_MIN_USD);
  const [minRaw, setMinRaw] = useState(DEFAULT_MIN_RAW);
  const [topicXfer, setTopicXfer] = useState(TOPIC_TRANSFER);
  const [topicPair, setTopicPair] = useState(TOPIC_PAIR);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "arbitrum");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildArbRwaFlowFixtures(locale, 6), [locale]);
  const tokenAddrs = useMemo(() => {
    const m = new Map([...parseAddrList(rwaText), ...parseAddrList(stableText)]);
    return [...m.keys()];
  }, [rwaText, stableText]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: tokenAddrs[0],
    topics: [topicXfer],
    map: (logs) => mapTransferHist(logs, locale),
    enabled: !!ep.https.trim() && tokenAddrs.length > 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const rwaMap = useRef(new Map<string, string>());
  const stableMap = useRef(new Map<string, string>());
  const factorySet = useRef(new Set<string>());
  const fields = useRef({
    rwaText,
    stableText,
    factoryText,
    minUsd,
    minRaw,
    topicXfer,
    topicPair,
  });
  fields.current = { rwaText, stableText, factoryText, minUsd, minRaw, topicXfer, topicPair };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildArbRwaFlowFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const r = localStorage.getItem(LS + "rwa");
      const s = localStorage.getItem(LS + "stable");
      const f = localStorage.getItem(LS + "factory");
      const u = localStorage.getItem(LS + "minUsd");
      const raw = localStorage.getItem(LS + "minRaw");
      if (r) setRwaText(r);
      if (s) setStableText(s);
      if (f) setFactoryText(f);
      if (u) setMinUsd(u);
      if (raw) setMinRaw(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "rwa", fields.current.rwaText);
      localStorage.setItem(LS + "stable", fields.current.stableText);
      localStorage.setItem(LS + "factory", fields.current.factoryText);
      localStorage.setItem(LS + "minUsd", fields.current.minUsd.trim() || DEFAULT_MIN_USD);
      localStorage.setItem(LS + "minRaw", fields.current.minRaw.trim() || DEFAULT_MIN_RAW);
      rwaMap.current = parseAddrList(fields.current.rwaText);
      stableMap.current = parseAddrList(fields.current.stableText);
      factorySet.current = new Set(parseFactoryList(fields.current.factoryText));
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

  const onTransfer = useCallback(
    (r: Record<string, unknown>) => {
      const token = String(r.address || "").toLowerCase();
      const sym = rwaMap.current.get(token) || stableMap.current.get(token);
      if (!sym) return;
      const topics = (r.topics as string[]) || [];
      const from = unpadTopic(topics[1]);
      const to = unpadTopic(topics[2]);
      const amount = wordU256(r.data as string, 0);
      let minRaw = 0n;
      try {
        minRaw = BigInt(fields.current.minRaw.trim() || DEFAULT_MIN_RAW);
      } catch {
        minRaw = BigInt(DEFAULT_MIN_RAW);
      }
      const minUsdNum = Number(fields.current.minUsd.trim() || DEFAULT_MIN_USD) || 0;
      // Soft USD→raw assuming 6-decimal stables/RWA when MIN_TRANSFER_USD is set.
      const minFromUsd = minUsdNum > 0 ? BigInt(Math.floor(minUsdNum * 1e6)) : 0n;
      const threshold = minRaw > minFromUsd ? minRaw : minFromUsd;
      const isMint = !from || from === "0x0000000000000000000000000000000000000000";
      if (amount < threshold) return;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const kind = isMint ? "mint" : "transfer";
      const kindLabel =
        kind === "mint"
          ? locale === "zh"
            ? "mint 铸币"
            : "mint"
          : locale === "zh"
            ? "Transfer"
            : "transfer";
      const counterparty = isMint ? to : from;
      pushEvent({
        kind: kindLabel,
        tags: [kind.toUpperCase(), "RWA", "ARB", sym],
        title: sym,
        body: `pad rwa-flow · kind=${kind} · token ${sym} ${shortAddr(token)} · amt ${formatRaw(amount)} · cp ${shortAddr(counterparty)} · #${bn}`,
        address: token,
        block: bn,
        tx: tx || undefined,
        chain: "ARB",
        metric: formatRaw(amount),
        metricLabel: locale === "zh" ? "数量" : "Amount",
        metric2: kind,
        metric2Label: "kind",
      });
    },
    [locale, pushEvent]
  );

  const onPairCreated = useCallback(
    (r: Record<string, unknown>) => {
      const factory = String(r.address || "").toLowerCase();
      if (factorySet.current.size && !factorySet.current.has(factory)) return;
      const topics = (r.topics as string[]) || [];
      const token0 = unpadTopic(topics[1]);
      const token1 = unpadTopic(topics[2]);
      const pair = wordAddr(r.data as string, 0);
      const s0 = rwaMap.current.get(token0) || stableMap.current.get(token0);
      const s1 = rwaMap.current.get(token1) || stableMap.current.get(token1);
      if (!s0 && !s1) return;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const hit = s0 || s1 || "?";
      pushEvent({
        kind: locale === "zh" ? "PairCreated 开池" : "pair",
        tags: ["PAIR", "RWA", "ARB", hit],
        title: hit,
        body: `pad rwa-flow · kind=pair · ${shortAddr(token0)}/${shortAddr(token1)} · pair ${shortAddr(pair)} · factory ${shortAddr(factory)} · #${bn}`,
        address: pair || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "ARB",
        metric: shortAddr(pair),
        metricLabel: "pair",
        metric2: "pair",
        metric2Label: "kind",
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
      if (t0 === fields.current.topicXfer.trim().toLowerCase()) return onTransfer(r);
      if (t0 === fields.current.topicPair.trim().toLowerCase()) return onPairCreated(r);
    },
    [onTransfer, onPairCreated]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const tokens = [
      ...parseAddrList(fields.current.rwaText).keys(),
      ...parseAddrList(fields.current.stableText).keys(),
    ];
    const factories = parseFactoryList(fields.current.factoryText);
    const tx = fields.current.topicXfer.trim().toLowerCase();
    const tp = fields.current.topicPair.trim().toLowerCase();

    // Chunk addresses — some nodes limit filter address array size.
    const chunk = <T,>(arr: T[], n: number) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };
    for (const addrs of chunk(tokens, 20)) {
      if (!addrs.length) continue;
      send("eth_subscribe", ["logs", { address: addrs, topics: [tx] }]);
    }
    for (const addrs of chunk(factories, 10)) {
      if (!addrs.length) continue;
      send("eth_subscribe", ["logs", { address: addrs, topics: [tp] }]);
    }
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
    { label: t(locale, "rwa.rwaLabel"), value: String(parseAddrList(rwaText).size) },
    { label: t(locale, "rwa.stableLabel"), value: String(parseAddrList(stableText).size) },
    { label: t(locale, "rwa.factoryLabel"), value: String(parseFactoryList(factoryText).length) },
    { label: "MIN_RAW", value: minRaw },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "arb.rwa-flow" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "mint|transfer|pair" },
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
            <CardTitle>{t(locale, "rwa.settingsTitle")}</CardTitle>
            <CardDescription>{t(locale, "rwa.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rwa-list">{t(locale, "rwa.rwaLabel")}</Label>
              <textarea
                id="rwa-list"
                className="min-h-[72px] w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2.5 py-2 font-mono text-xs"
                value={rwaText}
                onChange={(e) => setRwaText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stable-list">{t(locale, "rwa.stableLabel")}</Label>
              <textarea
                id="stable-list"
                className="min-h-[72px] w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2.5 py-2 font-mono text-xs"
                value={stableText}
                onChange={(e) => setStableText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="factory-list">{t(locale, "rwa.factoryLabel")}</Label>
              <textarea
                id="factory-list"
                className="min-h-[56px] w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2.5 py-2 font-mono text-xs"
                value={factoryText}
                onChange={(e) => setFactoryText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-usd">MIN_TRANSFER_USD</Label>
                <Input id="min-usd" value={minUsd} onChange={(e) => setMinUsd(e.target.value)} onBlur={saveFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min-raw">MIN_RAW</Label>
                <Input id="min-raw" value={minRaw} onChange={(e) => setMinRaw(e.target.value)} onBlur={saveFields} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-xfer">Transfer topic0</Label>
              <Input id="topic-xfer" value={topicXfer} onChange={(e) => setTopicXfer(e.target.value)} onBlur={saveFields} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-pair">PAIR_CREATED_TOPIC0</Label>
              <Input id="topic-pair" value={topicPair} onChange={(e) => setTopicPair(e.target.value)} onBlur={saveFields} />
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
        title={t(locale, "rwa.title")}
        tag={t(locale, "rwa.tag")}
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
        guide={t(locale, "rwa.guide")}
        watching={t(locale, "rwa.watching")}
        hint={t(locale, "rwa.hint")}
        emptyTitle={t(locale, "rwa.emptyTitle")}
        emptySub={t(locale, "rwa.emptySub")}
        latestLabel={t(locale, "rwa.latest")}
        chainBadge="Arb"
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
