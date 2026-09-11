import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { t, demoBlogUrl, demoSiteUrl, type Locale } from "@blockreq/i18n";
import {
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
import { buildChangelogFilterFixtures, useDemoHits } from "../lib/demo-hits";
import type { HistoryState } from "../lib/recent-history";
import { getDemo } from "../catalog";
import { resolveLiveUpdateAt, useTipHeartbeat } from "../lib/live-pulse";

/** Editable program-id list (one per line) — BPF loader + common sys programs as seeds. */
const DEFAULT_PROGRAM_MENTIONS = `BPFLoaderUpgradeab1e11111111111111111111111 BPF-UPG
Config1111111111111111111111111111111111111 CONFIG
Vote111111111111111111111111111111111111111 VOTE`;

const DEFAULT_FILTER_KEYS = `upgrade
setAuthority
deploy
extendProgram
close`;

const DEFAULT_UPGRADE_TAGS = `v2.1-window
v2.2-window
agave-v3
hotfix`;

const LS = "blockreq.solana-changelog-filter.";
const SLUG = "solana-changelog-subscription-filter";

type Mode = "sample" | "live";

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

function parseLines(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function shortSol(a?: string) {
  if (!a || a.length < 10) return a || "?";
  return a.slice(0, 4) + "…" + a.slice(-4);
}

type TxJson = {
  slot?: number;
  meta?: { logMessages?: string[] };
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

function matchFilterKey(logs: string[], keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (logs.some((line) => re.test(line))) return key;
  }
  return null;
}

function matchUpgradeTag(logs: string[], tags: string[]): string | null {
  for (const tag of tags) {
    const re = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (logs.some((line) => re.test(line))) return tag;
  }
  // Heuristic: upgrade-ish logs without explicit tag still get a window chip.
  if (logs.some((l) => /upgrade|bpf_loader_upgradeable|setauthority|deploy/i.test(l))) {
    return tags[0] || "upgrade-window";
  }
  return null;
}

const IDLE_HISTORY: HistoryState = {
  status: "empty",
  events: [],
  reason: "Solana history uses getSignaturesForAddress when HTTPS is set (live mode).",
};

/**
 * Solana Changelog subscription filter — light WSS logsSubscribe + HTTPS getTransaction.
 * SOLANA_HTTPS/WSS empty placeholders only (BlockReq Solana public offline).
 * Layout: launch-feed (continuous filtered log stream + sticky hit + upgrade-window chips).
 * Packaging: native WebSocket + fetch — no @solana/web3.js dependency.
 */
export function SolanaChangelogSubscriptionFilterDemo({ locale }: { locale: Locale }) {
  const [mentionsText, setMentionsText] = useState(DEFAULT_PROGRAM_MENTIONS);
  const [filterKeysText, setFilterKeysText] = useState(DEFAULT_FILTER_KEYS);
  const [upgradeTagsText, setUpgradeTagsText] = useState(DEFAULT_UPGRADE_TAGS);
  const [mode, setMode] = useState<Mode>("sample");
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

  const seedEvents = useMemo(() => buildChangelogFilterFixtures(locale, 6), [locale]);
  const history = IDLE_HISTORY;

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const fields = useRef({ mentionsText, filterKeysText, upgradeTagsText, mode });
  fields.current = { mentionsText, filterKeysText, upgradeTagsText, mode };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at"> & { id?: string; at?: number }) => {
    const id = ev.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: ev.at || Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setSelectedId(id);
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildChangelogFilterFixtures(locale, 3);
    for (const ev of fixtures) setEvents((prev) => [ev, ...prev].slice(0, 80));
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const m = localStorage.getItem(LS + "mentions");
      const fk = localStorage.getItem(LS + "filterKeys");
      const ut = localStorage.getItem(LS + "upgradeTags");
      const md = localStorage.getItem(LS + "mode");
      if (m) setMentionsText(m);
      if (fk) setFilterKeysText(fk);
      if (ut) setUpgradeTagsText(ut);
      if (md === "live" || md === "sample") setMode(md);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (mode !== "sample") return;
    if (events.length > 0) return;
    const fixtures = buildChangelogFilterFixtures(locale, 5);
    setEvents(fixtures);
    if (fixtures[0]) setSelectedId(fixtures[0].id);
    setHasHit(true);
    setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, locale]);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "mentions", fields.current.mentionsText);
      localStorage.setItem(LS + "filterKeys", fields.current.filterKeysText);
      localStorage.setItem(LS + "upgradeTags", fields.current.upgradeTagsText);
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
      const programs = parsePrograms(fields.current.mentionsText);
      const filterKeys = parseLines(fields.current.filterKeysText);
      const upgradeTags = parseLines(fields.current.upgradeTagsText);
      const filterKey = matchFilterKey(logs, filterKeys);
      if (!filterKey && filterKeys.length > 0) return;
      seen.current.add(signature);
      if (seen.current.size > 500) {
        const drop = [...seen.current].slice(0, 100);
        for (const k of drop) seen.current.delete(k);
      }

      const https = epRef.current.https.trim();
      const upgradeTag = matchUpgradeTag(logs, upgradeTags) || upgradeTags[0] || "—";
      // Best-effort: first mentioned program that appears in logs, else first configured.
      const programHit =
        programs.find((p) => logs.some((l) => l.includes(p.id))) || programs[0] || { id: "?", tag: "?" };

      const emit = (resolvedSlot?: number) => {
        const isAlert = /upgrade|deploy|setauthority|bpf/i.test(filterKey || "") || !!matchUpgradeTag(logs, upgradeTags);
        pushEvent({
          kind: isAlert
            ? locale === "zh"
              ? "升级窗告警"
              : "Upgrade-window alert"
            : locale === "zh"
              ? "Filter 命中"
              : "Filter hit",
          tags: isAlert
            ? ["UPGRADE", "ALERT", "SOL", upgradeTag]
            : ["FILTER", "CHANGELOG", "SOL", filterKey || "any"],
          title: shortSol(programHit.id),
          body: `pad changelog-filter · program ${programHit.tag} ${shortSol(programHit.id)} · filterKey ${filterKey || "any"} · upgradeTag ${upgradeTag} · sig ${shortSol(signature)} · slot ${resolvedSlot || slot || "?"}`,
          address: programHit.id,
          block: resolvedSlot || slot,
          tx: signature,
          chain: "SOL",
          metric: filterKey || "any",
          metricLabel: "filterKey",
          metric2: upgradeTag,
          metric2Label: "upgradeTag",
        });
      };

      if (!https) {
        emit(slot);
        return;
      }
      try {
        const tx = await getTransaction(https, signature);
        emit(tx?.slot || slot);
      } catch {
        emit(slot);
      }
    },
    [locale, pushEvent]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const programs = parsePrograms(fields.current.mentionsText);
    if (programs.length === 0) return;
    // Multi-program: one logsSubscribe per mention (Solana mentions takes a single pubkey).
    for (const p of programs) {
      send("logsSubscribe", [{ mentions: [p.id] }, { commitment: "confirmed" }]);
    }
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
      const fixtures = buildChangelogFilterFixtures(locale, 5);
      setEvents(fixtures);
      if (fixtures[0]) setSelectedId(fixtures[0].id);
      setHasHit(true);
      return;
    }
    if (epRef.current.wss.trim()) {
      wantRun.current = true;
      connect();
    } else {
      setStatus("idle");
    }
  };

  useEffect(() => {
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
  const programs = useMemo(() => parsePrograms(mentionsText), [mentionsText]);
  const filterKeys = useMemo(() => parseLines(filterKeysText), [filterKeysText]);
  const upgradeTags = useMemo(() => parseLines(upgradeTagsText), [upgradeTagsText]);
  const watchParams = [
    { label: t(locale, "changelog.mentionsLabel"), value: `${programs.length} programs` },
    { label: t(locale, "changelog.filterKeysLabel"), value: `${filterKeys.length} keys` },
    { label: t(locale, "changelog.upgradeTagsLabel"), value: `${upgradeTags.length} tags` },
    { label: locale === "zh" ? "模式" : "Mode", value: mode === "sample" ? "Sample" : "Live" },
  ];
  const sourceItems = [
    { k: locale === "zh" ? "源" : "SRC", v: "sol.changelog-filter" },
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
  const { tipAt } = useTipHeartbeat({ https: "", enabled: false });

  const settings = (
    <div className="space-y-3">
      <div className="border border-[rgba(255,209,102,0.35)] bg-[rgba(255,209,102,0.08)] px-3 py-2 text-xs text-[var(--color-warn)]">
        {t(locale, "changelog.endpointHint")}
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
          {t(locale, "changelog.modeSample")}
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
          {t(locale, "changelog.modeLive")}
        </button>
      </div>
      {upgradeTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {upgradeTags.map((tag) => (
            <span
              key={tag}
              className="border border-[rgba(255,209,102,0.45)] bg-[rgba(255,209,102,0.1)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-warn)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
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
            <CardTitle>{t(locale, "changelog.mentionsLabel")}</CardTitle>
            <CardDescription>{t(locale, "changelog.mentionsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="chg-mentions">{t(locale, "changelog.mentionsLabel")}</Label>
              <textarea
                id="chg-mentions"
                className="min-h-[90px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                value={mentionsText}
                onChange={(e) => setMentionsText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chg-filters">{t(locale, "changelog.filterKeysLabel")}</Label>
              <textarea
                id="chg-filters"
                className="min-h-[90px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                value={filterKeysText}
                onChange={(e) => setFilterKeysText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
              <p className="text-[11px] text-[var(--color-muted-foreground)]">{t(locale, "changelog.filterKeysHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chg-upgrade">{t(locale, "changelog.upgradeTagsLabel")}</Label>
              <textarea
                id="chg-upgrade"
                className="min-h-[70px] w-full rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]"
                value={upgradeTagsText}
                onChange={(e) => setUpgradeTagsText(e.target.value)}
                onBlur={saveFields}
                spellCheck={false}
              />
              <p className="text-[11px] text-[var(--color-muted-foreground)]">{t(locale, "changelog.upgradeTagsHint")}</p>
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
        title={t(locale, "changelog.title")}
        tag={t(locale, "changelog.tag")}
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
        guide={t(locale, "changelog.guide")}
        watching={t(locale, "changelog.watching")}
        hint={t(locale, "changelog.hint")}
        emptyTitle={t(locale, "changelog.emptyTitle")}
        emptySub={t(locale, "changelog.emptySub")}
        latestLabel={t(locale, "changelog.latest")}
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
