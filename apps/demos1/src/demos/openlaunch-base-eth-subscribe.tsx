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
  type ConnStatus,
} from "@blockreq/ui";
import { PUBLIC_ENDPOINTS, isAddr, shortAddr, unpadTopic } from "@blockreq/rpc";
import { MonitorChrome } from "../components/monitor-chrome";
import { OpenWaitLayout } from "../components/layouts/open-wait-layout";
import type { FeedEvent } from "../components/feed-types";
import { EndpointBar } from "../components/endpoint-bar";
import { DemoHitsBanner } from "../components/demo-hits-panel";
import { buildOpenFixtures, useDemoHits } from "../lib/demo-hits";
import { getDemo } from "../catalog";

const EP = PUBLIC_ENDPOINTS.base;
const WSS = EP.wss;
const HTTPS = EP.https;
const CHAIN_ID = EP.chainIdHex;
const DEFAULT_INIT =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";
const DEFAULT_LOCK =
  "0xe9f76a8d85d1454b2ecdbf900a15a31155a945b0e7bf889f718773bf90a4c196";
const DEFAULT_PM = "0x498581ff718922c3f8e6a244956af099b2652b2b";
const LS = "blockreq.openlaunch-base.";
const SLUG = "openlaunch-base-eth-subscribe";

type TxRec = {
  init: { poolId: string; currency0: string; currency1: string; address: string } | null;
  lock: { address: string; tokenish: string } | null;
  clustered?: boolean;
};

function SettingsPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="space-y-3">{children}</div>;
}

export function OpenLaunchDemo({ locale }: { locale: Locale }) {
  const [poolManager, setPoolManager] = useState(DEFAULT_PM);
  const [factory, setFactory] = useState("");
  const [topicInit, setTopicInit] = useState(DEFAULT_INIT);
  const [topicLock, setTopicLock] = useState(DEFAULT_LOCK);
  const [subInit, setSubInit] = useState(true);
  const [subLock, setSubLock] = useState(true);
  const [cluster, setCluster] = useState(true);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [hasHit, setHasHit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const catalogDemoHits = !!getDemo(SLUG)?.demoHits;
  const { enabled: demoHits, setEnabled: setDemoHits } = useDemoHits({ catalogFlag: catalogDemoHits });

  const wsRef = useRef<WebSocket | null>(null);
  const wantRun = useRef(false);
  const nextId = useRef(1);
  const backoffMs = useRef(1000);
  const seen = useRef(new Set<string>());
  const byTx = useRef(new Map<string, TxRec>());
  const fields = useRef({
    poolManager,
    factory,
    topicInit,
    topicLock,
    subInit,
    subLock,
    cluster,
  });
  fields.current = {
    poolManager,
    factory,
    topicInit,
    topicLock,
    subInit,
    subLock,
    cluster,
  };

  const pushEvent = useCallback((ev: Omit<FeedEvent, "id" | "at">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: FeedEvent = { ...ev, id, at: Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 40));
    setHasHit(true);
  }, []);

  const injectDemoHits = useCallback(() => {
    const fixtures = buildOpenFixtures(locale, 3);
    for (const ev of fixtures) {
      setEvents((prev) => [ev, ...prev].slice(0, 40));
    }
    setHasHit(true);
  }, [locale]);

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
    } catch {
      /* ignore */
    }
  }, []);

  const saveFields = () => {
    try {
      localStorage.setItem(LS + "poolManager", fields.current.poolManager.trim());
      localStorage.setItem(LS + "factory", fields.current.factory.trim());
      localStorage.setItem(LS + "topicInit", fields.current.topicInit.trim());
      localStorage.setItem(LS + "topicLock", fields.current.topicLock.trim());
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
      pushEvent({
        kind: locale === "zh" ? "一笔开盘" : "One-shot open",
        tags: ["ONE-TX"],
        title: shortAddr(tx),
        body: `${shortAddr(i.currency0)} / ${shortAddr(i.currency1)} · #${bn}`,
        address: tx,
        block: bn,
        tx,
        chain: "BASE",
      });
    },
    [locale, pushEvent]
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
      pushEvent({
        kind: locale === "zh" ? "池子开了" : "Pool open",
        tags: ["BASE"],
        title: shortAddr(poolId),
        body: `${shortAddr(currency0)} / ${shortAddr(currency1)} · #${bn}`,
        address: poolId || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "BASE",
      });
      maybeCluster(tx, bn);
    },
    [locale, maybeCluster, pushEvent]
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
      pushEvent({
        kind: locale === "zh" ? "锁仓/开盘" : "Lock / launch",
        tags: ["LOCK"],
        title: shortAddr(String(r.address || "")),
        body: `${shortAddr(tokenish || "?")} · #${bn}`,
        address: String(r.address || "") || undefined,
        block: bn,
        tx: tx || undefined,
        chain: "BASE",
      });
      maybeCluster(tx, bn);
    },
    [locale, maybeCluster, pushEvent]
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
    }
    if (fields.current.subLock) {
      const filt: { topics: string[]; address?: string } = { topics: [tl] };
      if (isAddr(fac)) filt.address = fac.toLowerCase();
      send("eth_subscribe", ["logs", filt]);
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

  const running = status === "connecting" || status === "listening";
  const settings = (
    <div className="space-y-3">
      <EndpointBar locale={locale} wss={WSS} https={HTTPS} chainLabel={EP.label} />
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
              <Label htmlFor="pm">Pool manager</Label>
              <Input id="pm" value={poolManager} onChange={(e) => setPoolManager(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="factory">Factory (optional)</Label>
              <Input
                id="factory"
                placeholder="0x…"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subInit} onChange={(e) => setSubInit(e.target.checked)} className="h-4 w-4" />
                Pool open
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={subLock} onChange={(e) => setSubLock(e.target.checked)} className="h-4 w-4" />
                Lock / launch
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={cluster} onChange={(e) => setCluster(e.target.checked)} className="h-4 w-4" />
                Same-tx pair
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ti">Open topic0</Label>
              <Input id="ti" value={topicInit} onChange={(e) => setTopicInit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl">Lock topic0</Label>
              <Input id="tl" value={topicLock} onChange={(e) => setTopicLock(e.target.value)} />
            </div>
            <p className="break-all font-mono text-[11px] text-[var(--color-muted-foreground)]">
              {WSS} · {HTTPS} · {CHAIN_ID}
            </p>
          
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

          </CardContent>
        </Card>
      </SettingsPanel>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col pb-24" data-layout="open">
      <MonitorChrome
        locale={locale}
        title={t(locale, "openlaunch.title")}
        tag={t(locale, "openlaunch.tag")}
        status={status}
        hasHit={hasHit}
        slug={SLUG}
      />
      <OpenWaitLayout
        locale={locale}
        status={status}
        hasHit={hasHit}
        events={events}
        onStart={start}
        onStop={stop}
        running={running}
        connecting={status === "connecting"}
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
