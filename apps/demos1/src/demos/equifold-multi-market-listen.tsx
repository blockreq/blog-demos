import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  StatusPill,
  type ConnStatus,
} from "@blockreq/ui";
import {
  PUBLIC_ENDPOINTS,
  isAddr,
  shortAddr,
  unpadTopic,
  wordAddr,
} from "@blockreq/rpc";

const ENDPOINTS = {
  base: PUBLIC_ENDPOINTS.base,
  rh: PUBLIC_ENDPOINTS.robinhood,
} as const;

type EpKey = keyof typeof ENDPOINTS;

/** Placeholder PairCreated topic0 — swap for Equifold market-open topic. */
const DEFAULT_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const LS = "blockreq.equifold-mm.";

type FeedCard = { id: string; kind: string; tags: string[]; body: string };
type MarketEntry = { market: string; quote: string; tx: string; ts: number; index: number; block: number };
type TokenRec = { markets: MarketEntry[]; firstAt: number; count: number };

const DEMO_CARDS: Omit<FeedCard, "id">[] = [
  {
    kind: "P0 · first",
    tags: ["DEMO", "preview", "P0"],
    body: "token=0xmeme… · quote=0xweth… · market=0xabc… · n=1 · Δt=0ms · #demo",
  },
  {
    kind: "P1 · nth",
    tags: ["DEMO", "P1", "rate · burst"],
    body: "token=0xmeme… · quote=0xusdc… · market=0xdef… · n=2 · Δt=1200ms · preview",
  },
];

export function EquifoldDemo({ locale }: { locale: Locale }) {
  const [endpoint, setEndpoint] = useState<EpKey>("base");
  const [factory, setFactory] = useState("");
  const [topic0, setTopic0] = useState(DEFAULT_TOPIC);
  const [burstSec, setBurstSec] = useState("30");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | undefined>();
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [aggText, setAggText] = useState("(empty)");
  const [beat, setBeat] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const marketsByToken = useRef(new Map<string, TokenRec>());
  const started = useRef(false);
  const fields = useRef({ endpoint, factory, topic0, burstSec });
  fields.current = { endpoint, factory, topic0, burstSec };

  const log = useCallback((line: string) => {
    const tstamp = new Date().toISOString().slice(11, 19);
    setLogs((prev) => [`[${tstamp}] ${line}`, ...prev].slice(0, 200));
  }, []);

  const pushCard = useCallback((kind: string, tags: string[], body: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCards((prev) => [{ id, kind, tags, body }, ...prev].slice(0, 40));
  }, []);

  const renderAgg = useCallback(() => {
    if (!marketsByToken.current.size) {
      setAggText("(empty)");
      return;
    }
    const lines: string[] = [];
    for (const [token, rec] of marketsByToken.current) {
      lines.push(
        `${shortAddr(token)} · n=${rec.count} · first=${new Date(rec.firstAt).toISOString().slice(11, 19)}`
      );
      for (const m of rec.markets) {
        lines.push(
          `  [#${m.index}] quote=${shortAddr(m.quote)} market=${shortAddr(m.market)} tx=${shortAddr(m.tx)}`
        );
      }
    }
    setAggText(lines.join("\n"));
  }, []);

  useEffect(() => {
    try {
      const ep = localStorage.getItem(LS + "endpoint") as EpKey | null;
      if (ep && ENDPOINTS[ep]) setEndpoint(ep);
      setFactory(localStorage.getItem(LS + "factory") || "");
      const t0 = localStorage.getItem(LS + "topic0");
      if (t0) setTopic0(t0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    DEMO_CARDS.forEach((c, i) => {
      timers.push(window.setTimeout(() => pushCard(c.kind, c.tags, c.body), 400 + i * 900));
    });
    const beatTimer = window.setInterval(() => setBeat((n) => n + 1), 1000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(beatTimer);
    };
  }, [pushCard]);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "endpoint", fields.current.endpoint);
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "topic0", fields.current.topic0.trim());
    } catch { /* ignore */ }
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
      if (!baseToken) {
        log("skip: missing baseToken topic");
        return;
      }
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const now = Date.now();
      let rec = marketsByToken.current.get(baseToken);
      if (!rec) {
        rec = { markets: [], firstAt: now, count: 0 };
        marketsByToken.current.set(baseToken, rec);
      }
      rec.count += 1;
      const index = rec.count;
      const entry: MarketEntry = {
        market,
        quote: quoteToken,
        tx: String(r.transactionHash || ""),
        ts: now,
        index,
        block: bn,
      };
      rec.markets.push(entry);

      const burst = Number(fields.current.burstSec) || 30;
      const recent = rec.markets.filter((m) => now - m.ts <= burst * 1000);
      const tags: string[] = [];
      let kind = "market open";
      if (index === 1) {
        tags.push("P0", "first");
        kind = "P0 · first";
      } else {
        tags.push("P1", "nth", "index=" + index);
        kind = "P1 · nth";
      }
      if (recent.length >= 2) tags.push("rate · burst");
      else if (index > 1) tags.push("rate · steady");

      const delta = index === 1 ? 0 : now - rec.firstAt;
      pushCard(
        kind,
        tags,
        `token=${shortAddr(baseToken)} · quote=${shortAddr(quoteToken)} · market=${shortAddr(market)} · n=${rec.count} · Δt=${delta}ms · #${bn} · tx=${shortAddr(String(r.transactionHash || ""))}`
      );
      if (recent.length >= 2) {
        pushCard(
          "rate · burst cluster",
          ["burst", "token=" + shortAddr(baseToken)],
          recent.map((m) => `#${m.index}:${shortAddr(m.quote)}`).join(" · ") + ` · window=${burst}s`
        );
      }
      renderAgg();
      log(`market #${index} token=${shortAddr(baseToken)} quote=${shortAddr(quoteToken)} #${bn}`);
    },
    [log, pushCard, renderAgg]
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
    const ep = ENDPOINTS[fields.current.endpoint];
    const fac = fields.current.factory.trim();
    const topic = fields.current.topic0.trim().toLowerCase();
    const filt: { topics: string[]; address?: string } = { topics: [topic] };
    if (isAddr(fac)) filt.address = fac.toLowerCase();
    send("eth_subscribe", ["logs", filt]);
    log(
      `eth_subscribe market-open${isAddr(fac) ? " @ " + shortAddr(fac) : " (topic-wide)"} · ${ep.label} chainId=${ep.chainIdHex}`
    );
    setStatus("listening");
    setStatusDetail(`Listening · ${ep.label} ${ep.chainIdHex}`);
  }, [log]);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    const ep = ENDPOINTS[fields.current.endpoint];
    setStatus("connecting");
    setStatusDetail(`Connecting ${ep.label}…`);
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
      if (msg.id && typeof msg.result === "string") {
        log("subscription id=" + msg.result);
        return;
      }
      if (msg.id && msg.error) {
        const err = msg.error as { message?: string };
        log("rpc error: " + (err.message || JSON.stringify(msg.error)));
        setStatus("error");
        setStatusDetail(err.message || "RPC error");
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
        setStatusDetail("Stopped");
        return;
      }
      setStatus("connecting");
      setStatusDetail(`Reconnect in ${backoffMs.current}ms`);
      setTimeout(connect, backoffMs.current);
      backoffMs.current = Math.min(backoffMs.current * 2, 30000);
    };
    ws.onerror = () => {
      setStatus("error");
      setStatusDetail("WebSocket error — retrying…");
      try {
        ws.close();
      } catch { /* ignore */ }
    };
  }, [log, onLogMsg, subscribeAll]);

  const start = useCallback(() => {
    wantRun.current = true;
    connect();
  }, [connect]);

  const stop = () => {
    wantRun.current = false;
    try {
      wsRef.current?.close();
    } catch { /* ignore */ }
    setStatus("stopped");
    setStatusDetail("Stopped");
  };

  const clear = () => {
    setLogs([]);
    setCards([]);
    seen.current.clear();
    marketsByToken.current.clear();
    renderAgg();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const timer = window.setTimeout(() => start(), 700);
    return () => clearTimeout(timer);
  }, [start]);

  useEffect(() => {
    return () => {
      wantRun.current = false;
      try {
        wsRef.current?.close();
      } catch { /* ignore */ }
    };
  }, []);

  const running = status === "connecting" || status === "listening";
  const ep = ENDPOINTS[endpoint];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t(locale, "equifold.title")}
        </h1>
        <p className="text-base text-slate-600 sm:text-lg">{t(locale, "equifold.blurb")}</p>
        <p className="text-sm text-slate-500">{t(locale, "common.publicOnly")}</p>
        <p className="font-mono text-sm text-slate-500 break-all">
          {ep.wss} · chainId {ep.chainIdHex}
        </p>
        <div className="sweep-bar rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900">
          <span className="live-ticker">
            Live feel · dual-endpoint · beat {beat}s · public-limit friendly ·&nbsp;
            Live feel · dual-endpoint · beat {beat}s · public-limit friendly ·&nbsp;
          </span>
        </div>
      </header>

      <Card className="border-sky-200 bg-sky-50/60">
        <CardHeader className="pb-2">
          <CardTitle>Placeholder factory + topic0</CardTitle>
          <CardDescription className="text-sky-900/80">
            Paste live <code>EQUIFOLD_FACTORY</code> / <code>EQUIFOLD_MARKET_TOPIC0</code> when known.
            Default topic0 = Uniswap V2-style PairCreated decode (base/quote/market).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-xs text-slate-700 whitespace-pre-wrap sm:text-sm">
{`// Placeholder ABI — swap for real Equifold Factory
event PairCreated(address indexed token0, address indexed token1, address pair, uint);
// Or: event MarketCreated(address indexed baseToken, address indexed quoteToken, address market, uint);
// env: EQUIFOLD_FACTORY · EQUIFOLD_MARKET_TOPIC0`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Base default · toggle Robinhood · leave factory empty for topic-wide (noisier).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2.5 text-base">
              Endpoint
              <select
                className="h-12 rounded-xl border-2 px-3 font-medium"
                value={endpoint}
                disabled={running}
                onChange={(e) => {
                  setEndpoint(e.target.value as EpKey);
                  if (wantRun.current) {
                    log("endpoint changed — reconnect");
                    try {
                      wsRef.current?.close();
                    } catch { /* ignore */ }
                  }
                }}
              >
                <option value="base">Base (0x2105)</option>
                <option value="rh">Robinhood (0x1237)</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2.5 text-base">
              Burst window
              <Input
                className="h-10 w-24"
                type="number"
                min={1}
                max={120}
                value={burstSec}
                onChange={(e) => setBurstSec(e.target.value)}
              />
              s
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="factory">EQUIFOLD_FACTORY</Label>
            <Input
              id="factory"
              placeholder="0x… factory (recommended)"
              value={factory}
              onChange={(e) => setFactory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic0">Market topic0</Label>
            <Input id="topic0" value={topic0} onChange={(e) => setTopic0(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={start} disabled={running}>
          {t(locale, "common.start")}
        </Button>
        <Button size="lg" variant="secondary" onClick={stop} disabled={!running && status !== "error"}>
          {t(locale, "common.stop")}
        </Button>
        <Button size="lg" variant="outline" onClick={clear}>
          {t(locale, "common.clear")}
        </Button>
        <StatusPill status={status} detail={statusDetail} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">marketsByToken</h2>
        <pre className="max-h-40 overflow-auto rounded-2xl border bg-white p-4 font-mono text-xs text-slate-700">
          {aggText}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">{t(locale, "common.feed")}</h2>
        <div className="max-h-[24rem] space-y-2.5 overflow-auto rounded-2xl border-2 bg-slate-950 p-4">
          {cards.length === 0 && (
            <p className="text-base text-slate-400">{t(locale, "common.waiting")}</p>
          )}
          {cards.map((c) => (
            <div
              key={c.id}
              className="card-enter rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-sky-400">{c.kind}</span>
                {c.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              <div className="font-mono text-[13px] break-all leading-relaxed">{c.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">{t(locale, "common.log")}</h2>
        <pre className="max-h-52 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-200 sm:text-sm">
          {logs.length ? logs.join("\n") : "—"}
        </pre>
      </section>
    </div>
  );
}
