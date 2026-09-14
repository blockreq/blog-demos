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
import { buildBucketRhcFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Verified Bucket launch factory (RH) — MUST prefill */
const DEFAULT_LAUNCH_FACTORY = "0x7Eb30f769403c6689944479b135620d674DEDCe3";
/** Launched(address indexed token, address indexed creator, address curve, uint256 tierId, uint256 id, bool founding) */
const DEFAULT_LAUNCHED_TOPIC0 =
  "0xe7c0e9df574006f71903192ae6dcdbbd6da1521746999feaae0225953f609ff8";
/** Graduated(address indexed token, bytes32 poolId, address lock, address splitter, uint256 quoteSeeded, uint256 tokensSeeded, uint256 tokensRetired) */
const DEFAULT_GRADUATED_TOPIC0 =
  "0xb1081ec269a8f1d91c258991f53f9733d4e48c29d67136040ff4bae163e23c19";

/** Hint chips (read-only / paste refs) */
const HINT_REGISTRY = "0x76BFb87D852E824ed97122b6Bef84E27A08249A5";
const HINT_SEEDER = "0x1990A7577643a4E617372440c83b7CA9C1b4CcFE";
const HINT_DISTRIBUTOR = "0x2CCc152AD68419f777531E6A40a52325e2A80EE2";
const HINT_PROTOCOL = "0x916d379958125702014AC690899f9C8d53880911";
const HINT_USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const HINT_BUCKET = "0xbc9E7b1c5C0081f4aE85e71eC95703d3dEC9ffaD";
const SAMPLE_BHC = "0x2d2e5cb9319c3b893db80eb6f9e2cea386720cf9";
const SAMPLE_INFINITY = "0xbd305151d3d7eb612d3969e9fa05315cd47374e4";

const LS = "blockreq.bucket-rhc-launchpad.";
const SLUG = "bucket-rhc-launchpad-listen";

const LAUNCHED_ABI = parseAbiItem(
  "event Launched(address indexed token, address indexed creator, address curve, uint256 tierId, uint256 id, bool founding)"
);
const GRADUATED_ABI = parseAbiItem(
  "event Graduated(address indexed token, bytes32 poolId, address lock, address splitter, uint256 quoteSeeded, uint256 tokensSeeded, uint256 tokensRetired)"
);

type LaunchCard = {
  pad: "bucket";
  token: string;
  creator: string;
  curve: string;
  tierId: string;
  id: string;
  founding: boolean;
  poolId?: string;
  lock?: string;
  splitter?: string;
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

function addrToTopic(addr: string) {
  const a = addr.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[a-f0-9]{40}$/.test(a)) return "";
  return `0x${a.padStart(64, "0")}`;
}

function decodeLaunched(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [LAUNCHED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      creator?: string;
      curve?: string;
      tierId?: bigint;
      id?: bigint;
      founding?: boolean;
    };
    return {
      token: (args.token || unpadTopic(topics[1]) || "").toLowerCase(),
      creator: (args.creator || unpadTopic(topics[2]) || "").toLowerCase(),
      curve: (args.curve || "").toLowerCase(),
      tierId: args.tierId != null ? args.tierId.toString() : "",
      id: args.id != null ? args.id.toString() : "",
      founding: !!args.founding,
    };
  } catch {
    return {
      token: unpadTopic(topics[1]),
      creator: unpadTopic(topics[2]),
      curve: "",
      tierId: "",
      id: "",
      founding: false,
    };
  }
}

function decodeGraduated(r: Record<string, unknown>) {
  const topics = (r.topics as string[]) || [];
  const data = (r.data as string) || "0x";
  try {
    const decoded = decodeEventLog({
      abi: [GRADUATED_ABI],
      data: data as Hex,
      topics: topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as {
      token?: string;
      poolId?: Hex;
      lock?: string;
      splitter?: string;
      quoteSeeded?: bigint;
      tokensSeeded?: bigint;
      tokensRetired?: bigint;
    };
    return {
      token: (args.token || unpadTopic(topics[1]) || "").toLowerCase(),
      poolId: String(args.poolId || ""),
      lock: (args.lock || "").toLowerCase(),
      splitter: (args.splitter || "").toLowerCase(),
      quoteSeeded: args.quoteSeeded != null ? args.quoteSeeded.toString() : "",
      tokensSeeded: args.tokensSeeded != null ? args.tokensSeeded.toString() : "",
      tokensRetired: args.tokensRetired != null ? args.tokensRetired.toString() : "",
    };
  } catch {
    return {
      token: unpadTopic(topics[1]),
      poolId: "",
      lock: "",
      splitter: "",
      quoteSeeded: "",
      tokensSeeded: "",
      tokensRetired: "",
    };
  }
}

function mapLaunchedLogs(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const decoded = decodeLaunched(log as unknown as Record<string, unknown>);
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    const foundingTag = decoded.founding ? "FOUNDING" : "STD";
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: L(locale, "Recent Launched", "历史 Launched"),
      tags: ["HIST", "RH", "BUCKET", "LAUNCHED", "pad:bucket", foundingTag, "RADAR"],
      title: shortAddr(decoded.token),
      body: `pad:bucket · token ${shortAddr(decoded.token)} · creator ${shortAddr(decoded.creator)} · curve ${shortAddr(decoded.curve)} · tierId ${decoded.tierId || "—"} · id ${decoded.id || "—"} · founding ${decoded.founding ? "yes" : "no"} · #${bn}`,
      address: decoded.token || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "RH",
      at: now - i * 400,
      metric: decoded.founding ? "FOUNDING" : decoded.id || shortAddr(decoded.curve),
      metricLabel: decoded.founding ? "founding" : "id",
      metric2: `#${bn}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

/**
 * Bucket RHC launchpad listen — factory Launched primary + optional Graduated follow.
 * Layout: launch-feed AnonStream (flashy radar / sticky card). RPC collapsed secondary.
 */
export function BucketRhcLaunchpadListenDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [launchFactory, setLaunchFactory] = useState(DEFAULT_LAUNCH_FACTORY);
  const [launchedTopic, setLaunchedTopic] = useState(DEFAULT_LAUNCHED_TOPIC0);
  const [graduatedTopic, setGraduatedTopic] = useState(DEFAULT_GRADUATED_TOPIC0);
  const [followToken, setFollowToken] = useState("");
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

  const seedEvents = useMemo(() => buildBucketRhcFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: launchFactory.trim() || DEFAULT_LAUNCH_FACTORY,
    topics: [launchedTopic.trim() || DEFAULT_LAUNCHED_TOPIC0],
    map: (logs) => mapLaunchedLogs(logs, locale),
    enabled: isAddr(launchFactory.trim() || DEFAULT_LAUNCH_FACTORY) && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launchDedup = useRef(new Set<string>());
  const fields = useRef({
    launchFactory,
    launchedTopic,
    graduatedTopic,
    followToken,
  });
  fields.current = { launchFactory, launchedTopic, graduatedTopic, followToken };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildBucketRhcFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) {
      setSelectedId(fixtures[0].id);
      if (fixtures[0].address) setFollowToken(fixtures[0].address);
    }
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const lf = localStorage.getItem(LS + "launchFactory");
      const lt = localStorage.getItem(LS + "launchedTopic");
      const gt = localStorage.getItem(LS + "graduatedTopic");
      const ft = localStorage.getItem(LS + "followToken");
      if (lf) setLaunchFactory(lf);
      if (lt) setLaunchedTopic(lt);
      if (gt != null) setGraduatedTopic(gt);
      if (ft) setFollowToken(ft);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(
        LS + "launchFactory",
        fields.current.launchFactory.trim() || DEFAULT_LAUNCH_FACTORY
      );
      localStorage.setItem(
        LS + "launchedTopic",
        fields.current.launchedTopic.trim() || DEFAULT_LAUNCHED_TOPIC0
      );
      localStorage.setItem(LS + "graduatedTopic", fields.current.graduatedTopic.trim());
      localStorage.setItem(LS + "followToken", fields.current.followToken.trim());
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
      const foundingTag = card.founding ? "FOUNDING" : "STD";
      pushEvent({
        kind: L(locale, kindEn, kindZh),
        tags: ["NEW", "RH", "BUCKET", "LAUNCHED", `pad:${card.pad}`, foundingTag, ...extraTags],
        title: shortAddr(card.token),
        body: `pad:${card.pad} · token ${shortAddr(card.token)} · creator ${shortAddr(card.creator)} · curve ${shortAddr(card.curve)} · tierId ${card.tierId || "—"} · id ${card.id || "—"} · founding ${card.founding ? "yes" : "no"} · launchTx ${shortAddr(card.launchTx)} · #${card.blockNumber}`,
        address: card.token || undefined,
        block: card.blockNumber,
        tx: card.launchTx || undefined,
        chain: "RH",
        metric: card.founding ? "FOUNDING" : card.id || shortAddr(card.curve),
        metricLabel: card.founding ? "founding" : "id",
        metric2: `#${card.blockNumber}`,
        metric2Label: L(locale, "Block", "区块"),
        at: card.ts,
      });
    },
    [locale, pushEvent]
  );

  const emitGraduated = useCallback(
    (
      grad: ReturnType<typeof decodeGraduated>,
      tx: string,
      bn: number,
      highlight: boolean
    ) => {
      pushEvent({
        kind: L(locale, "Graduated", "Graduated 毕业"),
        tags: [
          "NEW",
          "RH",
          "BUCKET",
          "GRADUATED",
          "pad:bucket",
          highlight ? "FOLLOW" : "SECONDARY",
          ...(highlight ? ["HIGHLIGHT"] : []),
        ],
        title: shortAddr(grad.token),
        body: `pad:bucket · Graduated · token ${shortAddr(grad.token)} · poolId ${shortAddr(grad.poolId)} · lock ${shortAddr(grad.lock)} · splitter ${shortAddr(grad.splitter)} · quoteSeeded ${grad.quoteSeeded || "—"} · tokensSeeded ${grad.tokensSeeded || "—"} · tokensRetired ${grad.tokensRetired || "—"} · tx ${shortAddr(tx)} · #${bn}`,
        address: grad.token || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "RH",
        metric: shortAddr(grad.poolId) || shortAddr(grad.lock),
        metricLabel: "poolId",
        metric2: highlight ? "FOLLOW" : `#${bn}`,
        metric2Label: highlight ? "follow" : L(locale, "Block", "区块"),
        at: Date.now(),
      });
    },
    [locale, pushEvent]
  );

  const onLaunched = useCallback(
    (r: Record<string, unknown>) => {
      const decoded = decodeLaunched(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!decoded.token || !isAddr(decoded.token)) return;
      const dedupeKey = `${decoded.token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      emitLaunch(
        {
          pad: "bucket",
          token: decoded.token.toLowerCase(),
          creator: (decoded.creator || "").toLowerCase(),
          curve: (decoded.curve || "").toLowerCase(),
          tierId: decoded.tierId,
          id: decoded.id,
          founding: decoded.founding,
          launchTx: tx,
          blockNumber: bn,
          ts: Date.now(),
        },
        "Bucket Launched",
        "Bucket Launched",
        ["SNIPER", "RADAR"]
      );
      setFollowToken(decoded.token.toLowerCase());
    },
    [emitLaunch]
  );

  const onGraduatedLog = useCallback(
    (r: Record<string, unknown>) => {
      const grad = decodeGraduated(r);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const dedupeKey = `grad:${grad.token}:${tx}:${r.logIndex}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      const follow = fields.current.followToken.trim().toLowerCase();
      const highlight = !!follow && follow === (grad.token || "").toLowerCase();
      emitGraduated(grad, tx, bn, highlight);
    },
    [emitGraduated]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      const launchT = (fields.current.launchedTopic.trim() || DEFAULT_LAUNCHED_TOPIC0).toLowerCase();
      const gradT = fields.current.graduatedTopic.trim().toLowerCase();
      if (t0 === launchT) return onLaunched(r);
      if (gradT && t0 === gradT) return onGraduatedLog(r);
    },
    [onLaunched, onGraduatedLog]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const factory = (fields.current.launchFactory.trim() || DEFAULT_LAUNCH_FACTORY).toLowerCase();
    if (!isAddr(factory)) {
      setStatus("error");
      return;
    }
    const lt = (fields.current.launchedTopic.trim() || DEFAULT_LAUNCHED_TOPIC0).toLowerCase();
    send("eth_subscribe", ["logs", { address: factory, topics: [lt] }]);
    const gt = fields.current.graduatedTopic.trim().toLowerCase();
    if (isTopic0(gt)) {
      const follow = fields.current.followToken.trim().toLowerCase();
      const tokenTopic = isAddr(follow) ? addrToTopic(follow) : "";
      if (tokenTopic) {
        send("eth_subscribe", ["logs", { address: factory, topics: [gt, tokenTopic] }]);
      } else {
        send("eth_subscribe", ["logs", { address: factory, topics: [gt] }]);
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
    const factory = (fields.current.launchFactory.trim() || DEFAULT_LAUNCH_FACTORY).toLowerCase();
    if (!isAddr(factory)) {
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

  const onSelectCard = useCallback(
    (id: string) => {
      setSelectedId(id);
      const pool = events.length ? events : history.events.length ? history.events : seedEvents;
      const ev = pool.find((e) => e.id === id);
      if (ev?.address && isAddr(ev.address)) {
        const tok = ev.address.toLowerCase();
        setFollowToken(tok);
        fields.current.followToken = tok;
        saveFields();
        reconnectIfRunning();
      }
    },
    [events, history.events, seedEvents, reconnectIfRunning]
  );

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
    { label: "LAUNCH_FACTORY", value: launchFactory || DEFAULT_LAUNCH_FACTORY, mono: true },
    {
      label: "LAUNCHED_TOPIC0",
      value: launchedTopic || DEFAULT_LAUNCHED_TOPIC0,
      mono: true,
    },
    {
      label: "FOLLOW_TOKEN",
      value: followToken.trim()
        ? shortAddr(followToken)
        : L(locale, "click card → Graduated", "点卡片跟 Graduated"),
      mono: true,
    },
    {
      label: "GRADUATED_TOPIC0",
      value: graduatedTopic.trim() ? shortAddr(graduatedTopic) : "—",
      mono: true,
    },
  ];
  const sourceItems = [
    { k: L(locale, "SRC", "源"), v: "bucket.markets / factory Launched" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "launchpad-listen" },
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
              {L(locale, "Launchpad · Launched / Graduated", "发射盘 · Launched / Graduated")}
            </CardTitle>
            <CardDescription>{t(locale, "bucket.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bk-factory">LAUNCH_FACTORY</Label>
              <Input
                id="bk-factory"
                value={launchFactory}
                onChange={(e) => setLaunchFactory(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-lt">LAUNCHED_TOPIC0</Label>
              <Input
                id="bk-lt"
                value={launchedTopic}
                onChange={(e) => setLaunchedTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-follow">
                FOLLOW_TOKEN {L(locale, "(click card → Graduated)", "（点卡片跟 Graduated）")}
              </Label>
              <Input
                id="bk-follow"
                value={followToken}
                onChange={(e) => setFollowToken(e.target.value)}
                onBlur={() => {
                  saveFields();
                  reconnectIfRunning();
                }}
                spellCheck={false}
                placeholder={SAMPLE_BHC}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-gt">GRADUATED_TOPIC0</Label>
              <Input
                id="bk-gt"
                value={graduatedTopic}
                onChange={(e) => setGraduatedTopic(e.target.value)}
                onBlur={() => {
                  saveFields();
                  reconnectIfRunning();
                }}
                spellCheck={false}
                placeholder={L(locale, "editable · empty = skip Graduated", "可编辑 · 空则不跟 Graduated")}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hintChip("REGISTRY", HINT_REGISTRY)}
              {hintChip("SEEDER", HINT_SEEDER)}
              {hintChip("DISTRIBUTOR", HINT_DISTRIBUTOR)}
              {hintChip("PROTOCOL", HINT_PROTOCOL)}
              {hintChip("USDG", HINT_USDG)}
              {hintChip("BUCKET", HINT_BUCKET)}
              {hintChip("BHC", SAMPLE_BHC)}
              {hintChip("INFINITY", SAMPLE_INFINITY)}
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {L(locale, "Hint chips read-only / paste · click to copy. launch.bucketmarkets.com", "提示芯片只读/可粘贴 · 点复制。launch.bucketmarkets.com")}
            </p>
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
        onLocaleChange={onLocaleChange}
        title={t(locale, "bucket.title")}
        tag={t(locale, "bucket.tag")}
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
        guide={t(locale, "bucket.guide")}
        watching={t(locale, "bucket.watching")}
        hint={t(locale, "bucket.hint")}
        emptyTitle={t(locale, "bucket.emptyTitle")}
        emptySub={t(locale, "bucket.emptySub")}
        latestLabel={t(locale, "bucket.latest")}
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
