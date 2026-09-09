"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill, type ConnStatus } from "@/components/status-pill";
import { isAddr, shortAddr, unpadTopic } from "@/lib/utils";

/**
 * Base · public Free path.
 * Host MUST be base-rpc.blockreq.com (NOT base-mainnet-rpc).
 */
const WSS = "wss://base-rpc.blockreq.com/v1/rpc/public";
const HTTPS = "https://base-rpc.blockreq.com/v1/rpc/public";
const CHAIN_ID = "0x2105";
/** Uniswap v4 Initialize topic0 (commonly cited). */
const DEFAULT_INIT =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";
/** Placeholder LockLiquidity-ish topic — replace with real OpenLaunch event. */
const DEFAULT_LOCK =
  "0xe9f76a8d85d1454b2ecdbf900a15a31155a945b0e7bf889f718773bf90a4c196";
/** Commonly cited Base Uniswap v4 PoolManager — confirm against live docs. */
const DEFAULT_PM = "0x498581ff718922c3f8e6a244956af099b2652b2b";
const LS = "blockreq.openlaunch-base.";

type FeedCard = { id: string; kind: string; tags: string[]; body: string };
type TxRec = {
  init: { poolId: string; currency0: string; currency1: string; address: string } | null;
  lock: { address: string; tokenish: string } | null;
  clustered?: boolean;
};

const DEMO_CARDS: Omit<FeedCard, "id">[] = [
  {
    kind: "pool Initialize",
    tags: ["DEMO", "preview", "v4"],
    body: "poolId=0xdemo… · 0xweth… / 0xmeme… · pm=0x4985… · #demo · local animation only",
  },
  {
    kind: "一笔开盘",
    tags: ["DEMO", "one-tx", "OpenLaunch?"],
    body: "tx=0xdemo… · Initialize+lock cluster · preview for 15s screen recording",
  },
];

export function OpenLaunchDemo() {
  const [poolManager, setPoolManager] = useState(DEFAULT_PM);
  const [factory, setFactory] = useState("");
  const [topicInit, setTopicInit] = useState(DEFAULT_INIT);
  const [topicLock, setTopicLock] = useState(DEFAULT_LOCK);
  const [subInit, setSubInit] = useState(true);
  const [subLock, setSubLock] = useState(true);
  const [cluster, setCluster] = useState(true);
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
  const byTx = useRef(new Map<string, TxRec>());
  const started = useRef(false);
  const fields = useRef({
    poolManager, factory, topicInit, topicLock, subInit, subLock, cluster,
  });
  fields.current = {
    poolManager, factory, topicInit, topicLock, subInit, subLock, cluster,
  };

  const log = useCallback((line: string) => {
    const t = new Date().toISOString().slice(11, 19);
    setLogs((prev) => [`[${t}] ${line}`, ...prev].slice(0, 200));
  }, []);

  const pushCard = useCallback((kind: string, tags: string[], body: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCards((prev) => [{ id, kind, tags, body }, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    try {
      const pm = localStorage.getItem(LS + "poolManager");
      const fac = localStorage.getItem(LS + "factory");
      const ti = localStorage.getItem(LS + "topicInit");
      const tl = localStorage.getItem(LS + "topicLock");
      if (pm) setPoolManager(pm);
      if (fac != null) setFactory(fac);
      if (ti) setTopicInit(ti);
      if (tl) setTopicLock(tl);
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
      localStorage.setItem(LS + "poolManager", fields.current.poolManager.trim());
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "topicInit", fields.current.topicInit.trim());
      localStorage.setItem(LS + "topicLock", fields.current.topicLock.trim());
    } catch { /* ignore */ }
  };

  const send = (method: string, params: unknown[]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const id = nextId.current++;
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  };

  const latchTx = (tx: string) => {
    let rec = byTx.current.get(tx);
    if (!rec) {
      rec = { init: null, lock: null };
      byTx.current.set(tx, rec);
    }
    return rec;
  };

  const maybeCluster = useCallback(
    (tx: string, bn: number) => {
      if (!fields.current.cluster) return;
      const rec = byTx.current.get(tx);
      if (!rec || !rec.init || !rec.lock || rec.clustered) return;
      rec.clustered = true;
      const i = rec.init;
      pushCard(
        "一笔开盘",
        ["one-tx", "Initialize+lock", "OpenLaunch?"],
        `tx=${shortAddr(tx)} · c0=${shortAddr(i.currency0)} · c1=${shortAddr(
          i.currency1
        )} · poolId=${shortAddr(i.poolId)} · lock@${shortAddr(
          rec.lock.address
        )} · #${bn}`
      );
      log(`one-tx cluster tx=${shortAddr(tx)} #${bn}`);
    },
    [log, pushCard]
  );

  const onInitialize = useCallback(
    (r: Record<string, unknown>) => {
      const topics = (r.topics as string[]) || [];
      const poolId = topics[1] || "";
      const currency0 = unpadTopic(topics[2]);
      const currency1 = unpadTopic(topics[3]);
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const rec = latchTx(tx);
      rec.init = {
        poolId,
        currency0,
        currency1,
        address: String(r.address || "").toLowerCase(),
      };
      pushCard(
        "pool Initialize",
        ["v4", "Initialize", "Base"],
        `poolId=${shortAddr(poolId)} · ${shortAddr(currency0)} / ${shortAddr(
          currency1
        )} · pm=${shortAddr(String(r.address || ""))} · #${bn} · tx=${shortAddr(tx)}`
      );
      log(`Initialize c0=${shortAddr(currency0)} c1=${shortAddr(currency1)} #${bn}`);
      maybeCluster(tx, bn);
    },
    [log, maybeCluster, pushCard]
  );

  const onLock = useCallback(
    (r: Record<string, unknown>) => {
      const bn = r.blockNumber ? parseInt(String(r.blockNumber), 16) : 0;
      const tx = String(r.transactionHash || "");
      const topics = (r.topics as string[]) || [];
      const tokenish = unpadTopic(topics[1]) || unpadTopic(topics[2]);
      const rec = latchTx(tx);
      rec.lock = {
        address: String(r.address || "").toLowerCase(),
        tokenish,
      };
      pushCard(
        "lock / launch",
        ["lock", "permanent?", "placeholder-ABI"],
        `addr=${shortAddr(String(r.address || ""))} · hint=${shortAddr(
          tokenish || "?"
        )} · #${bn} · tx=${shortAddr(tx)}`
      );
      log(`Lock/launch @${shortAddr(String(r.address || ""))} #${bn}`);
      maybeCluster(tx, bn);
    },
    [log, maybeCluster, pushCard]
  );

  const onLogMsg = useCallback(
    (r: Record<string, unknown>) => {
      const key = `l:${r.transactionHash}:${r.logIndex}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const t0 = String(((r.topics as string[]) || [])[0] || "").toLowerCase();
      if (t0 === fields.current.topicInit.trim().toLowerCase()) return onInitialize(r);
      if (t0 === fields.current.topicLock.trim().toLowerCase()) return onLock(r);
    },
    [onInitialize, onLock]
  );

  const subscribeAll = useCallback(() => {
    saveFields();
    const pm = fields.current.poolManager.trim();
    const fac = fields.current.factory.trim();
    const ti = fields.current.topicInit.trim().toLowerCase();
    const tl = fields.current.topicLock.trim().toLowerCase();

    if (fields.current.subInit) {
      const filt: { topics: string[]; address?: string } = { topics: [ti] };
      if (isAddr(pm)) filt.address = pm.toLowerCase();
      send("eth_subscribe", ["logs", filt]);
      log(
        `eth_subscribe Initialize${
          isAddr(pm) ? " @ " + shortAddr(pm) : " (topic-wide)"
        } · chainId=${CHAIN_ID}`
      );
    }
    if (fields.current.subLock) {
      const filt: { topics: string[]; address?: string } = { topics: [tl] };
      if (isAddr(fac)) filt.address = fac.toLowerCase();
      send("eth_subscribe", ["logs", filt]);
      log(
        `eth_subscribe Lock/launch${
          isAddr(fac) ? " @ " + shortAddr(fac) : " (topic-wide — noisy)"
        }`
      );
    }
    setStatus("listening");
    setStatusDetail(`Listening · Base ${CHAIN_ID}`);
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
    byTx.current.clear();
  };

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
          OpenLaunch · Base one-tx launch listen
        </h1>
        <p className="text-base text-slate-600 sm:text-lg">
          Auto-starts on load. Listens for Uniswap v4 pool Initialize (+ optional lock) on Base
          via BlockReq public WSS using{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.95em]">eth_subscribe</code> logs only.
        </p>
        <p className="font-mono text-sm text-slate-500 break-all">
          {WSS} · HTTPS twin {HTTPS} · chainId {CHAIN_ID}
        </p>
        <div className="sweep-bar rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900">
          <span className="live-ticker">
            Live feel · local enter/highlight/pulse · beat {beat}s · base-rpc (not base-mainnet-rpc) ·&nbsp;
            Live feel · local enter/highlight/pulse · beat {beat}s · base-rpc (not base-mainnet-rpc) ·&nbsp;
          </span>
        </div>
      </header>

      <Card className="border-sky-200 bg-sky-50/60">
        <CardHeader className="pb-2">
          <CardTitle>Placeholder addresses / ABI</CardTitle>
          <CardDescription className="text-sky-900/80">
            Default PoolManager is the commonly cited Base Uniswap v4 address — confirm against live docs.
            Paste real <code>OPENLAUNCH_FACTORY</code> + lock topic when known.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-xs text-slate-700 whitespace-pre-wrap sm:text-sm">
{`// Placeholder ABI fragments — swap for live OpenLaunch / v4 when known
// PoolManager (Uniswap v4):
event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1,
                 uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick);
// topic0 = ${DEFAULT_INIT}
// OpenLaunch factory / lock: replace LOCK_TOPIC0 with real lock / full-supply event
// env stand-ins: OPENLAUNCH_FACTORY · POOL_MANAGER`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Defaults connect to public WSS · leave factory empty for topic-wide lock (noisier).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pm">POOL_MANAGER</Label>
            <Input id="pm" value={poolManager} onChange={(e) => setPoolManager(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="factory">OPENLAUNCH_FACTORY (optional)</Label>
            <Input
              id="factory"
              placeholder="0x… narrow lock / launch logs"
              value={factory}
              onChange={(e) => setFactory(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-5 text-base">
            <label className="inline-flex items-center gap-2.5">
              <input type="checkbox" checked={subInit} onChange={(e) => setSubInit(e.target.checked)} className="h-5 w-5" />
              Initialize
            </label>
            <label className="inline-flex items-center gap-2.5">
              <input type="checkbox" checked={subLock} onChange={(e) => setSubLock(e.target.checked)} className="h-5 w-5" />
              Lock / launch topic
            </label>
            <label className="inline-flex items-center gap-2.5">
              <input type="checkbox" checked={cluster} onChange={(e) => setCluster(e.target.checked)} className="h-5 w-5" />
              same-tx cluster
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ti">Initialize topic0</Label>
            <Input id="ti" value={topicInit} onChange={(e) => setTopicInit(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tl">Lock topic0 (placeholder)</Label>
            <Input id="tl" value={topicLock} onChange={(e) => setTopicLock(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={start} disabled={running}>
          Start listening
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
        <h2 className="text-lg font-bold text-slate-800">Launch feed</h2>
        <div className="max-h-[24rem] space-y-2.5 overflow-auto rounded-2xl border-2 bg-slate-950 p-4">
          {cards.length === 0 && (
            <p className="text-base text-slate-400">Waiting for events… demo cards appear first.</p>
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
        <h2 className="text-lg font-bold text-slate-800">Log</h2>
        <pre className="max-h-52 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-200 sm:text-sm">
          {logs.length ? logs.join("\n") : "—"}
        </pre>
      </section>
    </div>
  );
}
