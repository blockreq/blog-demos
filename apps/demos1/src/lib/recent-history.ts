import { useEffect, useState } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import {
  fetchPublicRecentLogs,
  shortAddr,
  unpadTopic,
  wordAddr,
  type JsonRpcLog,
  type RecentLogsResult,
} from "@blockreq/rpc";
import type { FeedEvent } from "../components/feed-types";

export type HistoryState = {
  status: "loading" | "ready" | "empty" | "error";
  events: FeedEvent[];
  reason: string;
  fromBlock?: number;
  toBlock?: number;
  windowBlocks?: number;
};

function emptyReason(
  locale: Locale,
  result: RecentLogsResult,
  kind: "ok-empty" | "error"
): string {
  if (kind === "ok-empty" && result.ok) {
    return t(locale, "history.emptyWindow").replace(
      "{n}",
      String(result.windowBlocks)
    );
  }
  if (!result.ok) {
    if (result.reason === "window") return t(locale, "history.errWindow");
    if (result.reason === "browser") return t(locale, "history.errBrowser");
    return t(locale, "history.errRpc");
  }
  return t(locale, "history.emptyWindow").replace("{n}", "900");
}

function logId(log: JsonRpcLog, i: number) {
  return `hist:${log.transactionHash || "x"}:${log.logIndex ?? i}`;
}

function bn(log: JsonRpcLog) {
  return log.blockNumber ? parseInt(String(log.blockNumber), 16) : 0;
}

/** Map PairCreated-style logs → feed rows (Anon / Equifold). */
export function mapPairCreatedLogs(
  logs: JsonRpcLog[],
  locale: Locale,
  chain: string,
  limit = 24
): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, limit).map((log, i) => {
    const topics = log.topics || [];
    const token0 = unpadTopic(topics[1]);
    const token1 = unpadTopic(topics[2]);
    const pair = wordAddr(log.data, 0) || String(log.address || "");
    const block = bn(log);
    return {
      id: logId(log, i),
      kind: locale === "zh" ? "历史开盘" : "Recent launch",
      tags: ["HIST", chain],
      title: shortAddr(pair),
      body: `${shortAddr(token0 || "?")} / ${shortAddr(token1 || "?")} · #${block}`,
      address: pair || undefined,
      block,
      tx: log.transactionHash,
      chain,
      at: now - i * 400,
    };
  });
}

/** Map Uniswap v4 Initialize logs → OpenLaunch rows. */
export function mapInitializeLogs(
  logs: JsonRpcLog[],
  locale: Locale,
  limit = 24
): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, limit).map((log, i) => {
    const topics = log.topics || [];
    const poolId = topics[1] || "";
    const currency0 = unpadTopic(topics[2]);
    const currency1 = unpadTopic(topics[3]);
    const block = bn(log);
    return {
      id: logId(log, i),
      kind: locale === "zh" ? "历史池开" : "Recent pool open",
      tags: ["HIST", "BASE"],
      title: shortAddr(poolId || String(log.address || "")),
      body: `${shortAddr(currency0 || "?")} / ${shortAddr(currency1 || "?")} · #${block}`,
      address: poolId || String(log.address || "") || undefined,
      block,
      tx: log.transactionHash,
      chain: "BASE",
      at: now - i * 400,
    };
  });
}

export function useRecentHistory(opts: {
  locale: Locale;
  https: string;
  address?: string;
  topics: (string | null | undefined)[];
  map: (logs: JsonRpcLog[]) => FeedEvent[];
  enabled?: boolean;
}): HistoryState {
  const { locale, https, address, topics, map, enabled = true } = opts;
  const [state, setState] = useState<HistoryState>({
    status: "loading",
    events: [],
    reason: "",
  });

  const topicKey = topics.map((t) => t || "").join("|");

  useEffect(() => {
    if (!enabled) {
      setState({ status: "empty", events: [], reason: t(locale, "history.disabled") });
      return;
    }
    const ac = new AbortController();
    setState({ status: "loading", events: [], reason: "" });
    (async () => {
      const result = await fetchPublicRecentLogs({
        https,
        address: address?.trim() || undefined,
        topics,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!result.ok) {
        setState({
          status: "error",
          events: [],
          reason: emptyReason(locale, result, "error"),
        });
        return;
      }
      const events = map(result.logs);
      if (events.length === 0) {
        setState({
          status: "empty",
          events: [],
          reason: emptyReason(locale, result, "ok-empty"),
          fromBlock: result.fromBlock,
          toBlock: result.toBlock,
          windowBlocks: result.windowBlocks,
        });
        return;
      }
      setState({
        status: "ready",
        events,
        reason: "",
        fromBlock: result.fromBlock,
        toBlock: result.toBlock,
        windowBlocks: result.windowBlocks,
      });
    })().catch((e) => {
      if (ac.signal.aborted) return;
      setState({
        status: "error",
        events: [],
        reason: e instanceof Error ? e.message : String(e),
      });
    });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is stable enough per call site; topicKey covers topics
  }, [locale, https, address, topicKey, enabled]);

  return state;
}


/** Map Pons TokenLaunched logs → feed rows. */
export function mapTokenLaunchedLogs(
  logs: JsonRpcLog[],
  locale: Locale,
  chain = "RH",
  limit = 24
): FeedEvent[] {
  const now = Date.now();
  return logs.slice(0, limit).map((log, i) => {
    const topics = log.topics || [];
    const token = unpadTopic(topics[1]);
    const curve = unpadTopic(topics[2]);
    const deployer = unpadTopic(topics[3]);
    const pairToken = wordAddr(log.data, 0);
    const block = bn(log);
    return {
      id: logId(log, i),
      kind: locale === "zh" ? "Pons 发射" : "Pons launch",
      tags: ["HIST", "PONS", chain],
      title: shortAddr(token),
      body: `${shortAddr(deployer || "?")} · curve ${shortAddr(curve || "?")} · #${block}`,
      address: token || undefined,
      block,
      tx: log.transactionHash,
      chain,
      at: now - i * 400,
      metric: pairToken ? shortAddr(pairToken) : undefined,
      metricLabel: "pair",
    };
  });
}
