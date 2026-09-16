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
import { isAddr, shortAddr, unpadTopic, type JsonRpcLog } from "@blockreq/rpc";
import { decodeEventLog, parseAbiItem, type Hex } from "viem";
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointConfigSlot } from "../components/endpoint-config-slot";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildCrossrateRhcFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Verified Crossrate Launcher (RH) — MUST prefill */
const DEFAULT_LAUNCHER = "0x9Ec62caaEDE8Ee54fa1B8BF4747B0bAA523bD5C2";
/** TokenLaunched(address indexed token, address indexed creator, address indexed quoteToken, bytes32 poolId, uint16 taxBps, uint256 supply, uint128 liquidity) */
const DEFAULT_TOKEN_LAUNCHED_TOPIC0 =
  "0xe0809b2ad8aaf52f5807c111a464b3be723a8bad83656da180797a3ecca26a15";

/** Hint chips (read-only / paste refs) — verified Crossrate desk */
const HINT_FACTORY = "0x3032FdC533eb03C5e1B2fA685172541825601C73";
const HINT_RATE_HOOK = "0xFC3C624F7b94fD6C7274972D6966d0cA9b1c60Cc";
const HINT_LOCKER = "0x7a5a3C497D6Bacea16eb7267e8D76A4bA353134E";
const HINT_OWNER = "0xcfF2514c888f3FA9B272005D69A2b1E8240cC3F0";
const HINT_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const HINT_USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
/** Sample AED quote + DUBAI token (hint / idle only) */
const SAMPLE_AED_QUOTE = "0x8998b43B5450D41B88E67a0914064b8F8445126D";
const SAMPLE_DUBAI = "0xd63a5E75412CC82d5aA68CD390578e993a2d4c4f";

const DEFAULT_CURRENCY_DESK = `{
  "${SAMPLE_AED_QUOTE.toLowerCase()}": "AED",
  "${HINT_USDG.toLowerCase()}": "USDG"
}`;

const LS = "blockreq.crossrate-rhc-currency-launch.";
const SLUG = "crossrate-rhc-currency-launch-listen";

const TOKEN_LAUNCHED_ABI = parseAbiItem(
  "event TokenLaunched(address indexed token, address indexed creator, address indexed quoteToken, bytes32 poolId, uint16 taxBps, uint256 supply, uint128 liquidity)"
);

type LaunchCard = {
  pad: "crossrate";
  token: string;
  creator: string;
  quoteToken: string;
  currency: string;
  poolId: string;
  taxBps: string;
  supply: string;
  liquidity: string;
  launchTx: string;
  blockNumber: number;
  ts: number;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function isTopic0(v: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(v.trim());
}

function parseCurrencyDesk(raw: string): Record<string, string> {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v.trim()) {
        out[k.trim().toLowerCase()] = v.trim().toUpperCase();
      }
    }
    return out;
  } catch {
    return {};
  }
}

function resolveCurrency(quoteToken: string, desk: Record<string, string>) {
  const q = (quoteToken || "").toLowerCase();
  if (desk[q]) return desk[q];
  return shortAddr(quoteToken) || "FX";
}

function decodeTokenLaunched(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [TOKEN_LAUNCHED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      creator?: string;
      quoteToken?: string;
      poolId?: Hex;
      taxBps?: number | bigint;
      supply?: bigint;
      liquidity?: bigint;
    };
    return {
      token: (args.token || unpadTopic(topics[1]) || "").toLowerCase(),
      creator: (args.creator || unpadTopic(topics[2]) || "").toLowerCase(),
      quoteToken: (args.quoteToken || unpadTopic(topics[3]) || "").toLowerCase(),
      poolId: String(args.poolId || ""),
      taxBps: args.taxBps != null ? String(args.taxBps) : "",
      supply: args.supply != null ? args.supply.toString() : "",
      liquidity: args.liquidity != null ? args.liquidity.toString() : "",
    };
  } catch {
    return {
      token: unpadTopic(topics[1]),
      creator: unpadTopic(topics[2]),
      quoteToken: unpadTopic(topics[3]),
      poolId: "",
      taxBps: "",
      supply: "",
      liquidity: "",
    };
  }
}

function mapTokenLaunchedLogs(
  logs: JsonRpcLog[],
  locale: Locale,
  desk: Record<string, string>
): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const decoded = decodeTokenLaunched(log as unknown as Record<string, unknown>);
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    const currency = resolveCurrency(decoded.quoteToken, desk);
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: L(locale, "Recent TokenLaunched", "历史 TokenLaunched"),
      tags: ["HIST", "RH", "CROSSRATE", "TOKENLAUNCHED", "pad:crossrate", currency, "FX", "RADAR"],
      title: currency,
      body: `pad:crossrate · currency ${currency} · token ${shortAddr(decoded.token)} · creator ${shortAddr(decoded.creator)} · quoteToken ${shortAddr(decoded.quoteToken)} · poolId ${shortAddr(decoded.poolId)} · taxBps ${decoded.taxBps || "—"} · supply ${decoded.supply || "—"} · liquidity ${decoded.liquidity || "—"} · #${bn}`,
      address: decoded.token || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "RH",
      at: now - i * 400,
      metric: currency,
      metricLabel: L(locale, "FX", "货币"),
      metric2: `#${bn}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

/**
 * Crossrate RHC FX launchpad listen — Launcher TokenLaunched primary (currency quote opens).
 * Layout: launch-feed AnonStream (flashy FX radar / sticky card). RPC collapsed secondary.
 */
export function CrossrateRhcCurrencyLaunchListenDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [launcher, setLauncher] = useState(DEFAULT_LAUNCHER);
  const [tokenLaunchedTopic, setTokenLaunchedTopic] = useState(DEFAULT_TOKEN_LAUNCHED_TOPIC0);
  const [currencyDeskRaw, setCurrencyDeskRaw] = useState(DEFAULT_CURRENCY_DESK);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits();
  const ep = useEditableEndpoints(SLUG, "robinhood");
  const epRef = useRef(ep);
  epRef.current = ep;

  const currencyDesk = useMemo(() => parseCurrencyDesk(currencyDeskRaw), [currencyDeskRaw]);

  const seedEvents = useMemo(() => buildCrossrateRhcFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: launcher.trim() || DEFAULT_LAUNCHER,
    topics: [tokenLaunchedTopic.trim() || DEFAULT_TOKEN_LAUNCHED_TOPIC0],
    map: (logs) => mapTokenLaunchedLogs(logs, locale, currencyDesk),
    enabled: isAddr(launcher.trim() || DEFAULT_LAUNCHER) && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launchDedup = useRef(new Set<string>());
  const fields = useRef({
    launcher,
    tokenLaunchedTopic,
    currencyDeskRaw,
  });
  fields.current = { launcher, tokenLaunchedTopic, currencyDeskRaw };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildCrossrateRhcFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const ln = localStorage.getItem(LS + "launcher");
      const tp = localStorage.getItem(LS + "tokenLaunchedTopic");
      const desk = localStorage.getItem(LS + "currencyDesk");
      if (ln) setLauncher(ln);
      if (tp) setTokenLaunchedTopic(tp);
      if (desk) setCurrencyDeskRaw(desk);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "launcher", fields.current.launcher.trim() || DEFAULT_LAUNCHER);
      localStorage.setItem(
        LS + "tokenLaunchedTopic",
        fields.current.tokenLaunchedTopic.trim() || DEFAULT_TOKEN_LAUNCHED_TOPIC0
      );
      localStorage.setItem(LS + "currencyDesk", fields.current.currencyDeskRaw);
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

  const emitLaunch = useCallback(
    (card: LaunchCard, kindZh: string, kindEn: string, extraTags: string[] = []) => {
      pushEvent({
        kind: L(locale, kindEn, kindZh),
        tags: [
          "NEW",
          "RH",
          "CROSSRATE",
          "TOKENLAUNCHED",
          `pad:${card.pad}`,
          card.currency,
          "FX",
          ...extraTags,
        ],
        title: card.currency,
        body: `pad:${card.pad} · currency ${card.currency} · token ${shortAddr(card.token)} · creator ${shortAddr(card.creator)} · quoteToken ${shortAddr(card.quoteToken)} · poolId ${shortAddr(card.poolId)} · taxBps ${card.taxBps || "—"} · supply ${card.supply || "—"} · liquidity ${card.liquidity || "—"} · launchTx ${shortAddr(card.launchTx)} · #${card.blockNumber}`,
        address: card.token || undefined,
        block: card.blockNumber,
        tx: card.launchTx || undefined,
        chain: "RH",
        metric: card.currency,
        metricLabel: L(locale, "FX", "货币"),
        metric2: card.taxBps ? `${card.taxBps} bps` : `#${card.blockNumber}`,
        metric2Label: card.taxBps ? "tax" : L(locale, "Block", "区块"),
        at: card.ts,
      });
    },
    [locale, pushEvent]
  );

  const onTokenLaunched = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeTokenLaunched(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      const desk = parseCurrencyDesk(fields.current.currencyDeskRaw);
      const currency = resolveCurrency(decoded.quoteToken, desk);
      emitLaunch(
        {
          pad: "crossrate",
          token: decoded.token.toLowerCase(),
          creator: (decoded.creator || "").toLowerCase(),
          quoteToken: (decoded.quoteToken || "").toLowerCase(),
          currency,
          poolId: decoded.poolId,
          taxBps: decoded.taxBps,
          supply: decoded.supply,
          liquidity: decoded.liquidity,
          launchTx: tx,
          blockNumber: bn,
          ts: Date.now(),
        },
        "Crossrate TokenLaunched",
        "Crossrate TokenLaunched",
        ["SNIPER", "RADAR"]
      );
    },
    [emitLaunch]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      const launchT = (
        fields.current.tokenLaunchedTopic.trim() || DEFAULT_TOKEN_LAUNCHED_TOPIC0
      ).toLowerCase();
      if (t0 === launchT) return onTokenLaunched(r);
    },
    [onTokenLaunched]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const addr = (fields.current.launcher.trim() || DEFAULT_LAUNCHER).toLowerCase();
    if (!isAddr(addr)) {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("error");
      return;
    }
    const lt = (
      fields.current.tokenLaunchedTopic.trim() || DEFAULT_TOKEN_LAUNCHED_TOPIC0
    ).toLowerCase();
    if (!isTopic0(lt)) {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("error");
      return;
    }
    send("eth_subscribe", ["logs", { address: addr, topics: [lt] }]);
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

  const resume = useCallback(() => {
    const addr = (fields.current.launcher.trim() || DEFAULT_LAUNCHER).toLowerCase();
    if (!isAddr(addr)) {
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

  const reconnectIfRunning = useCallback(() => {
    if (!wantRun.current) return;
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    connect();
  }, [connect]);

  const onSelectCard = useCallback((id: string) => {
    setSelectedId(id);
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
    { label: "LAUNCHER", value: launcher || DEFAULT_LAUNCHER, mono: true },
    {
      label: "TOKEN_LAUNCHED_TOPIC0",
      value: tokenLaunchedTopic || DEFAULT_TOKEN_LAUNCHED_TOPIC0,
      mono: true,
    },
    {
      label: L(locale, "CURRENCY_DESK", "货币桌"),
      value: Object.keys(currencyDesk).length
        ? Object.entries(currencyDesk)
            .slice(0, 3)
            .map(([a, c]) => `${c}:${shortAddr(a)}`)
            .join(" · ")
        : L(locale, "editable quote→code", "可编辑 quote→code"),
      mono: true,
    },
    { label: "PAD", value: "crossrate", mono: true },
  ];
  const sourceItems = [
    { k: L(locale, "SRC", "源"), v: "crossrate.market / Launcher TokenLaunched" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "fx-launch-listen" },
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

  const hintChip = (label: string, addr: string) => (
    <button
      key={label}
      type="button"
      className="inline-flex items-center gap-1.5 border border-[rgba(0,240,255,0.22)] bg-[rgba(0,240,255,0.04)] px-2 py-1 font-mono text-[10px] text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.45)] hover:text-[var(--color-neon-cyan)]"
      title={addr}
      onClick={() => {
        void navigator.clipboard?.writeText(addr);
      }}
    >
      <span className="font-bold uppercase tracking-[0.06em] text-[var(--color-neon-cyan)]">{label}</span>
      {shortAddr(addr)}
    </button>
  );

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
              {L(locale, "FX launchpad · TokenLaunched", "汇率盘 · TokenLaunched")}
            </CardTitle>
            <CardDescription>{t(locale, "crossrate.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cr-launcher">LAUNCHER</Label>
              <Input
                id="cr-launcher"
                value={launcher}
                onChange={(e) => setLauncher(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-topic">TOKEN_LAUNCHED_TOPIC0</Label>
              <Input
                id="cr-topic"
                value={tokenLaunchedTopic}
                onChange={(e) => setTokenLaunchedTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-desk">
                {L(locale, "CURRENCY_DESK (quoteToken → code JSON)", "CURRENCY_DESK（quoteToken → 货币代码 JSON）")}
              </Label>
              <textarea
                id="cr-desk"
                value={currencyDeskRaw}
                onChange={(e) => setCurrencyDeskRaw(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                rows={4}
                className="w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1.5 font-mono text-[11px] text-[var(--color-foreground)]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hintChip("FACTORY", HINT_FACTORY)}
              {hintChip("RATE_HOOK", HINT_RATE_HOOK)}
              {hintChip("LOCKER", HINT_LOCKER)}
              {hintChip("OWNER", HINT_OWNER)}
              {hintChip("POOL_MGR", HINT_POOL_MANAGER)}
              {hintChip("USDG", HINT_USDG)}
              {hintChip("AED", SAMPLE_AED_QUOTE)}
              {hintChip("DUBAI", SAMPLE_DUBAI)}
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {L(locale, "Hint chips read-only / paste · click to copy. crossrate.market", "提示芯片只读/可粘贴 · 点复制。crossrate.market")}
            </p>
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
    <div className="flex min-h-screen flex-col pb-24" data-layout="launch-feed">
      <MonitorChrome
        lastUpdateAt={lastUpdateAt}
        locale={locale}
        onLocaleChange={onLocaleChange}
        title={t(locale, "crossrate.title")}
        tag={t(locale, "crossrate.tag")}
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
        onSelect={onSelectCard}
        onPause={pause}
        onResume={resume}
        running={running}
        connecting={status === "connecting"}
        history={history}
        watchParams={watchParams}
        sourceItems={sourceItems}
        guide={t(locale, "crossrate.guide")}
        watching={t(locale, "crossrate.watching")}
        hint={t(locale, "crossrate.hint")}
        emptyTitle={t(locale, "crossrate.emptyTitle")}
        emptySub={t(locale, "crossrate.emptySub")}
        latestLabel={t(locale, "crossrate.latest")}
        chainBadge="RH"
        endpointSlot={
          <EndpointConfigSlot
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
              reconnectIfRunning();
            }}
            onReset={() => {
              ep.reset();
              reconnectIfRunning();
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
