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
import { buildPumpCustomPairFixtures, useDemoHits } from "../lib/demo-hits";
import type { HistoryState } from "../lib/recent-history";
import { getDemo } from "../catalog";
import { resolveLiveUpdateAt, useTipHeartbeat } from "../lib/live-pulse";

/** Pump.fun program — editable; official table may update. */
const DEFAULT_PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const CREATE_LOG = /Instruction:\s*(Create(V2)?|CustomPair)/i;
const GRAD_LOG = /Instruction:\s*(Migrate|Graduate|Graduation)/i;

/** Sample quote seeds: majors + xStocks/Sunrise-style placeholders (replace with live mints). */
const DEFAULT_WHITELIST = `So11111111111111111111111111111111111111112 WSOL
EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v USDC
XstkNVDAsampleMint111111111111111111111111 NVDA.x
XstkTSLAsampleMint111111111111111111111111 TSLA.x
SunrisesampleMint1111111111111111111111111 Sunrise`;

const LS = "blockreq.pumpfun-custom-pairs.";
const SLUG = "pumpfun-custom-pairs-listen";

type Mode = "sample" | "live";

type WhitelistEntry = { mint: string; tag: string };

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

function parseWhitelist(text: string): WhitelistEntry[] {
  const out: WhitelistEntry[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    let mint = "";
    let tag = "";
    if (parts.length >= 2 && parts[0].length > 20 && parts[1].length <= 24) {
      mint = parts[0];
      tag = parts[1];
    } else if (parts.length >= 2 && parts[1].length > 20) {
      tag = parts[0];
      mint = parts[1];
    } else if (parts[0].length > 20) {
      mint = parts[0];
      tag = parts[0].slice(0, 4) + "…";
    } else continue;
    if (seen.has(mint)) continue;
    seen.add(mint);
    out.push({ mint, tag });
  }
  return out;
}

function shortSol(a?: string) {
  if (!a || a.length < 10) return a || "?";
  return a.slice(0, 4) + "…" + a.slice(-4);
}

type TxJson = {
  slot?: number;
  transaction?: {
    message?: {
      accountKeys?: Array<string | { pubkey?: string }>;
      instructions?: unknown[];
    };
  };
  meta?: {
    preTokenBalances?: Array<{ mint?: string }>;
    postTokenBalances?: Array<{ mint?: string }>;
    innerInstructions?: Array<{ instructions?: unknown[] }>;
    logMessages?: string[];
  };
};

async function getTransaction(https: string, signature: string): Promise<TxJson | null> {
  const res = await fetch(https, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: TxJson };
  return json.result || null;
}

function collectMints(tx: TxJson): string[] {
  const mints = new Set<string>();
  for (const bal of [...(tx.meta?.preTokenBalances || []), ...(tx.meta?.postTokenBalances || [])]) {
    if (bal.mint) mints.add(bal.mint);
  }
  const keys = tx.transaction?.message?.accountKeys || [];
  for (const k of keys) {
    const pk = typeof k === "string" ? k : k.pubkey || "";
    if (pk.length >= 32) mints.add(pk);
  }
  return [...mints];
}

function matchQuote(
  mints: string[],
  whitelist: WhitelistEntry[]
): { quoteMint: string; quoteTag: string; baseMint: string } | null {
  const map = new Map(whitelist.map((w) => [w.mint, w.tag]));
  let quoteMint = "";
  let quoteTag = "";
  for (const m of mints) {
    const tag = map.get(m);
    if (tag) {
      quoteMint = m;
      quoteTag = tag;
      break;
    }
  }
  if (!quoteMint) return null;
  const baseMint = mints.find((m) => m !== quoteMint) || "";
  if (!baseMint) return null;
  return { quoteMint, quoteTag, baseMint };
}

const IDLE_HISTORY: HistoryState = {
  status: "empty",
  events: [],
  reason: "Solana history uses getSignaturesForAddress when HTTPS is set (live mode).",
};

/**
 * Pump Custom Pair open tool — light WSS logsSubscribe + HTTPS getTransaction.
 * SOLANA_HTTPS/WSS empty placeholders only (BlockReq Solana public offline).
 * Layout: launch-feed (continuous Create/CustomPair stream + sticky hit).
 * Packaging: native WebSocket + fetch — no @solana/web3.js dependency.
 */
export function PumpfunCustomPairsDemo({ locale }: { locale: Locale }) {
  const [program, setProgram] = useState(DEFAULT_PUMP_PROGRAM);
  const [whitelistText, setWhitelistText] = useState(DEFAULT_WHITELIST);
  const [mode, setMode] = useState<Mode>("sample");
  const [wantGrad, setWantGrad] = useState(true);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasHit, setHasHit] = useState(false);
  const [listeningSince, setListeningSince] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });
  const ep = useEditableEndpoints(SLUG, "solana");
  const epRef = useRef(ep);
  epRef.current = ep;

  const seedEvents = useMemo(() => buildPumpCustomPairFixtures(locale, 6), [locale]);
  const history = IDLE_HISTORY;

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const fields = useRef({ program, whitelistText, wantGrad, mode });
  fields.current = { program, whitelistText, wantGrad, mode };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildPumpCustomPairFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const prog = localStorage.getItem(LS + "program");
      const wl = localStorage.getItem(LS + "whitelist");
      const md = localStorage.getItem(LS + "mode");
      if (prog) setProgram(prog);
      if (wl) setWhitelistText(wl);
      if (md === "live" || md === "sample") setMode(md);
    } catch {
      /* ignore */
    }
  }, []);

  // Sample mode: ensure seed rows are visible as live events so the page is usable.
  useEffect(() => {
    if (mode !== "sample") return;
    if (events.length > 0) return;
    const fixtures = buildPumpCustomPairFixtures(locale, 5);
    setEvents(fixtures);
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
    setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, locale]);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "program", fields.current.program.trim());
      localStorage.setItem(LS + "whitelist", fields.current.whitelistText);
      localStorage.setItem(LS + "mode", fields.current.mode);
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

  const handleLogs = useCallback(
    async (value: { signature?: string; err?: unknown; logs?: string[] }, slot?: number) => {
      if (!value || value.err || !value.signature) return;
      const signature = value.signature;
      if (seen.current.has(signature)) return;
      const logs = value.logs || [];
      const isCreate = logs.some((line) => CREATE_LOG.test(line));
      const isGrad = logs.some((line) => GRAD_LOG.test(line));
      if (!isCreate && !(isGrad && fields.current.wantGrad)) return;
      seen.current.add(signature);
      if (seen.current.size > 500) {
        const drop = [...seen.current].slice(0, 100);
        for (const k of drop) seen.current.delete(k);
      }

      const https = epRef.current.https.trim();
      const whitelist = parseWhitelist(fields.current.whitelistText);

      if (isGrad && fields.current.wantGrad) {
        pushEvent({
          kind: locale === "zh" ? "PumpSwap 毕业" : "PumpSwap graduated",
          tags: ["GRAD", "PUMPSWAP", "SOL"],
          title: shortSol(signature),
          body: `pad pump-custom-pair · graduated · sig ${shortSol(signature)} · slot ${slot || "?"}`,
          address: signature,
          block: slot,
          tx: signature,
          chain: "SOL",
          metric: "GRAD",
          metricLabel: locale === "zh" ? "毕业" : "graduated",
          metric2: String(slot || ""),
          metric2Label: "slot",
        });
      }

      if (!isCreate) return;
      if (!https) {
        // No HTTPS yet — still surface a raw Create hit so Live mode is visible.
        pushEvent({
          kind: "Create",
          tags: ["CREATE", "PUMP", "SOL"],
          title: shortSol(signature),
          body: `pad pump-custom-pair · Create log · need SOLANA_HTTPS for mint decode · slot ${slot || "?"}`,
          address: signature,
          block: slot,
          tx: signature,
          chain: "SOL",
        });
        return;
      }

      try {
        const tx = await getTransaction(https, signature);
        if (!tx) return;
        const mints = collectMints(tx);
        const hit = matchQuote(mints, whitelist);
        if (!hit) return;
        const kind = logs.some((l) => /CustomPair/i.test(l)) ? "CustomPair" : "Create";
        pushEvent({
          kind,
          tags: kind === "CustomPair" ? ["CUSTOM", "PUMP", "SOL", hit.quoteTag] : ["CREATE", "PUMP", "SOL", hit.quoteTag],
          title: shortSol(hit.baseMint),
          body: `pad pump-custom-pair · base ${shortSol(hit.baseMint)} · quote ${hit.quoteTag} ${shortSol(hit.quoteMint)} · slot ${tx.slot || slot || "?"}`,
          address: hit.baseMint,
          block: tx.slot || slot,
          tx: signature,
          chain: "SOL",
          metric: hit.quoteTag,
          metricLabel: "quoteTag",
          metric2: shortSol(hit.quoteMint),
          metric2Label: "quoteMint",
        });
      } catch {
        /* ignore decode errors */
      }
    },
    [locale, pushEvent]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const prog = fields.current.program.trim();
    if (!prog) return;
    send("logsSubscribe", [{ mentions: [prog] }, { commitment: "confirmed" }]);
    setStatus("listening");
  }, []);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    if (fields.current.mode !== "live") {
      setStatus("idle");
      wantRun.current = false;
      return;
    }
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
      void handleLogs(result.value, result.context?.slot);
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
  }, [handleLogs, subscribeAll]);

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
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      setStatus("idle");
      const fixtures = buildPumpCustomPairFixtures(locale, 5);
      setEvents(fixtures);
      if (fixtures[0]) setSelectedId(fixtures[0].id);
      setHasHit(true);
      return;
    }
    // live
    if (epRef.current.wss.trim()) {
      wantRun.current = true;
      connect();
    } else {
      setStatus("idle");
    }
  };

  useEffect(() => {
    // Live-on-default only when mode=live and WSS filled.
    if (mode === "live" && ep.wss.trim()) resume();
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
  const whitelist = useMemo(() => parseWhitelist(whitelistText), [whitelistText]);
  const watchParams = [
    { label: t(locale, "pump.programLabel"), value: shortSol(program.trim()) || "—", mono: true },
    { label: t(locale, "pump.whitelistLabel"), value: `${whitelist.length} mints` },
    { label: locale === "zh" ? "模式" : "Mode", value: mode === "sample" ? "Sample" : "Live" },
    { label: "PumpSwap", value: wantGrad ? "on" : "off" },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "pump.custom-pair" },
    { k: "CHAIN", v: ep.label },
    { k: "METHOD", v: "logsSubscribe+getTransaction" },
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
  // Solana tip heartbeat via eth_blockNumber is N/A — keep disabled when empty.
  const { tipAt } = useTipHeartbeat({ https: "", enabled: false });

  const settings = (
    <div className="space-y-3">
      <div className="border border-[rgba(255,209,102,0.35)] bg-[rgba(255,209,102,0.08)] px-3 py-2 text-xs text-[var(--color-warn)]">
        {t(locale, "pump.endpointHint")}
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
          {t(locale, "pump.modeSample")}
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
          {t(locale, "pump.modeLive")}
        </button>
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
            <CardTitle>{t(locale, "pump.whitelistLabel")}</CardTitle>
            <CardDescription>{t(locale, "pump.whitelistHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pump-program">{t(locale, "pump.programLabel")}</Label>
              <Input
                id="pump-program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pump-wl">{t(locale, "pump.whitelistLabel")}</Label>
              <textarea
                id="pump-wl"
                className="min-h-[110px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                value={whitelistText}
                onChange={(e) => setWhitelistText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <input
                type="checkbox"
                checked={wantGrad}
                onChange={(e) => setWantGrad(e.target.checked)}
                className="h-4 w-4"
              />
              {t(locale, "pump.gradToggle")}
            </label>
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
        title={t(locale, "pump.title")}
        tag={t(locale, "pump.tag")}
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
        guide={t(locale, "pump.guide")}
        watching={t(locale, "pump.watching")}
        hint={t(locale, "pump.hint")}
        emptyTitle={t(locale, "pump.emptyTitle")}
        emptySub={t(locale, "pump.emptySub")}
        latestLabel={t(locale, "pump.latest")}
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
              if (fields.current.mode === "live" && nextWss) {
                wantRun.current = true;
                try {
                  wsRef.current?.close();
                } catch {
                  /* ignore */
                }
                connect();
              } else if (!nextWss) {
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

