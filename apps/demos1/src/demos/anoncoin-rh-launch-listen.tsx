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
  wordU256,
} from "@blockreq/rpc";
import { ListenShell } from "../components/listen-shell";

const EP = PUBLIC_ENDPOINTS.robinhood;
const WSS = EP.wss;
const CHAIN_ID = EP.chainIdHex;
const MINT =
  "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f";
const DEFAULT_PAIR_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const LS = "blockreq.anoncoin-rh.";

type FeedCard = { id: string; kind: string; tags: string[]; body: string };
type PairRec = {
  token0: string;
  token1: string;
  baseSide: string;
  quote: string;
  block: number;
  tx?: string;
  firstLp: boolean;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

export function AnoncoinDemo({ locale }: { locale: Locale }) {
  const [factory, setFactory] = useState("");
  const [quote, setQuote] = useState("");
  const [topicPair, setTopicPair] = useState(DEFAULT_PAIR_TOPIC);
  const [subPair, setSubPair] = useState(true);
  const [subMint, setSubMint] = useState(true);
  const [onlyQuote, setOnlyQuote] = useState(false);
  const [minLiq, setMinLiq] = useState("0");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [hasHit, setHasHit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toastMeta, setToastMeta] = useState("RH · … · JUST NOW");

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const pairs = useRef(new Map<string, PairRec>());
  const fields = useRef({ factory, quote, topicPair, subPair, subMint, onlyQuote, minLiq });
  fields.current = { factory, quote, topicPair, subPair, subMint, onlyQuote, minLiq };

  const pushCard = useCallback((kind: string, tags: string[], body: string, meta?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCards((prev) => [{ id, kind, tags, body }, ...prev].slice(0, 40));
    setHasHit(true);
    if (meta) setToastMeta(meta);
  }, []);

  useEffect(() => {
    try {
      setFactory(localStorage.getItem(LS + "factory") || "");
      setQuote(localStorage.getItem(LS + "quote") || "");
      const tp = localStorage.getItem(LS + "topicPair");
      if (tp) setTopicPair(tp);
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "quote", fields.current.quote.trim());
      localStorage.setItem(LS + "topicPair", fields.current.topicPair.trim());
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

  const onPairCreated = useCallback(
    (r: Record<string, unknown>) => {
      const q = fields.current.quote.trim().toLowerCase();
      const topics = (r.topics as string[]) || [];
      const token0 = unpadTopic(topics[1]);
      const token1 = unpadTopic(topics[2]);
      const pair = wordAddr(r.data as string, 0);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const hit0 = !!q && token0 === q;
      const hit1 = !!q && token1 === q;
      const quoteHit = hit0 || hit1;
      if (!quoteHit && fields.current.onlyQuote) return;

      const baseSide = hit0 ? token1 : hit1 ? token0 : "";
      const tags = ["NEW", "ANON"];
      if (quoteHit) tags.push("QUOTE");
      const rec: PairRec = {
        token0,
        token1,
        baseSide,
        quote: quoteHit ? q : "",
        block: bn,
        tx: String(r.transactionHash || ""),
        firstLp: false,
      };
      if (pair) pairs.current.set(pair.toLowerCase(), rec);
      pushCard(
        locale === "zh" ? "新开盘" : "New launch",
        tags,
        `${shortAddr(pair)} · ${shortAddr(baseSide || "?")} · #${bn}`,
        `RH · ${shortAddr(pair)} · JUST NOW`
      );
    },
    [locale, pushCard]
  );

  const onMint = useCallback(
    (r: Record<string, unknown>) => {
      const pool = String(r.address || "").toLowerCase();
      const known = pairs.current.get(pool);
      if (!known || known.firstLp) return;
      const a0 = wordU256(r.data as string, 0);
      const a1 = wordU256(r.data as string, 1);
      const minRaw = BigInt(Math.floor(Number(fields.current.minLiq || 0) * 1e18));
      if (minRaw > 0n && a0 + a1 < minRaw) return;
      known.firstLp = true;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      pushCard(
        locale === "zh" ? "LP 到位" : "LP ready",
        ["LP"],
        `${shortAddr(pool)} · #${bn}`,
        `RH · ${shortAddr(pool)} · JUST NOW`
      );
    },
    [locale, pushCard]
  );

  const onLog = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      const topic = fields.current.topicPair.trim().toLowerCase();
      if (t0 === topic) return onPairCreated(r);
      if (t0 === MINT) return onMint(r);
    },
    [onMint, onPairCreated]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const f = fields.current.factory.trim();
    const topic = fields.current.topicPair.trim().toLowerCase();
    const factoryOk = isAddr(f);
    if (fields.current.subPair) {
      const filt: { topics: string[]; address?: string } = { topics: [topic] };
      if (factoryOk) filt.address = f.toLowerCase();
      send("eth_subscribe", ["logs", filt]);
    }
    if (fields.current.subMint) {
      send("eth_subscribe", ["logs", { topics: [MINT] }]);
    }
    setStatus("listening");
  }, []);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    setStatus("connecting");
    const ws = new WebSocket(WSS);
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

  const start = useCallback(() => {
    const q = fields.current.quote.trim();
    if (fields.current.onlyQuote && !isAddr(q)) {
      setStatus("error");
      return;
    }
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
    pairs.current.clear();
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

  const heroKey =
    status === "connecting"
      ? "anoncoin.hero.connecting"
      : hasHit
        ? "anoncoin.hero.hit"
        : status === "listening"
          ? "anoncoin.hero.listening"
          : "anoncoin.hero.idle";

  return (
    <ListenShell
      locale={locale}
      status={status}
      hasHit={hasHit}
      tag={t(locale, "anoncoin.tag")}
      title={t(locale, "anoncoin.title")}
      heroSub={t(locale, heroKey)}
      toast={
        hasHit
          ? { title: t(locale, "anoncoin.toast"), meta: toastMeta }
          : null
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
                    ? "一般不用改。粘贴工厂地址可更安静。"
                    : "Leave empty for the default wide listen."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
                  <Label htmlFor="quote">Quote token</Label>
                  <Input
                    id="quote"
                    placeholder="0x…"
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={subPair}
                      onChange={(e) => setSubPair(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Pair open
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={subMint}
                      onChange={(e) => setSubMint(e.target.checked)}
                      className="h-4 w-4"
                    />
                    LP ready
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={onlyQuote}
                      onChange={(e) => setOnlyQuote(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Quote only
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="topic">Topic0</Label>
                  <Input
                    id="topic"
                    value={topicPair}
                    onChange={(e) => setTopicPair(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minLiq">Min LP (×1e18)</Label>
                  <Input
                    id="minLiq"
                    type="number"
                    min={0}
                    step="0.01"
                    value={minLiq}
                    onChange={(e) => setMinLiq(e.target.value)}
                  />
                </div>
                <p className="font-mono text-[11px] text-[var(--color-muted-foreground)] break-all">
                  {WSS} · {CHAIN_ID}
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
