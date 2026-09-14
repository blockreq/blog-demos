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
import { isAddr, shortAddr, unpadTopic, wordAddr, wordU256 } from "@blockreq/rpc";
import type { JsonRpcLog } from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { OpenWaitLayout } from "../components/layouts/open-wait-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildHarmonicRhcFixtures, useDemoHits } from "../lib/demo-hits";
import { useRecentHistory } from "../lib/recent-history";
import { useEditableEndpoints } from "../lib/endpoints";
import { getDemo } from "../catalog";
import {
  isNewHeadsResult,
  resolveLiveUpdateAt,
  useTipHeartbeat,
} from "../lib/live-pulse";

/** Verified Pons V2 factory (RH) */
const DEFAULT_PONS_V2 = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
/** Optional Pons V1 — not in default CSV; paste when wanted */
const OPTIONAL_PONS_V1 = "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB";
/** TokenLaunched topic0 */
const DEFAULT_LAUNCH_TOPIC0 =
  "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
/** Hookr launchpad (docs live) */
const DEFAULT_HOOKR = "0xa043caBE645636899dDe91Cce4693C00a015e660";
/** Empty — editable HOOKR_LAUNCH_TOPIC0 when known */
const DEFAULT_HOOKR_TOPIC0 = "";
/** Uniswap v4 PoolManager on RH */
const DEFAULT_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
/** Initialize topic0 */
const DEFAULT_INIT_TOPIC0 =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";
/** WETH on RH (verified reference; not subscribed by default) */
const RH_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

const DEFAULT_FACTORY_CSV = `# LAUNCH_FACTORY — Pons V2 default (CSV / one addr per line)
# Optional Pons V1: ${OPTIONAL_PONS_V1}
${DEFAULT_PONS_V2}`;

const LS = "blockreq.harmonic-rhc-agent.";
const SLUG = "harmonic-rhc-agent-launch-listen";

type LaunchCard = {
  pad: string;
  token: string;
  curve: string;
  deployer: string;
  pairToken: string;
  threshold: string;
  poolId?: string;
  launchTx: string;
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

function mapTokenLaunchLogs(logs: JsonRpcLog[], locale: Locale): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, 24).map((log, i) => {
    const topics = log.topics || [];
    const token = unpadTopic(topics[1]);
    const curve = unpadTopic(topics[2]);
    const deployer = unpadTopic(topics[3]);
    const pairToken = wordAddr(log.data, 0);
    const threshold = wordU256(log.data, 2);
    const bn = log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
    return {
      id: `hist-${log.transactionHash}-${log.logIndex}-${i}`,
      kind: L(locale, "Recent launch", "历史发射"),
      tags: ["HIST", "RH", "HARMONIC", "PONS", "pad:pons-v2"],
      title: shortAddr(token),
      body: `pad:pons-v2 · token ${shortAddr(token)} · curve ${shortAddr(curve)} · deployer ${shortAddr(deployer)} · pair ${shortAddr(pairToken)} · thr ${threshold.toString()} · #${bn}`,
      address: token || undefined,
      block: bn,
      tx: log.transactionHash,
      chain: "RH",
      at: now - i * 400,
      metric: shortAddr(curve),
      metricLabel: "curve",
      metric2: `#${bn}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

/**
 * HARMONIC RHC agent launch listen — Pons TokenLaunched primary + optional Hookr / V4 Initialize.
 * Layout: single-focus OpenWaitLayout (agent launch path).
 */
export function HarmonicRhcAgentLaunchDemo({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [factoryCsv, setFactoryCsv] = useState(DEFAULT_FACTORY_CSV);
  const [launchTopic, setLaunchTopic] = useState(DEFAULT_LAUNCH_TOPIC0);
  const [hookr, setHookr] = useState(DEFAULT_HOOKR);
  const [hookrTopic, setHookrTopic] = useState(DEFAULT_HOOKR_TOPIC0);
  const [poolManager, setPoolManager] = useState(DEFAULT_POOL_MANAGER);
  const [initTopic, setInitTopic] = useState(DEFAULT_INIT_TOPIC0);
  const [subHookr, setSubHookr] = useState(false);
  const [subInit, setSubInit] = useState(false);
  const [harmonicToken, setHarmonicToken] = useState("");
  const [agentVault, setAgentVault] = useState("");
  const [lpManager, setLpManager] = useState("");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "robinhood");
  const epRef = useRef(ep);
  epRef.current = ep;

  const primaryFactory = useMemo(() => {
    const list = parseAddrList(factoryCsv);
    return list[0] || DEFAULT_PONS_V2.toLowerCase();
  }, [factoryCsv]);

  const seedEvents = useMemo(() => buildHarmonicRhcFixtures(locale, 5), [locale]);
  const history = useRecentHistory({
    locale,
    https: ep.https,
    address: primaryFactory,
    topics: [launchTopic.trim() || DEFAULT_LAUNCH_TOPIC0],
    map: (logs) => mapTokenLaunchLogs(logs, locale),
    enabled: isAddr(primaryFactory) && !!ep.https,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const launchDedup = useRef(new Set<string>());
  const fields = useRef({
    factoryCsv,
    launchTopic,
    hookr,
    hookrTopic,
    poolManager,
    initTopic,
    subHookr,
    subInit,
    harmonicToken,
    agentVault,
    lpManager,
  });
  fields.current = {
    factoryCsv,
    launchTopic,
    hookr,
    hookrTopic,
    poolManager,
    initTopic,
    subHookr,
    subInit,
    harmonicToken,
    agentVault,
    lpManager,
  };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 40));
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildHarmonicRhcFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 40));
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LS + "factoryCsv");
      const lt = localStorage.getItem(LS + "launchTopic");
      const hk = localStorage.getItem(LS + "hookr");
      const ht = localStorage.getItem(LS + "hookrTopic");
      const pm = localStorage.getItem(LS + "poolManager");
      const it = localStorage.getItem(LS + "initTopic");
      const sh = localStorage.getItem(LS + "subHookr");
      const si = localStorage.getItem(LS + "subInit");
      const tok = localStorage.getItem(LS + "harmonicToken");
      const vault = localStorage.getItem(LS + "agentVault");
      const lp = localStorage.getItem(LS + "lpManager");
      if (f) setFactoryCsv(f);
      if (lt) setLaunchTopic(lt);
      if (hk) setHookr(hk);
      if (ht != null) setHookrTopic(ht);
      if (pm) setPoolManager(pm);
      if (it) setInitTopic(it);
      if (sh != null) setSubHookr(sh === "1");
      if (si != null) setSubInit(si === "1");
      if (tok) setHarmonicToken(tok);
      if (vault) setAgentVault(vault);
      if (lp) setLpManager(lp);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factoryCsv", fields.current.factoryCsv);
      localStorage.setItem(LS + "launchTopic", fields.current.launchTopic.trim() || DEFAULT_LAUNCH_TOPIC0);
      localStorage.setItem(LS + "hookr", fields.current.hookr.trim() || DEFAULT_HOOKR);
      localStorage.setItem(LS + "hookrTopic", fields.current.hookrTopic.trim());
      localStorage.setItem(LS + "poolManager", fields.current.poolManager.trim() || DEFAULT_POOL_MANAGER);
      localStorage.setItem(LS + "initTopic", fields.current.initTopic.trim() || DEFAULT_INIT_TOPIC0);
      localStorage.setItem(LS + "subHookr", fields.current.subHookr ? "1" : "0");
      localStorage.setItem(LS + "subInit", fields.current.subInit ? "1" : "0");
      localStorage.setItem(LS + "harmonicToken", fields.current.harmonicToken.trim());
      localStorage.setItem(LS + "agentVault", fields.current.agentVault.trim());
      localStorage.setItem(LS + "lpManager", fields.current.lpManager.trim());
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

  const emitLaunchCard = useCallback(
    (card: LaunchCard, kindZh: string, kindEn: string, extraTags: string[] = []) => {
      pushEvent({
        kind: L(locale, kindEn, kindZh),
        tags: ["NEW", "RH", "HARMONIC", "AGENT", `pad:${card.pad}`, ...extraTags],
        title: shortAddr(card.token || card.poolId || card.launchTx),
        body: `pad:${card.pad} · token ${shortAddr(card.token)} · curve ${shortAddr(card.curve)} · deployer ${shortAddr(card.deployer)} · pairToken ${shortAddr(card.pairToken)} · threshold ${card.threshold} · poolId ${card.poolId ? shortAddr(card.poolId) : "—"} · launchTx ${shortAddr(card.launchTx)} · #${card.blockNumber}`,
        address: card.token || card.poolId || undefined,
        block: card.blockNumber,
        tx: card.launchTx || undefined,
        chain: "RH",
        metric: shortAddr(card.curve || card.deployer),
        metricLabel: card.curve ? "curve" : "deployer",
        metric2: `#${card.blockNumber}`,
        metric2Label: L(locale, "Block", "区块"),
        at: card.ts,
      });
    },
    [locale, pushEvent]
  );

  const onTokenLaunched = useCallback(
    (r: Record<string, unknown>, pad: string) => {
      const topics = (r.topics as string[]) || [];
      const token = unpadTopic(topics[1]);
      const curve = unpadTopic(topics[2]);
      const deployer = unpadTopic(topics[3]);
      const pairToken = wordAddr(r.data as string, 0);
      const threshold = wordU256(r.data as string, 2);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      if (!token || !isAddr(token)) return;
      const dedupeKey = `${token.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      const harm = fields.current.harmonicToken.trim().toLowerCase();
      const matchHarm = harm && isAddr(harm) && harm === token.toLowerCase();
      emitLaunchCard(
        {
          pad,
          token: token.toLowerCase(),
          curve: (curve || "").toLowerCase(),
          deployer: (deployer || "").toLowerCase(),
          pairToken: (pairToken || "").toLowerCase(),
          threshold: threshold.toString(),
          launchTx: tx,
          blockNumber: bn,
          ts: Date.now(),
        },
        matchHarm ? "HARMONIC 命中发射" : "Pons 发射",
        matchHarm ? "HARMONIC launch hit" : "Pons launch",
        matchHarm ? ["HARMONIC", "HIT", "LAUNCH"] : ["PONS", "LAUNCH"]
      );
    },
    [emitLaunchCard]
  );

  const onHookrLaunch = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const token = unpadTopic(topics[1]) || unpadTopic(topics[2]) || "";
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const dedupeKey = `${(token || tx).toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      emitLaunchCard(
        {
          pad: "hookr",
          token: (token || "").toLowerCase(),
          curve: "",
          deployer: String(r.address || "").toLowerCase(),
          pairToken: "",
          threshold: "0",
          launchTx: tx,
          blockNumber: bn,
          ts: Date.now(),
        },
        "Hookr 发射",
        "Hookr launch",
        ["HOOKR", "LAUNCH"]
      );
    },
    [emitLaunchCard]
  );

  const onInitialize = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const poolId = topics[1] || "";
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const dedupeKey = `init:${poolId.toLowerCase()}:${tx.toLowerCase()}`;
      if (launchDedup.current.has(dedupeKey)) return;
      launchDedup.current.add(dedupeKey);
      emitLaunchCard(
        {
          pad: "v4-init",
          token: "",
          curve: "",
          deployer: "",
          pairToken: "",
          threshold: "0",
          poolId: poolId || undefined,
          launchTx: tx,
          blockNumber: bn,
          ts: Date.now(),
        },
        "V4 Initialize",
        "V4 Initialize",
        ["V4", "INIT"]
      );
    },
    [emitLaunchCard]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      const launchT = (fields.current.launchTopic.trim() || DEFAULT_LAUNCH_TOPIC0).toLowerCase();
      const hookrT = fields.current.hookrTopic.trim().toLowerCase();
      const initT = (fields.current.initTopic.trim() || DEFAULT_INIT_TOPIC0).toLowerCase();
      const addr = String(r.address || "").toLowerCase();
      const factories = parseAddrList(fields.current.factoryCsv);
      const ponsV2 = DEFAULT_PONS_V2.toLowerCase();
      const ponsV1 = OPTIONAL_PONS_V1.toLowerCase();
      if (t0 === launchT) {
        let pad = "pons";
        if (addr === ponsV2 || factories.includes(addr) && addr === ponsV2) pad = "pons-v2";
        else if (addr === ponsV1) pad = "pons-v1";
        else if (factories.includes(addr)) pad = "pons";
        return onTokenLaunched(r, pad);
      }
      if (hookrT && t0 === hookrT) return onHookrLaunch(r);
      if (t0 === initT) return onInitialize(r);
    },
    [onHookrLaunch, onInitialize, onTokenLaunched]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const factories = parseAddrList(fields.current.factoryCsv);
    const addrs = factories.length ? factories : [DEFAULT_PONS_V2.toLowerCase()];
    const valid = addrs.filter(isAddr);
    if (!valid.length) {
      setStatus("error");
      return;
    }
    const lt = (fields.current.launchTopic.trim() || DEFAULT_LAUNCH_TOPIC0).toLowerCase();
    send("eth_subscribe", ["logs", { address: valid.length === 1 ? valid[0] : valid, topics: [lt] }]);
    if (fields.current.subHookr) {
      const hk = (fields.current.hookr.trim() || DEFAULT_HOOKR).toLowerCase();
      const ht = fields.current.hookrTopic.trim().toLowerCase();
      if (isAddr(hk) && ht) {
        send("eth_subscribe", ["logs", { address: hk, topics: [ht] }]);
      }
    }
    if (fields.current.subInit) {
      const pm = (fields.current.poolManager.trim() || DEFAULT_POOL_MANAGER).toLowerCase();
      const it = (fields.current.initTopic.trim() || DEFAULT_INIT_TOPIC0).toLowerCase();
      if (isAddr(pm) && it) {
        send("eth_subscribe", ["logs", { address: pm, topics: [it] }]);
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
    const factories = parseAddrList(fields.current.factoryCsv);
    const addrs = factories.length ? factories : [DEFAULT_PONS_V2.toLowerCase()];
    if (!addrs.some(isAddr)) {
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
    { label: "LAUNCH_FACTORY", value: shortAddr(primaryFactory), mono: true },
    { label: "LAUNCH_TOPIC0", value: shortAddr(launchTopic || DEFAULT_LAUNCH_TOPIC0), mono: true },
    {
      label: "HOOKR",
      value: subHookr ? shortAddr(hookr || DEFAULT_HOOKR) : "off",
      mono: true,
    },
    {
      label: "INIT",
      value: subInit ? shortAddr(poolManager || DEFAULT_POOL_MANAGER) : "off",
      mono: true,
    },
    {
      label: "HARMONIC_TOKEN",
      value: harmonicToken.trim() || (L(locale, "(paste)", "（粘贴）")),
      mono: true,
    },
  ];
  const sourceItems = [
    { k: L(locale, "SRC", "源"), v: "harmonic.rhc / pons+hookr" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "agent-launch-listen" },
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
            <CardTitle>{L(locale, "Launch path · Pons / Hookr / V4", "发射路径 · Pons / Hookr / V4")}</CardTitle>
            <CardDescription>{t(locale, "harmonic.settingsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="harm-factory">LAUNCH_FACTORY</Label>
              <textarea
                id="harm-factory"
                value={factoryCsv}
                onChange={(e) => setFactoryCsv(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                rows={4}
                className="w-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 font-mono text-xs text-[var(--color-foreground)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harm-lt">LAUNCH_TOPIC0</Label>
              <Input
                id="harm-lt"
                value={launchTopic}
                onChange={(e) => setLaunchTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={subHookr}
                  onChange={(e) => setSubHookr(e.target.checked)}
                  className="h-4 w-4"
                />
                Hookr
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={subInit}
                  onChange={(e) => setSubInit(e.target.checked)}
                  className="h-4 w-4"
                />
                PoolManager Initialize
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harm-hookr">HOOKR_LAUNCHPAD</Label>
              <Input
                id="harm-hookr"
                value={hookr}
                onChange={(e) => setHookr(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harm-ht">HOOKR_LAUNCH_TOPIC0</Label>
              <Input
                id="harm-ht"
                value={hookrTopic}
                onChange={(e) => setHookrTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder={L(locale, "editable · empty = skip", "可编辑 · 空则不订")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harm-pm">POOL_MANAGER</Label>
              <Input
                id="harm-pm"
                value={poolManager}
                onChange={(e) => setPoolManager(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harm-it">INIT_TOPIC0</Label>
              <Input
                id="harm-it"
                value={initTopic}
                onChange={(e) => setInitTopic(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harm-tok">HARMONIC token {L(locale, "(paste)", "（粘贴）")}</Label>
              <Input
                id="harm-tok"
                value={harmonicToken}
                onChange={(e) => setHarmonicToken(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder="0x…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harm-vault">Agent vault {L(locale, "(paste)", "（粘贴）")}</Label>
              <Input
                id="harm-vault"
                value={agentVault}
                onChange={(e) => setAgentVault(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder="0x…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harm-lp">LP manager {L(locale, "(paste)", "（粘贴）")}</Label>
              <Input
                id="harm-lp"
                value={lpManager}
                onChange={(e) => setLpManager(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
                placeholder="0x…"
              />
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              WETH {shortAddr(RH_WETH)} · Pons V1 opt {shortAddr(OPTIONAL_PONS_V1)}
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
    <div className="flex min-h-screen flex-col pb-24" data-layout="single-focus">
      <MonitorChrome
        lastUpdateAt={lastUpdateAt}
        locale={locale}
        onLocaleChange={onLocaleChange}
        title={t(locale, "harmonic.title")}
        tag={t(locale, "harmonic.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
        blogUrl={demoBlogUrl(SLUG, locale)}
        siteUrl={demoSiteUrl(getDemo(SLUG))}
      />
      <OpenWaitLayout
        locale={locale}
        status={status}
        hasHit={hasHit}
        events={events}
        seedEvents={seedEvents}
        onPause={pause}
        onResume={resume}
        running={running}
        connecting={status === "connecting"}
        history={history}
        watchParams={watchParams}
        sourceItems={sourceItems}
        guide={t(locale, "harmonic.guide")}
        watching={t(locale, "harmonic.watching")}
        stripTitle={t(locale, "harmonic.stripTitle")}
        stripSub={t(locale, "harmonic.stripSub")}
        stageIdle={t(locale, "harmonic.stageIdle")}
        stageConn={t(locale, "harmonic.stageConn")}
        stageListen={t(locale, "harmonic.stageListen")}
        stageHit={t(locale, "harmonic.stageHit")}
        heroIdle={t(locale, "harmonic.hero.idle")}
        heroConnecting={t(locale, "harmonic.hero.connecting")}
        heroListening={t(locale, "harmonic.hero.listening")}
        heroHit={t(locale, "harmonic.hero.hit")}
        recentTitle={t(locale, "harmonic.recent")}
        chainBadge="RH"
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
