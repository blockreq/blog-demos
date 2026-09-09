import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import {
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ToggleGroup,
  ToggleGroupItem,
  type ConnStatus,
} from "@blockreq/ui";
import {
  PUBLIC_ENDPOINTS,
  isAddr,
  shortAddr,
  unpadTopic,
  wordAddr,
} from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { EquiSplitLayout } from "../components/layouts/equi-split-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildEquiFixtures, useDemoHits } from "../lib/demo-hits";
import { getDemo } from "../catalog";

const ENDPOINTS = {
  base: PUBLIC_ENDPOINTS.base,
  rh: PUBLIC_ENDPOINTS.robinhood,
} as const;

type EpKey = keyof typeof ENDPOINTS;

const DEFAULT_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const LS = "blockreq.equifold-mm.";
const SLUG = "equifold-multi-market-listen";

type MarketEntry = {
  market: string;
  quote: string;
  tx: string;
  ts: number;
  index: number;
  block: number;
  base: string;
};
type TokenRec = { markets: MarketEntry[]; firstAt: number; count: number; base: string };

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

export function EquifoldDemo({ locale }: { locale: Locale }) {
  const [endpoint, setEndpoint] = useState<EpKey>("base");
  const [factory, setFactory] = useState("");
  const [topic0, setTopic0] = useState(DEFAULT_TOPIC);
  const [burstSec, setBurstSec] = useState("30");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [hasHit, setHasHit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusToken, setFocusToken] = useState<string | null>(null);
  const [fixtureCoin, setFixtureCoin] = useState<{ label: string; addr: string } | null>(null);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const marketsByToken = useRef(new Map<string, TokenRec>());
  const fields = useRef({ endpoint, factory, topic0, burstSec });
  fields.current = { endpoint, factory, topic0, burstSec };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 80));
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const bundle = buildEquiFixtures(locale);
    setFixtureCoin({ label: bundle.coinLabel, addr: bundle.coinAddr });
    setFocusToken(bundle.coinAddr);
    for (const ev of bundle.events) {
      setEvents((prev) => [ev, ...prev].slice(0, 80));
    }
    setHasHit(true);
  }, [locale]);

  useEffect(() => {
    try {
      const ep = localStorage.getItem(LS + "endpoint") as EpKey | null;
      if (ep && ENDPOINTS[ep]) setEndpoint(ep);
      setFactory(localStorage.getItem(LS + "factory") || "");
      const t0 = localStorage.getItem(LS + "topic0");
      if (t0) setTopic0(t0);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "endpoint", fields.current.endpoint);
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "topic0", fields.current.topic0.trim());
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

  const onMarket = useCallback(
    (r: Record<string, unknown>) => {
      const baseToken = unpadTopic(((r.topics as string[]) || [])[1]);
      const quoteToken = unpadTopic(((r.topics as string[]) || [])[2]);
      const market = wordAddr(r.data as string, 0);
      if (!baseToken) return;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const now = Date.now();
      let rec = marketsByToken.current.get(baseToken);
      if (!rec) {
        rec = { markets: [], firstAt: now, count: 0, base: baseToken };
        marketsByToken.current.set(baseToken, rec);
      }
      rec.count += 1;
      const index = rec.count;
      rec.markets.push({
        market,
        quote: quoteToken,
        tx: String(r.transactionHash || ""),
        ts: now,
        index,
        block: bn,
        base: baseToken,
      });
      if (!focusToken) setFocusToken(baseToken);
      const burst = Number(fields.current.burstSec) || 30;
      const recent = rec.markets.filter((m) => now - m.ts <= burst * 1000);
      const tags: string[] = index === 1 ? ["FIRST"] : ["NEXT", `N=${index}`];
      if (recent.length >= 2) tags.push("BURST");
      const kind =
        index === 1
          ? locale === "zh"
            ? "首个市场"
            : "First market"
          : locale === "zh"
            ? "又开一个"
            : "Next market";
      const epLabel = fields.current.endpoint === "rh" ? "RH" : "BASE";
      pushEvent({
        kind,
        tags,
        title: shortAddr(market),
        body: `${shortAddr(baseToken)} · ${shortAddr(quoteToken)} · #${bn}`,
        address: market || undefined,
        block: bn,
        tx: String(r.transactionHash || "") || undefined,
        chain: epLabel,
      });
    },
    [focusToken, locale, pushEvent]
  );

  const onLogMsg = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const topic = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      if (topic === fields.current.topic0.trim().toLowerCase()) onMarket(r);
    },
    [onMarket]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const fac = fields.current.factory.trim();
    const topic = fields.current.topic0.trim().toLowerCase();
    const filt: { topics: string[]; address?: string } = { topics: [topic] };
    if (isAddr(fac)) filt.address = fac.toLowerCase();
    send("eth_subscribe", ["logs", filt]);
    setStatus("listening");
  }, []);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    const ep = ENDPOINTS[fields.current.endpoint];
    setStatus("connecting");
    const ws = new WebSocket(ep.wss);
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
      if (msg.id && typeof msg.result === "string") return;
      if (msg.id && msg.error) {
        setStatus("error");
        return;
      }
      if (msg.method !== "eth_subscription") return;
      const params = msg.params as { result?: Record<string, unknown> } | undefined;
      const r = params?.result;
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

  const start = useCallback(() => {
    setHasHit(false);
    wantRun.current = true;
    connect();
  }, [connect]);

  const stop = () => {
    wantRun.current = false;
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    setStatus("stopped");
  };

  useEffect(() => {
    return () => {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const ep = ENDPOINTS[endpoint];
  const running = status === "connecting" || status === "listening";

  const focusRec = focusToken ? marketsByToken.current.get(focusToken) : null;
  const coinTitle = focusRec
    ? shortAddr(focusRec.base)
    : fixtureCoin
      ? fixtureCoin.label
      : t(locale, "equifold.coinFallback");
  const coinMeta = focusRec
    ? `${shortAddr(focusRec.base)} · ${focusRec.count} markets · ${endpoint === "rh" ? "RH" : "Base"}`
    : fixtureCoin
      ? `${shortAddr(fixtureCoin.addr)} · ${locale === "zh" ? "示意币 · 多市场分叉" : "demo coin · multi-market fork"}`
      : t(locale, "equifold.metaIdle");

  const columns = useMemo(() => {
    const first = events.filter((ev) => ev.tags.includes("FIRST"));
    const next = events.filter((ev) => !ev.tags.includes("FIRST"));
    return [
      { id: "first", title: t(locale, "equifold.colFirst"), events: first },
      { id: "next", title: t(locale, "equifold.colNext"), events: next },
      { id: "all", title: t(locale, "equifold.colAll"), events: events },
    ];
  }, [events, locale]);

  const chainControls = (
    <ToggleGroup
      type="single"
      value={endpoint}
      disabled={running}
      onValueChange={(v) => {
        if (v === "base" || v === "rh") {
          setEndpoint(v);
          if (wantRun.current) {
            try {
              wsRef.current?.close();
            } catch {
              /* ignore */
            }
          }
        }
      }}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="base">Base</ToggleGroupItem>
      <ToggleGroupItem value="rh">RH</ToggleGroupItem>
    </ToggleGroup>
  );

  const settings = (
    <div className="space-y-3">
      <EndpointBar locale={locale} wss={ep.wss} https={ep.https} chainLabel={ep.label} />
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
            <CardTitle>{locale === "zh" ? "可选参数" : "Optional knobs"}</CardTitle>
            <CardDescription>
              {locale === "zh"
                ? "可切换 Base / Robinhood。一般不用改。"
                : "Toggle Base / Robinhood. Leave factory empty for wide listen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
              Burst (s)
              <Input
                className="h-11 w-24"
                type="number"
                min={1}
                max={120}
                value={burstSec}
                onChange={(e) => setBurstSec(e.target.value)}
              />
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="factory">Factory</Label>
              <Input id="factory" placeholder="0x…" value={factory} onChange={(e) => setFactory(e.target.value)} />
            </div>

            <label className="inline-flex items-center gap-2 border border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.06)] px-2.5 py-2 text-sm text-[var(--color-warn)]">
              <input
                type="checkbox"
                checked={demoHits}
                onChange={(e) => setDemoHits(e.target.checked)}
                className="h-4 w-4"
              />
              {t(locale, "demoHits.toggle")}
              <span className="font-mono text-[10px] opacity-80">?demoHits=1</span>
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="topic0">Market topic0</Label>
              <Input id="topic0" value={topic0} onChange={(e) => setTopic0(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </SettingsPanel>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col pb-24" data-layout="equi">
      <MonitorChrome
        locale={locale}
        title={t(locale, "equifold.title")}
        tag={t(locale, "equifold.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
      />
      <EquiSplitLayout
        locale={locale}
        coinTitle={coinTitle}
        coinMeta={coinMeta}
        columns={columns}
        onStart={start}
        onStop={stop}
        running={running}
        connecting={status === "connecting"}
        chainControls={chainControls}
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
