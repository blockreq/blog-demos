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
import { MonitorChrome } from "../components/monitor-chrome";
import { AnonStreamLayout } from "../components/layouts/anon-stream-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { useEditableEndpoints } from "../lib/endpoints";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildAgaveCompatFixtures, useDemoHits } from "../lib/demo-hits";
import type { HistoryState } from "../lib/recent-history";
import { getDemo } from "../catalog";
import { resolveLiveUpdateAt, useTipHeartbeat } from "../lib/live-pulse";

const DEFAULT_WATCH_PROGRAMS = `BPFLoaderUpgradeab1e11111111111111111111111 BPF-UPG
Config1111111111111111111111111111111111111 CONFIG
Vote111111111111111111111111111111111111111 VOTE`;

const DEFAULT_RELEASE_TAG = "v2.1.21";
const DEFAULT_ANCHOR_SLOT = "312000000";

const LS = "blockreq.anza-agave-compat.";
const SLUG = "anza-agave-rpc-compat-watch";

type Mode = "sample" | "live";

type CompatChecks = {
  nodeCapability: boolean;
  tipAligned: boolean;
  subHealthy: boolean;
  programDiffReady: boolean;
};

type ProgramEntry = { id: string; tag: string };

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function parsePrograms(text: string): ProgramEntry[] {
  const out: ProgramEntry[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    let id = "";
    let tag = "";
    if (parts.length >= 2 && parts[0].length > 20) {
      id = parts[0];
      tag = parts[1];
    } else if (parts[0].length > 20) {
      id = parts[0];
      tag = parts[0].slice(0, 4) + "…";
    } else continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, tag });
  }
  return out;
}

function shortSol(a?: string) {
  if (!a || a.length < 10) return a || "?";
  return a.slice(0, 4) + "…" + a.slice(-4);
}

function fingerprintLogs(logs: string[]): string {
  const joined = logs.slice(0, 8).join("|").toLowerCase();
  let h = 0;
  for (let i = 0; i < joined.length; i++) h = (h * 31 + joined.charCodeAt(i)) | 0;
  return `fp${(h >>> 0).toString(16).slice(0, 8)}`;
}

async function rpcCall<T>(https: string, method: string, params: unknown[]): Promise<T | null> {
  const res = await fetch(https, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: T };
  return json.result ?? null;
}

const IDLE_HISTORY: HistoryState = {
  status: "empty",
  events: [],
  reason: "Agave tip/slot history uses getSlot when HTTPS is set (live mode).",
};

/**
 * Agave 6-week release RPC compat watch — HTTPS tip/slot probe + logsSubscribe.
 * SOLANA_HTTPS/WSS empty placeholders only (BlockReq Solana public offline).
 * Layout: launch-feed (tip/slot + pre/post diff stream + sticky compat card).
 * Packaging: native WebSocket + fetch — no @solana/web3.js dependency.
 */
export function AnzaAgaveRpcCompatWatchDemo({ locale }: { locale: Locale }) {
  const [programsText, setProgramsText] = useState(DEFAULT_WATCH_PROGRAMS);
  const [releaseTag, setReleaseTag] = useState(DEFAULT_RELEASE_TAG);
  const [anchorSlot, setAnchorSlot] = useState(DEFAULT_ANCHOR_SLOT);
  const [checks, setChecks] = useState<CompatChecks>({
    nodeCapability: true,
    tipAligned: true,
    subHealthy: true,
    programDiffReady: true,
  });
  const [mode, setMode] = useState<Mode>("sample");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [lastSubAt, setLastSubAt] = useState<number | null>(null);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "solana");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildAgaveCompatFixtures(locale, 6), [locale]);
  const history = IDLE_HISTORY;

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<number | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const preFp = useRef<Map<string, string>>(new Map());
  const fields = useRef({ programsText, releaseTag, anchorSlot, checks, mode });
  fields.current = { programsText, releaseTag, anchorSlot, checks, mode };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildAgaveCompatFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const p = localStorage.getItem(LS + "programs");
      const rt = localStorage.getItem(LS + "releaseTag");
      const as = localStorage.getItem(LS + "anchorSlot");
      const ck = localStorage.getItem(LS + "checks");
      const md = localStorage.getItem(LS + "mode");
      if (p) setProgramsText(p);
      if (rt) setReleaseTag(rt);
      if (as) setAnchorSlot(as);
      if (ck) {
        const parsed = JSON.parse(ck) as CompatChecks;
        if (parsed && typeof parsed === "object") setChecks(parsed);
      }
      if (md === "live" || md === "sample") setMode(md);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (mode !== "sample") return;
    if (events.length > 0) return;
    const fixtures = buildAgaveCompatFixtures(locale, 5);
    setEvents(fixtures);
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
    setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, locale]);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "programs", fields.current.programsText);
      localStorage.setItem(LS + "releaseTag", fields.current.releaseTag.trim());
      localStorage.setItem(LS + "anchorSlot", fields.current.anchorSlot.trim());
      localStorage.setItem(LS + "checks", JSON.stringify(fields.current.checks));
      localStorage.setItem(LS + "mode", fields.current.mode);
    } catch {
      /* ignore */
    }
  };

  const activeChecksLabel = (c: CompatChecks) => {
    const parts: string[] = [];
    if (c.nodeCapability) parts.push("nodeCapability");
    if (c.tipAligned) parts.push("tipAligned");
    if (c.subHealthy) parts.push("subHealthy");
    if (c.programDiffReady) parts.push("programDiffReady");
    return parts.join("·") || "none";
  };

  const send = (method: string, params: unknown[]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const id = nextId.current++;
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  };

  const probeTip = useCallback(async () => {
    const https = epRef.current.https.trim();
    if (!https) return;
    const c = fields.current.checks;
    try {
      const slot = await rpcCall<number>(https, "getSlot", [{ commitment: "confirmed" }]);
      const bh = await rpcCall<{ blockhash?: string; lastValidBlockHeight?: number }>(https, "getLatestBlockhash", [
        { commitment: "confirmed" },
      ]);
      if (slot == null) return;
      const anchor = Number(fields.current.anchorSlot.trim()) || 0;
      const delta = slot - anchor;
      const tipAligned = !anchor || Math.abs(delta) < 50_000_000;
      const checksNow: CompatChecks = {
        ...c,
        tipAligned: c.tipAligned ? tipAligned : false,
        nodeCapability: c.nodeCapability && !!bh?.blockhash,
      };
      const lagMs = lastSubAt ? Date.now() - lastSubAt : 0;
      const subLag = lastSubAt ? `${lagMs}ms` : "n/a";
      pushEvent({
        kind: locale === "zh" ? "tip/slot 探针" : "tip/slot probe",
        tags: ["PROBE", "AGAVE", "SOL", fields.current.releaseTag.trim() || "rel"],
        title: fields.current.releaseTag.trim() || "release",
        body: `pad agave-compat · releaseTag ${fields.current.releaseTag.trim()} · tipSlot ${slot} · programDiff tipΔ${delta >= 0 ? "+" : ""}${delta} · subLag ${subLag} · checks ${activeChecksLabel(checksNow)} · bh ${shortSol(bh?.blockhash)}`,
        address: bh?.blockhash,
        block: slot,
        chain: "SOL",
        metric: String(slot),
        metricLabel: "tipSlot",
        metric2: `Δ${delta >= 0 ? "+" : ""}${delta}`,
        metric2Label: "vs anchor",
      });
      setLastPulseAt(Date.now());
    } catch {
      /* ignore probe errors */
    }
  }, [lastSubAt, locale, pushEvent]);

  const handleLogs = useCallback(
    (value: { signature?: string; err?: unknown; logs?: string[] }, slot?: number) => {
      if (!value || value.err || !value.signature) return;
      const signature = value.signature;
      if (seen.current.has(signature)) return;
      seen.current.add(signature);
      if (seen.current.size > 500) {
        const drop = [...seen.current].slice(0, 100);
        for (const k of drop) seen.current.delete(k);
      }
      const logs = value.logs || [];
      const programs = parsePrograms(fields.current.programsText);
      const programHit =
        programs.find((p) => logs.some((l) => l.includes(p.id))) || programs[0] || { id: "?", tag: "?" };
      const fp = fingerprintLogs(logs);
      const prev = preFp.current.get(programHit.id);
      preFp.current.set(programHit.id, fp);
      const programDiff = !prev ? "fp-init" : prev === fp ? "fp-match" : "pre≠post";
      const now = Date.now();
      setLastSubAt(now);
      const lagMs = lastSubAt ? now - lastSubAt : 0;
      const subLag = lastSubAt ? `${lagMs}ms` : "0ms";
      const c = fields.current.checks;
      const checksNow: CompatChecks = {
        ...c,
        subHealthy: c.subHealthy,
        programDiffReady: c.programDiffReady && programDiff !== "fp-init",
      };
      pushEvent({
        kind:
          programDiff === "pre≠post"
            ? locale === "zh"
              ? "pre/post 差"
              : "pre/post diff"
            : locale === "zh"
              ? "sub 健康"
              : "sub healthy",
        tags:
          programDiff === "pre≠post"
            ? ["DIFF", "AGAVE", "SOL", fields.current.releaseTag.trim() || "rel"]
            : ["SUB", "AGAVE", "SOL", fields.current.releaseTag.trim() || "rel"],
        title: fields.current.releaseTag.trim() || shortSol(programHit.id),
        body: `pad agave-compat · releaseTag ${fields.current.releaseTag.trim()} · tipSlot ${slot || "?"} · programDiff ${programDiff} · subLag ${subLag} · checks ${activeChecksLabel(checksNow)} · program ${programHit.tag} · sig ${shortSol(signature)}`,
        address: programHit.id,
        block: slot,
        tx: signature,
        chain: "SOL",
        metric: String(slot || ""),
        metricLabel: "tipSlot",
        metric2: programDiff,
        metric2Label: "programDiff",
      });
    },
    [lastSubAt, locale, pushEvent]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const programs = parsePrograms(fields.current.programsText);
    if (programs.length === 0) return;
    for (const p of programs) {
      send("logsSubscribe", [{ mentions: [p.id] }, { commitment: "confirmed" }]);
    }
    setStatus("listening");
  }, []);

  const stopPoll = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPoll = useCallback(() => {
    stopPoll();
    if (!epRef.current.https.trim()) return;
    void probeTip();
    pollRef.current = window.setInterval(() => {
      void probeTip();
    }, 8000);
  }, [probeTip]);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    if (fields.current.mode !== "live") {
      setStatus("idle");
      wantRun.current = false;
      stopPoll();
      return;
    }
    const wss = epRef.current.wss.trim();
    const https = epRef.current.https.trim();
    if (!wss && !https) {
      setStatus("idle");
      wantRun.current = false;
      return;
    }
    if (https) startPoll();
    if (!wss) {
      setStatus("listening");
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
      if (msg.id && msg.result !== undefined && !msg.method) return;
      if (msg.id && msg.error) {
        setStatus("error");
        return;
      }
      if (msg.method !== "logsNotification") return;
      const params = msg.params as
        | { result?: { value?: { signature?: string; err?: unknown; logs?: string[] }; context?: { slot?: number } } }
        | undefined;
      const result = params?.result;
      if (!result?.value) return;
      setLastPulseAt(Date.now());
      handleLogs(result.value, result.context?.slot);
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
  }, [handleLogs, startPoll, subscribeAll]);

  const resume = useCallback(() => {
    if (fields.current.mode !== "live") {
      setMode("live");
      fields.current.mode = "live";
      saveFields();
    }
    wantRun.current = true;
    connect();
  }, [connect]);

  const pause = useCallback(() => {
    wantRun.current = false;
    stopPoll();
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    setStatus("stopped");
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    fields.current.mode = next;
    saveFields();
    if (next === "sample") {
      wantRun.current = false;
      stopPoll();
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("idle");
      const fixtures = buildAgaveCompatFixtures(locale, 5);
      setEvents(fixtures);
      if (fixtures[0]) setSelectedId(fixtures[0].id);
      setHasHit(true);
      return;
    }
    if (epRef.current.wss.trim() || epRef.current.https.trim()) {
      wantRun.current = true;
      connect();
    } else {
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (mode === "live" && (ep.wss.trim() || ep.https.trim())) resume();
    return () => {
      wantRun.current = false;
      stopPoll();
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = status === "connecting" || status === "listening";
  const programs = useMemo(() => parsePrograms(programsText), [programsText]);
  const watchParams = [
    { label: t(locale, "agave.releaseTagLabel"), value: releaseTag.trim() || "—" },
    { label: t(locale, "agave.anchorSlotLabel"), value: anchorSlot.trim() || "—" },
    { label: t(locale, "agave.programsLabel"), value: `${programs.length} programs` },
    { label: locale === "zh" ? "模式" : "Mode", value: mode === "sample" ? "Sample" : "Live" },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "anza.agave-compat" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "getSlot+getLatestBlockhash+logsSubscribe" },
    { k: "WSS", v: ep.wss || (locale === "zh" ? "（空 · 待就绪）" : "(empty · pending ready)") },
    { k: "HTTPS", v: ep.https || (locale === "zh" ? "（空 · 待就绪）" : "(empty · pending ready)") },
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
  const { tipAt } = useTipHeartbeat({ https: "", enabled: false });

  const toggleCheck = (key: keyof CompatChecks) => {
    setChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      fields.current.checks = next;
      return next;
    });
  };

  const settings = (
    <div className="space-y-3">
      <div className="border border-[rgba(255,209,102,0.35)] bg-[rgba(255,209,102,0.08)] px-3 py-2 text-xs text-[var(--color-warn)]">
        {t(locale, "agave.endpointHint")}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`border px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.08em] ${
            mode === "sample"
              ? "border-[rgba(255,209,102,0.55)] bg-[rgba(255,209,102,0.12)] text-[var(--color-warn)]"
              : "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted-foreground)]"
          }`}
          onClick={() => switchMode("sample")}
        >
          {t(locale, "agave.modeSample")}
        </button>
        <button
          type="button"
          className={`border px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.08em] ${
            mode === "live"
              ? "border-[rgba(0,240,255,0.55)] bg-[rgba(0,240,255,0.12)] text-[var(--color-neon-cyan)]"
              : "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted-foreground)]"
          }`}
          onClick={() => switchMode("live")}
        >
          {t(locale, "agave.modeLive")}
        </button>
      </div>
      <div className="border border-[rgba(0,240,255,0.25)] bg-[rgba(0,240,255,0.06)] px-3 py-2">
        <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-neon-cyan)]">
          COMPAT_CHECKS
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["nodeCapability", checks.nodeCapability],
              ["tipAligned", checks.tipAligned],
              ["subHealthy", checks.subHealthy],
              ["programDiffReady", checks.programDiffReady],
            ] as const
          ).map(([key, on]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                toggleCheck(key);
                saveFields();
              }}
              className={`border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] ${
                on
                  ? "border-[rgba(57,255,154,0.45)] bg-[rgba(57,255,154,0.1)] text-[var(--color-ok)]"
                  : "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted-foreground)]"
              }`}
            >
              {on ? "✓ " : "○ "}
              {key}
            </button>
          ))}
        </div>
      </div>
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
            <CardTitle>{t(locale, "agave.programsLabel")}</CardTitle>
            <CardDescription>{t(locale, "agave.programsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="agave-rel">{t(locale, "agave.releaseTagLabel")}</Label>
                <Input
                  id="agave-rel"
                  value={releaseTag}
                  onChange={(e) => setReleaseTag(e.target.value)}
                  onBlur={saveFields}
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agave-anchor">{t(locale, "agave.anchorSlotLabel")}</Label>
                <Input
                  id="agave-anchor"
                  value={anchorSlot}
                  onChange={(e) => setAnchorSlot(e.target.value)}
                  onBlur={saveFields}
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agave-progs">{t(locale, "agave.programsLabel")}</Label>
              <textarea
                id="agave-progs"
                className="min-h-[90px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                value={programsText}
                onChange={(e) => setProgramsText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
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
              {ep.wss || "SOLANA_WSS=''"} · {ep.https || "SOLANA_HTTPS=''"}
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
    running: runningLive || mode === "sample",
  });

  return (
    <div className="flex min-h-screen flex-col pb-24" data-layout="launch-feed">
      <MonitorChrome
        lastUpdateAt={lastUpdateAt}
        locale={locale}
        title={t(locale, "agave.title")}
        tag={t(locale, "agave.tag")}
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
        guide={t(locale, "agave.guide")}
        watching={t(locale, "agave.watching")}
        hint={t(locale, "agave.hint")}
        emptyTitle={t(locale, "agave.emptyTitle")}
        emptySub={t(locale, "agave.emptySub")}
        latestLabel={t(locale, "agave.latest")}
        chainBadge="Solana"
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
              if (fields.current.mode === "live" && (nextWss || nextHttps)) {
                wantRun.current = true;
                try {
                  wsRef.current?.close();
                } catch {
                  /* ignore */
                }
                connect();
              } else if (!nextWss && !nextHttps) {
                wantRun.current = false;
                stopPoll();
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
              stopPoll();
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
