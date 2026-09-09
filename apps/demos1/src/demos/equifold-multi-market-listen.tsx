import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  Badge,
  type ConnStatus,
} from "@blockreq/ui";
import {
  PUBLIC_ENDPOINTS,
  isAddr,
  shortAddr,
  unpadTopic,
  wordAddr,
} from "@blockreq/rpc";
import { ListenShell } from "../components/listen-shell";

const ENDPOINTS = {
  base: PUBLIC_ENDPOINTS.base,
  rh: PUBLIC_ENDPOINTS.robinhood,
} as const;

type EpKey = keyof typeof ENDPOINTS;

const DEFAULT_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const LS = "blockreq.equifold-mm.";

type FeedCard = { id: string; kind: string; tags: string[]; body: string };
type MarketEntry = {
  market: string;
  quote: string;
  tx: string;
  ts: number;
  index: number;
  block: number;
};
type TokenRec = { markets: MarketEntry[]; firstAt: number; count: number };

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
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [hasHit, setHasHit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toastMeta, setToastMeta] = useState("BASE · … · JUST NOW");

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const marketsByToken = useRef(new Map<string, TokenRec>());
  const fields = useRef({ endpoint, factory, topic0, burstSec });
  fields.current = { endpoint, factory, topic0, burstSec };

  const pushCard = useCallback((kind: string, tags: string[], body: string, meta?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCards((prev) => [{ id, kind, tags, body }, ...prev].slice(0, 40));
    setHasHit(true);
    if (meta) setToastMeta(meta);
  }, []);

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
        rec = { markets: [], firstAt: now, count: 0 };
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
      });
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
      pushCard(
        kind,
        tags,
        `${shortAddr(baseToken)} · ${shortAddr(quoteToken)} · ${shortAddr(market)} · #${bn}`,
        `${epLabel} · ${shortAddr(market)} · JUST NOW`
      );
    },
    [locale, pushCard]
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

  const reset = () => {
    wantRun.current = false;
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    setHasHit(false);
    setStatus("idle");
    setCards([]);
    seen.current.clear();
    marketsByToken.current.clear();
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
  const heroKey =
    status === "connecting"
      ? "equifold.hero.connecting"
      : hasHit
        ? "equifold.hero.hit"
        : status === "listening"
          ? "equifold.hero.listening"
          : "equifold.hero.idle";

  return (
    <ListenShell
      locale={locale}
      status={status}
      hasHit={hasHit}
      tag={t(locale, "equifold.tag")}
      title={t(locale, "equifold.title")}
      heroSub={t(locale, heroKey)}
      toast={
        hasHit ? { title: t(locale, "equifold.toast"), meta: toastMeta } : null
      }
      onStart={start}
      onReset={reset}
      settings={
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
                <CardTitle>{locale === "zh" ? "可选参数" : "Optional knobs"}</CardTitle>
                <CardDescription>
                  {locale === "zh"
                    ? "可切换 Base / Robinhood。一般不用改。"
                    : "Toggle Base / Robinhood. Leave factory empty for wide listen."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                    Chain
                    <select
                      className="h-11 border border-[var(--color-line)] bg-[#07070E] px-3 font-mono text-sm text-[var(--color-foreground)]"
                      value={endpoint}
                      disabled={status === "connecting" || status === "listening"}
                      onChange={(e) => {
                        setEndpoint(e.target.value as EpKey);
                        if (wantRun.current) {
                          try {
                            wsRef.current?.close();
                          } catch {
                            /* ignore */
                          }
                        }
                      }}
                    >
                      <option value="base">Base</option>
                      <option value="rh">Robinhood</option>
                    </select>
                  </label>
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
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="factory">Factory</Label>
                  <Input
                    id="factory"
                    placeholder="0x…"
                    value={factory}
                    onChange={(e) => setFactory(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="topic0">Market topic0</Label>
                  <Input id="topic0" value={topic0} onChange={(e) => setTopic0(e.target.value)} />
                </div>
                <p className="font-mono text-[11px] text-[var(--color-muted-foreground)] break-all">
                  {ep.wss} · {ep.chainIdHex}
                </p>
              </CardContent>
            </Card>
          </SettingsPanel>
        </div>
      }
    >
      {cards.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
            {t(locale, "common.feed")}
          </h2>
          <div className="max-h-64 space-y-2 overflow-auto border border-[var(--color-line)] bg-[#07070E] p-3">
            {cards.map((c) => (
              <div
                key={c.id}
                className="card-enter border border-[rgba(255,43,214,0.35)] bg-[rgba(8,8,14,0.95)] p-3 text-sm"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[var(--color-neon-mag)]">{c.kind}</span>
                  {c.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
                <div className="font-mono text-[14px] font-medium break-all text-[#D0D5E8]">
                  {c.body}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </ListenShell>
  );
}
