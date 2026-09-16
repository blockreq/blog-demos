import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { openPublicWs } from "../lib/public-ws";
import { t, demoBlogUrl, demoSiteUrl, L, type Locale } from "@blockreq/i18n";
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
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildLongshotFootballFixtures, useDemoHits } from "../lib/demo-hits";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** All empty by default — no verified Longshot factory in public research. Do not invent. */
const DEFAULT_FACTORY = "";
const DEFAULT_CREATE_TOPIC0 = "";
const DEFAULT_TRADE_TOPIC0 = "";
const DEFAULT_RESOLVE_TOPIC0 = "";
const DEFAULT_MARKET_LIST = `# MARKET_LIST — optional extra markets (CSV / one addr per line)
`;

const LEAGUE_CHIPS = ["EPL", "LaLiga", "SerieA", "Bundesliga", "Ligue1", "UCL", "WorldCup"];

const LS = "blockreq.longshot-base-football.";
const SLUG = "longshot-base-football-market-listen";

type MarketKind = "create" | "trade" | "resolve";

type MarketCard = {
  pad: "longshot-football";
  kind: MarketKind;
  marketId: string;
  question?: string;
  side?: string;
  size?: string;
  price?: string;
  outcome?: string;
  payout?: string;
  txHash: string;
  blockNumber: number;
  ts: number;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function parseAddrList(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/[\r\n,]+/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    for (const p of parts) {
      if (/^0x[a-fA-F0-9]{40}$/.test(p)) {
        const low = p.toLowerCase();
        if (!seen.has(low)) {
          seen.add(low);
          out.push(low);
        }
      }
    }
  }
  return out;
}

function isTopic0(v: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(v.trim());
}

/**
 * Longshot Base football market listen — create / trade / resolve timeline.
 * All factory/topics empty by default (paste when known). Layout: launch-feed AnonStream.
 */
export function LongshotBaseFootballMarketDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [factory, setFactory] = useState(DEFAULT_FACTORY);
  const [createTopic, setCreateTopic] = useState(DEFAULT_CREATE_TOPIC0);
  const [tradeTopic, setTradeTopic] = useState(DEFAULT_TRADE_TOPIC0);
  const [resolveTopic, setResolveTopic] = useState(DEFAULT_RESOLVE_TOPIC0);
  const [marketList, setMarketList] = useState(DEFAULT_MARKET_LIST);
  const [tags, setTags] = useState<string[]>([]);
  const [matchTag, setMatchTag] = useState("");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits();
  const ep = useEditableEndpoints(SLUG, "base");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildLongshotFootballFixtures(locale, 6), [locale]);
  const history = useMemo(
    () => ({
      status: "empty" as const,
      events: [] as FeedEvent[],
      reason:
        L(locale, "Paste MARKET_FACTORY + CREATE/TRADE/RESOLVE_TOPIC0 to start", "粘贴 MARKET_FACTORY + CREATE/TRADE/RESOLVE_TOPIC0 后开始听"),
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
  const eventDedup = useRef(new Set<string>());
  const fields = useRef({
    factory,
    createTopic,
    tradeTopic,
    resolveTopic,
    marketList,
    tags,
    matchTag,
  });
  fields.current = { factory, createTopic, tradeTopic, resolveTopic, marketList, tags, matchTag };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildLongshotFootballFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LS + "factory");
      const c = localStorage.getItem(LS + "createTopic");
      const tr = localStorage.getItem(LS + "tradeTopic");
      const r = localStorage.getItem(LS + "resolveTopic");
      const ml = localStorage.getItem(LS + "marketList");
      const tg = localStorage.getItem(LS + "tags");
      const mt = localStorage.getItem(LS + "matchTag");
      if (f) setFactory(f);
      if (c) setCreateTopic(c);
      if (tr) setTradeTopic(tr);
      if (r) setResolveTopic(r);
      if (ml) setMarketList(ml);
      if (tg) {
        try {
          const parsed = JSON.parse(tg) as string[];
          if (Array.isArray(parsed)) setTags(parsed.filter((x) => typeof x === "string"));
        } catch {
          /* ignore */
        }
      }
      if (mt) setMatchTag(mt);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "createTopic", fields.current.createTopic.trim());
      localStorage.setItem(LS + "tradeTopic", fields.current.tradeTopic.trim());
      localStorage.setItem(LS + "resolveTopic", fields.current.resolveTopic.trim());
      localStorage.setItem(LS + "marketList", fields.current.marketList);
      localStorage.setItem(LS + "tags", JSON.stringify(fields.current.tags));
      localStorage.setItem(LS + "matchTag", fields.current.matchTag.trim());
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

  const tagSuffix = useCallback(() => {
    const parts = [...fields.current.tags];
    const mt = fields.current.matchTag.trim();
    if (mt) parts.push(mt);
    return parts;
  }, []);

  const emitCard = useCallback(
    (card: MarketCard) => {
      const dedupeKey = `${card.marketId.toLowerCase()}:${card.txHash.toLowerCase()}:${card.kind}`;
      if (eventDedup.current.has(dedupeKey)) return;
      eventDedup.current.add(dedupeKey);
      const kindLabel =
        card.kind === "create"
          ? L(locale, "create", "开市", { ja: "開市", ko: "개설", "zh-tw": "開市" })
          : card.kind === "trade"
            ? L(locale, "trade", "成交", { ja: "約定", ko: "체결", "zh-tw": "成交" })
            : L(locale, card.kind, "结算", { ja: "決算", ko: "정산", "zh-tw": "結算" });
      const extra = tagSuffix();
      pushEvent({
        kind: kindLabel,
        tags: [
          "BASE",
          "LONGSHOT",
          "FOOTBALL",
          `kind:${card.kind}`,
          "pad:longshot-football",
          ...extra,
        ],
        title: shortAddr(card.marketId) || kindLabel,
        body: `pad:longshot-football · kind=${card.kind} · marketId ${shortAddr(card.marketId)} · question ${card.question || "—"} · side ${card.side || "—"} · size ${card.size || "—"} · price ${card.price || "—"} · outcome ${card.outcome || "—"} · payout ${card.payout || "—"} · tx ${shortAddr(card.txHash)} · #${card.blockNumber}${extra.length ? ` · tags ${extra.join(",")}` : ""}`,
        address: card.marketId || undefined,
        block: card.blockNumber,
        tx: card.txHash || undefined,
        chain: "BASE",
        metric: card.kind,
        metricLabel: "kind",
        metric2: `#${card.blockNumber}`,
        metric2Label: L(locale, "Block", "区块"),
        at: card.ts,
      });
    },
    [locale, pushEvent, tagSuffix]
  );

  const decodeMarketId = (r: Record<string, unknown>) => {
    const topics = (r.topics as string[]) || [];
    // Prefer indexed topic[1]; fall back to address / data word0 as opaque id
    const fromTopic = unpadTopic(topics[1]);
    if (fromTopic && isAddr(fromTopic)) return fromTopic.toLowerCase();
    if (topics[1] && topics[1].length >= 66) return topics[1].toLowerCase();
    const addr = String(r.address || "").toLowerCase();
    return addr;
  };

  const onCreate = useCallback(
    (r: Record<string, unknown>) => {
      const marketId = decodeMarketId(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      emitCard({
        pad: "longshot-football",
        kind: "create",
        marketId,
        question: undefined,
        txHash: tx,
        blockNumber: bn,
        ts: Date.now(),
      });
    },
    [emitCard]
  );

  const onTrade = useCallback(
    (r: Record<string, unknown>) => {
      const marketId = decodeMarketId(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const size = wordU256(r.data as string, 0).toString();
      const price = wordU256(r.data as string, 1).toString();
      emitCard({
        pad: "longshot-football",
        kind: "trade",
        marketId,
        side: undefined,
        size,
        price,
        txHash: tx,
        blockNumber: bn,
        ts: Date.now(),
      });
    },
    [emitCard]
  );

  const onResolve = useCallback(
    (r: Record<string, unknown>) => {
      const marketId = decodeMarketId(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const outcome = wordU256(r.data as string, 0).toString();
      const payout = wordU256(r.data as string, 1).toString();
      emitCard({
        pad: "longshot-football",
        kind: "resolve",
        marketId,
        outcome,
        payout,
        txHash: tx,
        blockNumber: bn,
        ts: Date.now(),
      });
    },
    [emitCard]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      const ct = fields.current.createTopic.trim().toLowerCase();
      const tt = fields.current.tradeTopic.trim().toLowerCase();
      const rt = fields.current.resolveTopic.trim().toLowerCase();
      if (ct && t0 === ct) return onCreate(r);
      if (tt && t0 === tt) return onTrade(r);
      if (rt && t0 === rt) return onResolve(r);
    },
    [onCreate, onResolve, onTrade]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = fields.current.factory.trim().toLowerCase();
    const markets = parseAddrList(fields.current.marketList);
    const ct = fields.current.createTopic.trim().toLowerCase();
    const tt = fields.current.tradeTopic.trim().toLowerCase();
    const rt = fields.current.resolveTopic.trim().toLowerCase();
    const factoryOk = isAddr(f);
    const hasTopic = isTopic0(ct) || isTopic0(tt) || isTopic0(rt);
    if (!factoryOk && markets.length === 0) {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("error");
      return;
    }
    if (!hasTopic) {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("error");
      return;
    }
    const tradeAddrs = [
      ...(factoryOk ? [f] : []),
      ...markets,
    ].filter(isAddr);
    const uniq = [...new Set(tradeAddrs)];

    if (factoryOk && isTopic0(ct)) {
      send("eth_subscribe", ["logs", { address: f, topics: [ct] }]);
    }
    if (uniq.length && isTopic0(tt)) {
      send("eth_subscribe", [
        "logs",
        { address: uniq.length === 1 ? uniq[0] : uniq, topics: [tt] },
      ]);
    }
    if (uniq.length && isTopic0(rt)) {
      send("eth_subscribe", [
        "logs",
        { address: uniq.length === 1 ? uniq[0] : uniq, topics: [rt] },
      ]);
    }
    send("eth_subscribe", ["newHeads"]);
  }, []);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    setStatus("connecting");
    const ws = openPublicWs(epRef.current.wss);
    if (!ws) {
      if (!wantRun.current) return;
      setTimeout(connect, backoffMs.current);
      backoffMs.current = Math.min(backoffMs.current * 2, 30000);
      return;
    }
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
      if (msg.id && msg.result && typeof msg.result === "string") {
        setStatus("listening");
        return;
      }
      if (msg.id && msg.error) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
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
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [onLog, subscribeAll]);

  const canStart = useCallback(() => {
    const f = fields.current.factory.trim();
    const markets = parseAddrList(fields.current.marketList);
    const hasAddr = isAddr(f) || markets.length > 0;
    const hasTopic =
      isTopic0(fields.current.createTopic) ||
      isTopic0(fields.current.tradeTopic) ||
      isTopic0(fields.current.resolveTopic);
    return hasAddr && hasTopic;
  }, []);

  const resume = useCallback(() => {
    if (!canStart()) {
      setStatus("idle");
      return;
    }
    wantRun.current = true;
    connect();
  }, [canStart, connect]);

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
    // Empty defaults — do not auto-start until user pastes factory/topics
    return () => {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const running = status === "connecting" || status === "listening";
  const watchParams = [
    {
      label: "MARKET_FACTORY",
      value: factory.trim() || (L(locale, "(paste)", "（粘贴）")),
      mono: true,
    },
    {
      label: "CREATE_TOPIC0",
      value: createTopic.trim() ? shortAddr(createTopic) : L(locale, "(empty)", "（空）"),
      mono: true,
    },
    {
      label: "TRADE_TOPIC0",
      value: tradeTopic.trim() ? shortAddr(tradeTopic) : L(locale, "(empty)", "（空）"),
      mono: true,
    },
    {
      label: "RESOLVE_TOPIC0",
      value: resolveTopic.trim() ? shortAddr(resolveTopic) : L(locale, "(empty)", "（空）"),
      mono: true,
    },
    {
      label: "TAGS",
      value: [...tags, matchTag.trim()].filter(Boolean).join(",") || "—",
      mono: false,
    },
  ];
  const sourceItems = [
    { k: L(locale, "SRC", "源"), v: "longshot.base / football" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "create|trade|resolve" },
    { k: "WSS", v: ep.wss },
    { k: "HTTPS", v: ep.https },
    { k: "PRODUCT", v: "https://longshot.xyz" },
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

  const toggleChip = (chip: string) => {
    setTags((prev) => (prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]));
  };

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
            <CardTitle>
              {L(locale, "Football · create / trade / resolve", "足球盘 · 开市 / 成交 / 结算")}
            </CardTitle>
            <CardDescription>{t(locale, "longshot.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ls-factory">MARKET_FACTORY</Label>
              <Input
                id="ls-factory"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder={L(locale, "paste factory · no verified default", "粘贴工厂地址 · 无已验证默认")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-create">CREATE_TOPIC0</Label>
              <Input
                id="ls-create"
                value={createTopic}
                onChange={(e) => setCreateTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder="0x…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-trade">TRADE_TOPIC0</Label>
              <Input
                id="ls-trade"
                value={tradeTopic}
                onChange={(e) => setTradeTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder="0x…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-resolve">RESOLVE_TOPIC0</Label>
              <Input
                id="ls-resolve"
                value={resolveTopic}
                onChange={(e) => setResolveTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder="0x…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-markets">MARKET_LIST</Label>
              <textarea
                id="ls-markets"
                value={marketList}
                onChange={(e) => setMarketList(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                rows={3}
                className="w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 font-mono text-xs text-[var(--color-foreground)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{L(locale, "League tags", "联赛标签")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {LEAGUE_CHIPS.map((chip) => {
                  const on = tags.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleChip(chip)}
                      className={
                        on
                          ? "border border-[rgba(0,240,255,0.55)] bg-[rgba(0,240,255,0.12)] px-2 py-1 font-mono text-[10px] font-bold text-[var(--color-neon-cyan)]"
                          : "border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1 font-mono text-[10px] font-bold text-[var(--color-muted-foreground)]"
                      }
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-match">{L(locale, "Match tag", "比赛标签")}</Label>
              <Input
                id="ls-match"
                value={matchTag}
                onChange={(e) => setMatchTag(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder={L(locale, "optional · e.g. ARS-MCI", "可选 · 如 ARS-MCI")}
              />
            </div>
            <label className="inline-flex items-center gap-2 border border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.06)] px-2.5 py-2 text-sm text-[var(--color-warn)]">
              <input type="checkbox" checked={demoHits} onChange={(e) => setDemoHits(e.target.checked)} className="h-4 w-4" />
              {t(locale, "demoHits.toggle")}
            </label>
            <p className="break-all font-mono text-[11px] text-[var(--color-muted-foreground)]">
              {ep.wss} · {ep.chainIdHex} · longshot.xyz
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
        onLocaleChange={onLocaleChange}
        title={t(locale, "longshot.title")}
        tag={t(locale, "longshot.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
        blogUrl={demoBlogUrl(SLUG, locale)}
        siteUrl={demoSiteUrl(getDemo(SLUG))}
      />
      <AnonStreamLayout
        locale={locale}
        events={events}
        seedEvents={demoHits ? seedEvents : []}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPause={pause}
        onResume={resume}
        running={running}
        connecting={status === "connecting"}
        history={history}
        watchParams={watchParams}
        sourceItems={sourceItems}
        guide={t(locale, "longshot.guide")}
        watching={t(locale, "longshot.watching")}
        hint={t(locale, "longshot.hint")}
        emptyTitle={t(locale, "longshot.emptyTitle")}
        emptySub={t(locale, "longshot.emptySub")}
        latestLabel={t(locale, "longshot.latest")}
        chainBadge="BASE"
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
