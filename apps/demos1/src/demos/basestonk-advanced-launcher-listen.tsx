import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { buildBasestonkAdvancedLauncherFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Verified AdvancedLauncherV2 factory (Base) — MUST prefill */
const DEFAULT_LAUNCHER = "0x74655F443D25c5d401a582c68dEA02ACd170E12f";
/** AdvancedLaunched(address indexed token, address indexed creator, bytes32 indexed poolId, address pairToken, uint160 sqrtPriceX96, uint16 taxBps, uint16 burnBps, uint16 liquidityBps, uint256 payees) */
const DEFAULT_ADVANCED_LAUNCHED_TOPIC0 =
  "0x508e31622f2b7886bd54a544c43d38ad441276dd8b24f0fb37e7c793869f6997";
/** Optional RewardsEnabled(address indexed token, address indexed distributor, uint16 rewardsBps) */
const DEFAULT_REWARDS_ENABLED_TOPIC0 =
  "0xb81f9f11a2acb6af66c5c51d85549c75b536f7883a622f210ee25530a807c08a";

/** Hint chips (read-only / paste refs) — verified BaseStonk desk */
const HINT_FEE_HOOK = "0x03d2434D5A9AB7FB46bD3c7956A7C62E0Cd46044";
const HINT_POOL_MANAGER = "0x498581fF718922c3f8e6A244956aF099B2652b2b";
const HINT_PAIR_ORACLE = "0xd5a639149f9e0af9b00e9370110fc8847a71b867";
const HINT_REWARDS_FACTORY = "0x7847b926c75c931488bc023e680cee7cb8c948be";
const SAMPLE_BSTONK = "0x0f61edbfe6cd86024c0f210c0695b08df55fdfc9";

const LS = "blockreq.basestonk-advanced-launcher.";
const SLUG = "basestonk-advanced-launcher-listen";

const ADVANCED_LAUNCHED_ABI = parseAbiItem(
  "event AdvancedLaunched(address indexed token, address indexed creator, bytes32 indexed poolId, address pairToken, uint160 sqrtPriceX96, uint16 taxBps, uint16 burnBps, uint16 liquidityBps, uint256 payees)"
);

const REWARDS_ENABLED_ABI = parseAbiItem(
  "event RewardsEnabled(address indexed token, address indexed distributor, uint16 rewardsBps)"
);

type LaunchCard = {
  pad: "basestonk";
  token: string;
  creator: string;
  poolId: string;
  pairToken: string;
  sqrtPriceX96: string;
  taxBps: string;
  burnBps: string;
  liquidityBps: string;
  payees: string;
  launchTx: string;
  blockNumber: number;
  ts: number;
  rewardsDistributor?: string;
  rewardsBps?: string;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function isTopic0(v: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(v.trim());
}

function decodeAdvancedLaunched(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [ADVANCED_LAUNCHED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      creator?: string;
      poolId?: Hex;
      pairToken?: string;
      sqrtPriceX96?: bigint;
      taxBps?: number | bigint;
      burnBps?: number | bigint;
      liquidityBps?: number | bigint;
      payees?: bigint;
    };
    return {
      token: (args.token || unpadTopic(topics[1]) || "").toLowerCase(),
      creator: (args.creator || unpadTopic(topics[2]) || "").toLowerCase(),
      poolId: String(args.poolId || topics[3] || ""),
      pairToken: (args.pairToken || "").toLowerCase(),
      sqrtPriceX96: args.sqrtPriceX96 != null ? args.sqrtPriceX96.toString() : "",
      taxBps: args.taxBps != null ? String(args.taxBps) : "",
      burnBps: args.burnBps != null ? String(args.burnBps) : "",
      liquidityBps: args.liquidityBps != null ? String(args.liquidityBps) : "",
      payees: args.payees != null ? args.payees.toString() : "",
    };
  } catch {
    return {
      token: unpadTopic(topics[1]),
      creator: unpadTopic(topics[2]),
      poolId: topics[3] || "",
      pairToken: "",
      sqrtPriceX96: "",
      taxBps: "",
      burnBps: "",
      liquidityBps: "",
      payees: "",
    };
  }
}

function decodeRewardsEnabled(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [REWARDS_ENABLED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      distributor?: string;
      rewardsBps?: number | bigint;
    };
    return {
      token: (args.token || unpadTopic(topics[1]) || "").toLowerCase(),
      distributor: (args.distributor || unpadTopic(topics[2]) || "").toLowerCase(),
      rewardsBps: args.rewardsBps != null ? String(args.rewardsBps) : "",
    };
  } catch {
    return {
      token: unpadTopic(topics[1]),
      distributor: unpadTopic(topics[2]),
      rewardsBps: "",
    };
  }
}

function mapAdvancedLaunchedLogs(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const decoded = decodeAdvancedLaunched(log as unknown as Record<string, unknown>);
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: L(locale, "Recent AdvancedLaunched", "历史 AdvancedLaunched"),
      tags: ["HIST", "BASE", "BASESTONK", "ADVANCEDLAUNCHED", "pad:basestonk", "RADAR"],
      title: shortAddr(decoded.token) || "—",
      body: `pad:basestonk · token ${shortAddr(decoded.token)} · creator ${shortAddr(decoded.creator)} · poolId ${shortAddr(decoded.poolId)} · pairToken ${shortAddr(decoded.pairToken)} · sqrtPriceX96 ${decoded.sqrtPriceX96 || "—"} · taxBps ${decoded.taxBps || "—"} · burnBps ${decoded.burnBps || "—"} · liquidityBps ${decoded.liquidityBps || "—"} · payees ${decoded.payees || "—"} · #${bn}`,
      address: decoded.token || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "BASE",
      at: now - i * 400,
      metric: decoded.taxBps ? `${decoded.taxBps} bps` : shortAddr(decoded.pairToken),
      metricLabel: decoded.taxBps ? "tax" : L(locale, "pair", "配对"),
      metric2: `#${bn}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

/**
 * BaseStonk AdvancedLauncherV2 listen — AdvancedLaunched primary (+ optional RewardsEnabled).
 * Layout: launch-feed AnonStream (flashy open-card radar). RPC collapsed secondary.
 * endpointKey: base — BlockReq Base public only.
 */
export function BasestonkAdvancedLauncherListenDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [launcher, setLauncher] = useState(DEFAULT_LAUNCHER);
  const [advancedLaunchedTopic, setAdvancedLaunchedTopic] = useState(DEFAULT_ADVANCED_LAUNCHED_TOPIC0);
  const [rewardsEnabledTopic, setRewardsEnabledTopic] = useState(DEFAULT_REWARDS_ENABLED_TOPIC0);
  const [subRewards, setSubRewards] = useState(true);
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

  const seedEvents = useMemo(() => buildBasestonkAdvancedLauncherFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: launcher.trim() || DEFAULT_LAUNCHER,
    topics: [advancedLaunchedTopic.trim() || DEFAULT_ADVANCED_LAUNCHED_TOPIC0],
    map: (logs) => mapAdvancedLaunchedLogs(logs, locale),
    enabled: isAddr(launcher.trim() || DEFAULT_LAUNCHER) && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launchDedup = useRef(new Set<string>());
  const rewardsByToken = useRef(new Map<string, { distributor: string; rewardsBps: string }>());
  const fields = useRef({
    launcher,
    advancedLaunchedTopic,
    rewardsEnabledTopic,
    subRewards,
  });
  fields.current = { launcher, advancedLaunchedTopic, rewardsEnabledTopic, subRewards };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildBasestonkAdvancedLauncherFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const ln = localStorage.getItem(LS + "launcher");
      const tp = localStorage.getItem(LS + "advancedLaunchedTopic");
      const rt = localStorage.getItem(LS + "rewardsEnabledTopic");
      const sr = localStorage.getItem(LS + "subRewards");
      if (ln) setLauncher(ln);
      if (tp) setAdvancedLaunchedTopic(tp);
      if (rt) setRewardsEnabledTopic(rt);
      if (sr != null) setSubRewards(sr === "1" || sr === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "launcher", fields.current.launcher.trim() || DEFAULT_LAUNCHER);
      localStorage.setItem(
        LS + "advancedLaunchedTopic",
        fields.current.advancedLaunchedTopic.trim() || DEFAULT_ADVANCED_LAUNCHED_TOPIC0
      );
      localStorage.setItem(
        LS + "rewardsEnabledTopic",
        fields.current.rewardsEnabledTopic.trim() || DEFAULT_REWARDS_ENABLED_TOPIC0
      );
      localStorage.setItem(LS + "subRewards", fields.current.subRewards ? "1" : "0");
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
      const rewardsBits =
        card.rewardsDistributor || card.rewardsBps
          ? ` · rewardsDistributor ${shortAddr(card.rewardsDistributor || "")} · rewardsBps ${card.rewardsBps || "—"}`
          : "";
      pushEvent({
        kind: L(locale, kindEn, kindZh),
        tags: [
          "NEW",
          "BASE",
          "BASESTONK",
          "ADVANCEDLAUNCHED",
          `pad:${card.pad}`,
          "RADAR",
          ...extraTags,
        ],
        title: shortAddr(card.token) || "—",
        body: `pad:${card.pad} · token ${shortAddr(card.token)} · creator ${shortAddr(card.creator)} · poolId ${shortAddr(card.poolId)} · pairToken ${shortAddr(card.pairToken)} · sqrtPriceX96 ${card.sqrtPriceX96 || "—"} · taxBps ${card.taxBps || "—"} · burnBps ${card.burnBps || "—"} · liquidityBps ${card.liquidityBps || "—"} · payees ${card.payees || "—"} · launchTx ${shortAddr(card.launchTx)} · #${card.blockNumber}${rewardsBits}`,
        address: card.token || undefined,
        block: card.blockNumber,
        tx: card.launchTx || undefined,
        chain: "BASE",
        metric: card.taxBps ? `${card.taxBps} bps` : shortAddr(card.pairToken),
        metricLabel: card.taxBps ? "tax" : L(locale, "pair", "配对"),
        metric2: card.burnBps
          ? `burn ${card.burnBps}`
          : card.liquidityBps
            ? `liq ${card.liquidityBps}`
            : `#${card.blockNumber}`,
        metric2Label: card.burnBps
          ? "burn"
          : card.liquidityBps
            ? "liq"
            : L(locale, "Block", "区块"),
        at: card.ts,
      });
    },
    [locale, pushEvent]
  );

  const onAdvancedLaunched = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeAdvancedLaunched(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      const rewards = rewardsByToken.current.get(decoded.token.toLowerCase());
      emitLaunch(
        {
          pad: "basestonk",
          token: decoded.token.toLowerCase(),
          creator: (decoded.creator || "").toLowerCase(),
          poolId: decoded.poolId,
          pairToken: (decoded.pairToken || "").toLowerCase(),
          sqrtPriceX96: decoded.sqrtPriceX96,
          taxBps: decoded.taxBps,
          burnBps: decoded.burnBps,
          liquidityBps: decoded.liquidityBps,
          payees: decoded.payees,
          launchTx: tx,
          blockNumber: bn,
          ts: Date.now(),
          rewardsDistributor: rewards?.distributor,
          rewardsBps: rewards?.rewardsBps,
        },
        "BaseStonk AdvancedLaunched",
        "BaseStonk AdvancedLaunched",
        ["SNIPER", "OPEN"]
      );
    },
    [emitLaunch]
  );

  const onRewardsEnabled = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeRewardsEnabled(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `rew:${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      rewardsByToken.current.set(decoded.token.toLowerCase(), {
        distributor: (decoded.distributor || "").toLowerCase(),
        rewardsBps: decoded.rewardsBps,
      });
      pushEvent({
        kind: L(locale, "BaseStonk RewardsEnabled", "BaseStonk RewardsEnabled"),
        tags: ["NEW", "BASE", "BASESTONK", "REWARDSENABLED", "pad:basestonk", "REWARDS"],
        title: shortAddr(decoded.token) || "—",
        body: `pad:basestonk · token ${shortAddr(decoded.token)} · distributor ${shortAddr(decoded.distributor)} · rewardsBps ${decoded.rewardsBps || "—"} · tx ${shortAddr(tx)} · #${bn}`,
        address: decoded.token,
        block: bn,
        tx: tx || undefined,
        chain: "BASE",
        metric: decoded.rewardsBps ? `${decoded.rewardsBps} bps` : "rewards",
        metricLabel: "rewards",
        metric2: `#${bn}`,
        metric2Label: L(locale, "Block", "区块"),
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
      const launchT = (
        fields.current.advancedLaunchedTopic.trim() || DEFAULT_ADVANCED_LAUNCHED_TOPIC0
      ).toLowerCase();
      const rewardsT = (
        fields.current.rewardsEnabledTopic.trim() || DEFAULT_REWARDS_ENABLED_TOPIC0
      ).toLowerCase();
      if (t0 === launchT) return onAdvancedLaunched(r);
      if (fields.current.subRewards && t0 === rewardsT) return onRewardsEnabled(r);
    },
    [onAdvancedLaunched, onRewardsEnabled]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const addr = (fields.current.launcher.trim() || DEFAULT_LAUNCHER).toLowerCase();
    if (!isAddr(addr)) {
      setStatus("error");
      return;
    }
    const lt = (
      fields.current.advancedLaunchedTopic.trim() || DEFAULT_ADVANCED_LAUNCHED_TOPIC0
    ).toLowerCase();
    if (!isTopic0(lt)) {
      setStatus("error");
      return;
    }
    send("eth_subscribe", ["logs", { address: addr, topics: [lt] }]);
    if (fields.current.subRewards) {
      const rt = (
        fields.current.rewardsEnabledTopic.trim() || DEFAULT_REWARDS_ENABLED_TOPIC0
      ).toLowerCase();
      if (isTopic0(rt)) {
        send("eth_subscribe", ["logs", { address: addr, topics: [rt] }]);
      }
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
      label: "ADVANCED_LAUNCHED_TOPIC0",
      value: advancedLaunchedTopic || DEFAULT_ADVANCED_LAUNCHED_TOPIC0,
      mono: true,
    },
    {
      label: "REWARDS_ENABLED_TOPIC0",
      value: subRewards
        ? shortAddr(rewardsEnabledTopic || DEFAULT_REWARDS_ENABLED_TOPIC0)
        : L(locale, "off", "关闭"),
      mono: true,
    },
    { label: "PAD", value: "basestonk", mono: true },
  ];
  const sourceItems = [
    { k: L(locale, "SRC", "源"), v: "BaseStonk / AdvancedLauncherV2 AdvancedLaunched" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "advanced-launcher-listen" },
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
              {L(locale, "BaseStonk · AdvancedLaunched", "BaseStonk · AdvancedLaunched")}
            </CardTitle>
            <CardDescription>{t(locale, "basestonk.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bs-launcher">LAUNCHER / AdvancedLauncherV2</Label>
              <Input
                id="bs-launcher"
                value={launcher}
                onChange={(e) => setLauncher(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-topic">ADVANCED_LAUNCHED_TOPIC0</Label>
              <Input
                id="bs-topic"
                value={advancedLaunchedTopic}
                onChange={(e) => setAdvancedLaunchedTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <label className="inline-flex items-center gap-2 border border-[rgba(0,240,255,0.22)] bg-[rgba(0,240,255,0.04)] px-2.5 py-2 text-sm text-[var(--color-foreground)]">
              <input
                type="checkbox"
                checked={subRewards}
                onChange={(e) => {
                  setSubRewards(e.target.checked);
                  try {
                    localStorage.setItem(LS + "subRewards", e.target.checked ? "1" : "0");
                  } catch {
                    /* ignore */
                  }
                  reconnectIfRunning();
                }}
                className="h-4 w-4"
              />
              {L(locale, "Optional RewardsEnabled topic0 chip", "可选 RewardsEnabled topic0 芯片")}
            </label>
            {subRewards ? (
              <div className="space-y-1.5">
                <Label htmlFor="bs-rewards">REWARDS_ENABLED_TOPIC0</Label>
                <Input
                  id="bs-rewards"
                  value={rewardsEnabledTopic}
                  onChange={(e) => setRewardsEnabledTopic(e.target.value)}
                  onBlur={saveFields}
                  spellCheck={false}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {hintChip("FEE_HOOK", HINT_FEE_HOOK)}
              {hintChip("POOL_MGR", HINT_POOL_MANAGER)}
              {hintChip("PAIR_ORACLE", HINT_PAIR_ORACLE)}
              {hintChip("REWARDS_FACTORY", HINT_REWARDS_FACTORY)}
              {hintChip("BSTONK", SAMPLE_BSTONK)}
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {L(locale, "Hint chips read-only / paste · click to copy. BaseStonk AdvancedLauncherV2", "提示芯片只读/可粘贴 · 点复制。BaseStonk AdvancedLauncherV2")}
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
        title={t(locale, "basestonk.title")}
        tag={t(locale, "basestonk.tag")}
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
        onSelect={onSelectCard}
        onPause={pause}
        onResume={resume}
        running={running}
        connecting={status === "connecting"}
        history={history}
        watchParams={watchParams}
        sourceItems={sourceItems}
        guide={t(locale, "basestonk.guide")}
        watching={t(locale, "basestonk.watching")}
        hint={t(locale, "basestonk.hint")}
        emptyTitle={t(locale, "basestonk.emptyTitle")}
        emptySub={t(locale, "basestonk.emptySub")}
        latestLabel={t(locale, "basestonk.latest")}
        chainBadge="BASE"
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
