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
  wordU256,
} from "@blockreq/rpc";

const EP = PUBLIC_ENDPOINTS.robinhood;
const WSS = EP.wss;
const CHAIN_ID = EP.chainIdHex;
/** Uniswap V2 Mint(address,uint256,uint256) topic0 */
const MINT =
  "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f";
/** Placeholder PairCreated topic0 — swap if Anoncoin uses an equivalent open event. */
const DEFAULT_PAIR_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const LS = "blockreq.anoncoin-rh.";

type FeedCard = { id: string; kind: string; tags: string[]; body: string; fresh?: boolean };

type PairRec = {
  token0: string;
  token1: string;
  baseSide: string;
  quote: string;
  block: number;
  tx?: string;
  firstLp: boolean;
};

const DEMO_CARDS: Omit<FeedCard, "id" | "fresh">[] = [
  {
    kind: "新开盘",
    tags: ["DEMO", "preview", "$SPCX"],
    body: "pair=0xabc…demo · base=0xmeme… · quote=0xspcx… · #demo · local animation only",
  },
  {
    kind: "LP 到位",
    tags: ["DEMO", "first-LP"],
    body: "pair=0xabc…demo a0=1e18 a1=5e17 · preview card for 15s screen recording",
  },
];

export function AnoncoinDemo({ locale }: { locale: Locale }) {
  const [factory, setFactory] = useState("");
  const [quote, setQuote] = useState("");
  const [topicPair, setTopicPair] = useState(DEFAULT_PAIR_TOPIC);
  const [subPair, setSubPair] = useState(true);
  const [subMint, setSubMint] = useState(true);
  // Default off so auto-start works without paste; paste quote + enable for narrow demos.
  const [onlyQuote, setOnlyQuote] = useState(false);
  const [minLiq, setMinLiq] = useState("0");
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | undefined>();
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [beat, setBeat] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const pairs = useRef(new Map<string, PairRec>());
  const started = useRef(false);
  const fields = useRef({ factory, quote, topicPair, subPair, subMint, onlyQuote, minLiq });
  fields.current = { factory, quote, topicPair, subPair, subMint, onlyQuote, minLiq };

  const log = useCallback((line: string) => {
    const t = new Date().toISOString().slice(11, 19);
    setLogs((prev) => [`[${t}] ${line}`, ...prev].slice(0, 200));
  }, []);

  const pushCard = useCallback((kind: string, tags: string[], body: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCards((prev) => [{ id, kind, tags, body, fresh: true }, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    try {
      setFactory(localStorage.getItem(LS + "factory") || "");
      setQuote(localStorage.getItem(LS + "quote") || "");
      const t = localStorage.getItem(LS + "topicPair");
      if (t) setTopicPair(t);
    } catch { /* ignore */ }
  }, []);

  // Visible motion by default for ~15s screen recordings (local only — not extra RPC).
  useEffect(() => {
    const timers: number[] = [];
    DEMO_CARDS.forEach((c, i) => {
      timers.push(
        window.setTimeout(() => {
          pushCard(c.kind, c.tags, c.body);
        }, 400 + i * 900)
      );
    });
    const beatTimer = window.setInterval(() => setBeat((n) => n + 1), 1000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(beatTimer);
    };
  }, [pushCard]);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "quote", fields.current.quote.trim());
      localStorage.setItem(LS + "topicPair", fields.current.topicPair.trim());
    } catch { /* ignore */ }
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

      if (!quoteHit && fields.current.onlyQuote) {
        log(`PairCreated skip non-quote pair=${shortAddr(pair)} #${bn}`);
        return;
      }

      const baseSide = hit0 ? token1 : hit1 ? token0 : "";
      const tags = ["新开盘", "anon"];
      if (quoteHit) tags.push("$SPCX", "quote-hit");

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
        "新开盘",
        tags,
        `pair=${shortAddr(pair)} · base=${shortAddr(baseSide || "?")} · quote=${
          quoteHit ? shortAddr(q) : "—"
        } · #${bn} · tx=${shortAddr(String(r.transactionHash || ""))}`
      );
      if (quoteHit) {
        pushCard(
          "quote hit",
          ["$SPCX", hit0 ? "token0" : "token1"],
          `QUOTE_TOKEN=${q} · meme/base=${baseSide} · factoryTx=${r.transactionHash}`
        );
      }
      log(`新开盘 pair=${shortAddr(pair)} quoteHit=${quoteHit} #${bn}`);
    },
    [log, pushCard]
  );

  const onMint = useCallback(
    (r: Record<string, unknown>) => {
      const pool = String(r.address || "").toLowerCase();
      const known = pairs.current.get(pool);
      if (!known) return;
      if (known.firstLp) {
        log(`Mint again pool=${shortAddr(pool)}`);
        return;
      }
      const a0 = wordU256(r.data as string, 0);
      const a1 = wordU256(r.data as string, 1);
      const minRaw = BigInt(Math.floor(Number(fields.current.minLiq || 0) * 1e18));
      const sum = a0 + a1;
      if (minRaw > 0n && sum < minRaw) {
        log(`Mint below MIN_LIQ pool=${shortAddr(pool)} sum=${sum}`);
        return;
      }
      known.firstLp = true;
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : "?";
      pushCard(
        "LP 到位",
        ["first-LP", "开盘簇"],
        `pair=${shortAddr(pool)} a0=${a0} a1=${a1} · quote=${
          known.quote ? shortAddr(known.quote) : "—"
        } · #${bn}`
      );
      log(`LP 到位 pool=${shortAddr(pool)} sum=${sum} #${bn}`);
    },
    [log, pushCard]
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
      log(
        `eth_subscribe PairCreated${
          factoryOk ? " @ " + shortAddr(f) : " (topic-wide)"
        } · chainId=${CHAIN_ID}`
      );
    }
    if (fields.current.subMint) {
      // Prefer factory-scoped Mint once pairs are known; topic-wide is OK for demo
      // but we only render Mint for pairs already cached from PairCreated.
      send("eth_subscribe", ["logs", { topics: [MINT] }]);
      log("eth_subscribe Mint (topic-wide; filters to quote-pairs in cache)");
    }
    setStatus("listening");
    setStatusDetail(`Listening · Robinhood ${CHAIN_ID}`);
  }, [log]);

  const connect = useCallback(() => {
    if (!wantRun.current) return;
    setStatus("connecting");
    setStatusDetail("Connecting to public WSS…");
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
      if (msg.id && msg.result && typeof msg.result === "string") {
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
      onLog(r);
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
  }, [log, onLog, subscribeAll]);

  const start = useCallback(() => {
    const q = fields.current.quote.trim();
    if (fields.current.onlyQuote && !isAddr(q)) {
      setStatus("error");
      setStatusDetail("Paste QUOTE_TOKEN ($SPCX) first, or uncheck quote-only");
      log("start blocked: empty quote");
      return;
    }
    wantRun.current = true;
    connect();
  }, [connect, log]);

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
    pairs.current.clear();
  };

  // Auto-start once for iframe / screen-recording friendly embeds.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = window.setTimeout(() => start(), 700);
    return () => clearTimeout(t);
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

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t(locale, "anoncoin.title")}
        </h1>
        <p className="text-base text-slate-600 sm:text-lg">
          {t(locale, "anoncoin.blurb")}{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.95em]">eth_subscribe</code>
        </p>
        <p className="text-sm text-slate-500">{t(locale, "common.publicOnly")}</p>
        <p className="font-mono text-sm text-slate-500 break-all">
          {WSS} · chainId {CHAIN_ID}
        </p>
        <div className="sweep-bar rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900">
          <span className="live-ticker">
            Live feel · local enter/highlight/pulse · beat {beat}s · public-limit friendly ·&nbsp;
            Live feel · local enter/highlight/pulse · beat {beat}s · public-limit friendly ·&nbsp;
          </span>
        </div>
      </header>

      <Card className="border-sky-200 bg-sky-50/60">
        <CardHeader className="pb-2">
          <CardTitle>Placeholder factory</CardTitle>
          <CardDescription className="text-sky-900/80">
            Paste live <code>ANONCOIN_FACTORY</code> when known. Defaults to Uniswap V2-style{" "}
            <code>PairCreated</code> topic0 — swap topic if Anoncoin uses an equivalent open event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-xs text-slate-700 whitespace-pre-wrap sm:text-sm">
{`// Placeholder ABI fragment (swap for real Anoncoin Factory when known)
event PairCreated(address indexed token0, address indexed token1, address pair, uint);
// topics[0] = keccak256("PairCreated(address,address,address,uint256)")
// env stand-ins: ANONCOIN_FACTORY · QUOTE_TOKEN ($SPCX) · MIN_LIQ`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Big beginner defaults · leave factory empty for topic-wide (noisier). Enable quote-only after pasting $SPCX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="factory">Factory (optional)</Label>
            <Input
              id="factory"
              placeholder="0x… ANONCOIN_FACTORY"
              value={factory}
              onChange={(e) => setFactory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote">QUOTE_TOKEN ($SPCX)</Label>
            <Input
              id="quote"
              placeholder="0x… quote whitelist"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-5 text-base">
            <label className="inline-flex items-center gap-2.5">
              <input type="checkbox" checked={subPair} onChange={(e) => setSubPair(e.target.checked)} className="h-5 w-5" />
              PairCreated
            </label>
            <label className="inline-flex items-center gap-2.5">
              <input type="checkbox" checked={subMint} onChange={(e) => setSubMint(e.target.checked)} className="h-5 w-5" />
              Mint (LP ready)
            </label>
            <label className="inline-flex items-center gap-2.5">
              <input type="checkbox" checked={onlyQuote} onChange={(e) => setOnlyQuote(e.target.checked)} className="h-5 w-5" />
              quote-only
            </label>
            <label className="inline-flex items-center gap-2.5">
              MIN_LIQ
              <Input
                className="h-10 w-28"
                type="number"
                min={0}
                step="0.01"
                value={minLiq}
                onChange={(e) => setMinLiq(e.target.value)}
              />
              ×1e18
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic">PairCreated topic0</Label>
            <Input id="topic" value={topicPair} onChange={(e) => setTopicPair(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={start} disabled={running}>
          {t(locale, "common.start")}
        </Button>
        <Button size="lg" variant="secondary" onClick={stop} disabled={!running && status !== "error"}>
          Stop
        </Button>
        <Button size="lg" variant="outline" onClick={clear}>
          Clear
        </Button>
        <StatusPill status={status} detail={statusDetail} />
      </div>

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
                {c.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
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
