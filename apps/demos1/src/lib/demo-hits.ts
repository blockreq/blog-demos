import { useCallback, useEffect, useState } from "react";
import { L, t, type Locale } from "@blockreq/i18n";
import { scrubDemoText, type FeedEvent } from "../components/feed-types";

function locList(locale: Locale, en: string[], zh: string[]): string[] {
  return en.map((e, i) => L(locale, e, zh[i] ?? e));
}


/** URL query / in-page toggle — default OFF. Catalog never auto-enables. */
export function readDemoHitsFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = new URLSearchParams(window.location.search).get("demoHits");
    return v === "1" || v === "true" || v === "yes";
  } catch {
    return false;
  }
}

export function writeDemoHitsToUrl(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (on) url.searchParams.set("demoHits", "1");
    else url.searchParams.delete("demoHits");
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* ignore */
  }
}

function rid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function fakeAddr(seed: string) {
  const hex = seed.replace(/[^a-f0-9]/gi, "").padEnd(40, "a").slice(0, 40);
  return `0x${hex}`;
}

/** Fixture payloads for 美工 flash/hit/columns checks (no DEMO/FIXTURE badge tags). */
export function buildAnonFixtures(locale: Locale, n = 4): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["New launch", "LP ready", "New launch", "New launch"], ["新开盘", "LP 到位", "新开盘", "新开盘"]);
  const syms = ["GHOSTX", "VOIDPEPE", "NEONANON", "SHADOW"];
  return Array.from({ length: n }, (_, i) => {
    const addr = fakeAddr(`anon${i}${syms[i % syms.length]}`);
    const lp = (12_400 + i * 860).toLocaleString();
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: i % 2 === 0 ? ["NEW", "ANON"] : ["LP"],
      title: short(addr),
      body: `${syms[i % syms.length]} · #${12_400_000 + i * 17}`,
      address: addr,
      block: 12_400_000 + i * 17,
      tx: fakeAddr(`txanon${i}`),
      chain: "RH",
      at: now - i * 1400,
      metric: `$${lp}`,
      metricLabel: "LP",
    };
  });
}

export function buildOpenFixtures(locale: Locale, n = 3): FeedEvent[] {
  const now = Date.now();
  const kind = L(locale, "One-shot launch", "一枪开盘");
  const names = ["PIXELMOON", "BASEBEAM", "OPENSHOT"];
  return Array.from({ length: n }, (_, i) => {
    const addr = fakeAddr(`open${i}${names[i % names.length]}`);
    const px = (0.00084 * (i + 1)).toFixed(5);
    const vol = (18_200 + i * 4_100).toLocaleString();
    return {
      id: rid(),
      kind,
      tags: ["HIT", "BASE"],
      title: names[i % names.length],
      body: `${short(addr)} · pool init+lock · #${28_900_000 + i * 9}`,
      address: addr,
      block: 28_900_000 + i * 9,
      tx: fakeAddr(`txopen${i}`),
      chain: "BASE",
      at: now - i * 2200,
      metric: `$${px}`,
      metricLabel: L(locale, "Price", "价格"),
      metric2: `$${vol}`,
      metric2Label: L(locale, "Volume", "成交额"),
    };
  });
}

export type EquiFixtureBundle = {
  coinLabel: string;
  coinAddr: string;
  events: FeedEvent[];
};

/** Idle seed branding — pinned header/columns on first paint. */
export const EQUI_IDLE_COIN_LABEL = "NEONCAT";
export const EQUI_IDLE_COIN_SEED = "neoncatbasecoin0001";

/** Simulated hit rename — must differ from idle so 美工 can demo idle→hit. */
export const EQUI_HIT_COIN_LABEL = "FORKBEAM";
export const EQUI_HIT_COIN_SEED = "forkbeambasecoin0001";

export function buildEquiFixtures(
  locale: Locale,
  mode: "idle" | "hit" = "hit"
): EquiFixtureBundle {
  const now = Date.now();
  const coinLabel = mode === "idle" ? EQUI_IDLE_COIN_LABEL : EQUI_HIT_COIN_LABEL;
  const coinAddr = fakeAddr(mode === "idle" ? EQUI_IDLE_COIN_SEED : EQUI_HIT_COIN_SEED);
  const markets = [
    { tag: "FIRST" as const, quote: "WETH", idx: 1 },
    { tag: "NEXT" as const, quote: "USDC", idx: 2 },
    { tag: "NEXT" as const, quote: "cbBTC", idx: 3 },
  ];
  const venues = ["UniV2", "Sushi", "BaseSwap"];
  const events: FeedEvent[] = markets.map((m, i) => {
    const market = fakeAddr(`eqmkt${i}${m.quote}`);
    const kind =
      m.tag === "FIRST"
        ? L(locale, "First market", "首个市场")
        : L(locale, "Next market", "又开一个");
    const tags =
      m.tag === "FIRST" ? ["FIRST"] : ["NEXT", `N=${m.idx}`, ...(m.idx >= 3 ? ["BURST"] : [])];
    const px = (0.00012 * (i + 1)).toFixed(5);
    const vol = (42_000 / (i + 1)).toFixed(0);
    return {
      id: rid(),
      kind,
      tags,
      title: `${coinLabel} / ${m.quote}`,
      body: `${venues[i % venues.length]} · $${px} · ${short(market)} · #${28_910_000 + i * 3}`,
      address: market,
      block: 28_910_000 + i * 3,
      tx: fakeAddr(`txequi${i}`),
      chain: "BASE",
      at: now - i * 900,
      metric: `$${px}`,
      metricLabel: L(locale, "Price", "价格"),
      metric2: `$${Number(vol).toLocaleString()}`,
      metric2Label: L(locale, "Vol", "量"),
    };
  });
  return { coinLabel, coinAddr, events };
}


export function buildStockFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["pair landed", "first LP", "pair landed", "paired asset", "paired open cluster"], ["币股配对开盘", "首次 LP", "币股配对开盘", "配对资产", "开盘簇"]);
  const syms = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN"];
  return Array.from({ length: n }, (_, i) => {
    const addr = fakeAddr(`stock${i}${syms[i % syms.length]}`);
    const meme = fakeAddr(`meme${i}${syms[i % syms.length]}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: i % 2 === 0 ? ["STOCK", "PAIR"] : ["LP", "STOCK"],
      title: short(addr),
      body: `${syms[i % syms.length]} ↔ ${short(meme)} · #${12_500_000 + i * 11}`,
      address: addr,
      block: 12_500_000 + i * 11,
      tx: fakeAddr(`txstock${i}`),
      chain: "RH",
      at: now - i * 1600,
      metric: syms[i % syms.length],
      metricLabel: L(locale, "Stock", "股票"),
    };
  });
}

export function buildPonsFixtures(locale: Locale, n = 4): FeedEvent[] {
  const now = Date.now();
  const kind = L(locale, "Pons launch", "Pons 发射");
  const names = ["PONCAT", "CURVEPEPE", "GRADX", "LAUNCHY"];
  return Array.from({ length: n }, (_, i) => {
    const addr = fakeAddr(`pons${i}${names[i % names.length]}`);
    const curve = fakeAddr(`curve${i}`);
    return {
      id: rid(),
      kind: i === 1 ? L(locale, "Pons graduated", "Pons 毕业") : kind,
      tags: i === 1 ? ["GRAD", "PONS"] : ["NEW", "PONS"],
      title: names[i % names.length],
      body: `${short(addr)} · curve ${short(curve)} · #${12_600_000 + i * 13}`,
      address: addr,
      block: 12_600_000 + i * 13,
      tx: fakeAddr(`txpons${i}`),
      chain: "RH",
      at: now - i * 2100,
      metric: short(curve),
      metricLabel: "curve",
      metric2: `#${12_600_000 + i * 13}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

function short(a: string) {
  if (!a || a.length < 10) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Opt-in demo/fixture mode. Default off in production.
 * Enables only via `?demoHits=1` (or the in-page toggle, which writes that query).
 * Catalog `demoHits` is never an auto-enable — 美工-only, never first paint.
 */
export function useDemoHits(_opts?: { catalogFlag?: boolean }) {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    setEnabledState(readDemoHitsFromUrl());
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    writeDemoHitsToUrl(on);
  }, []);

  return { enabled, setEnabled };
}

export function buildRhV4DirectFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kind = L(locale, "V4 direct open", "V4 直开");
  const names = ["RHDIRECT", "POOLNOW", "NOBOND", "V4FLASH", "INITX"];
  return Array.from({ length: n }, (_, i) => {
    const poolId = fakeAddr(`rhv4${i}${names[i % names.length]}`);
    const c0 = fakeAddr(`c0rh${i}`);
    const c1 = fakeAddr(`c1rh${i}`);
    return {
      id: rid(),
      kind: i === 2 ? L(locale, "Liquidity in", "流动性到位") : kind,
      tags: i === 2 ? ["LP", "V4", "DIRECT"] : ["NEW", "V4", "DIRECT"],
      title: names[i % names.length],
      body: `${short(c0)} / ${short(c1)} · pool ${short(poolId)} · #${12_700_000 + i * 19}`,
      address: poolId,
      block: 12_700_000 + i * 19,
      tx: fakeAddr(`txrhv4${i}`),
      chain: "RH",
      at: now - i * 1800,
      metric: short(poolId),
      metricLabel: "poolId",
      metric2: `#${12_700_000 + i * 19}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

export function buildBaseSpikeFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["Factory create", "Launch spike", "Factory create", "Early swap dens", "Launch spike"], ["工厂开盘", "开盘尖刺", "工厂开盘", "早期换手密", "开盘尖刺"]);
  const names = ["SPIKEX", "BASEBURST", "DENSECAT", "OPENFAST", "TIPPY"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`spike${i}${names[i % names.length]}`);
    const swaps = 4 + i * 3;
    const spike = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: spike ? ["SPIKE", "BASE"] : ["NEW", "BASE"],
      title: names[i % names.length],
      body: `${short(pair)} · swaps ${swaps}/window · #${28_920_000 + i * 7}`,
      address: pair,
      block: 28_920_000 + i * 7,
      tx: fakeAddr(`txspike${i}`),
      chain: "BASE",
      at: now - i * 1500,
      metric: String(swaps),
      metricLabel: L(locale, "Early swaps", "早期换手"),
      metric2: spike ? (L(locale, "SPIKE", "尖刺")) : (L(locale, "OPEN", "开盘")),
      metric2Label: L(locale, "Signal", "信号"),
    };
  });
}

export function buildBasketFixtures(locale: Locale, n = 4): FeedEvent[] {
  const now = Date.now();
  const kind = L(locale, "Basket created", "篮筐创建");
  const baskets = [
    { name: "Tech Trio", symbol: "TRIO", comps: "TSLA+AMZN+NFLX" },
    { name: "Mega Cap", symbol: "MEGA", comps: "AAPL+MSFT+GOOG" },
    { name: "AI Stack", symbol: "AISTK", comps: "NVDA+AMD+AVGO" },
    { name: "Consumer", symbol: "CONS", comps: "COST+WMT+TGT" },
  ];
  return Array.from({ length: n }, (_, i) => {
    const b = baskets[i % baskets.length];
    const addr = fakeAddr(`basket${i}${b.symbol}`);
    return {
      id: rid(),
      kind,
      tags: ["NEW", "BASKET", "RH"],
      title: `${b.symbol} · ${b.name}`,
      body: `components ${b.comps} · ${short(addr)} · #${12_800_000 + i * 15}`,
      address: addr,
      block: 12_800_000 + i * 15,
      tx: fakeAddr(`txbasket${i}`),
      chain: "RH",
      at: now - i * 1900,
      metric: b.symbol,
      metricLabel: L(locale, "Symbol", "符号"),
      metric2: b.comps,
      metric2Label: L(locale, "Components", "成分"),
    };
  });
}

export function buildLongEcoFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["eco pair landed", "eco pair landed", "first LP", "eco pair", "eco open cluster"], ["生态配对开盘", "生态配对开盘", "首次 LP", "生态配对", "开盘簇"]);
  const ecos = ["USDC", "WETH", "LONG", "RHUSD", "cbBTC"];
  return Array.from({ length: n }, (_, i) => {
    const eco = fakeAddr(`eco${i}${ecos[i % ecos.length]}`);
    const meme = fakeAddr(`memeeeco${i}${ecos[i % ecos.length]}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: i % 3 === 2 ? ["LP", "ECO"] : ["ECO", "PAIR"],
      title: short(meme),
      body: `${ecos[i % ecos.length]} ↔ ${short(meme)} · #${12_810_000 + i * 11}`,
      address: meme,
      block: 12_810_000 + i * 11,
      tx: fakeAddr(`txeco${i}`),
      chain: "RH",
      at: now - i * 1700,
      metric: ecos[i % ecos.length],
      metricLabel: L(locale, "ecoSide", "生态侧"),
      metric2: short(meme),
      metric2Label: L(locale, "memeSide", "meme侧"),
    };
  });
}


export function buildArcDay1Fixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["Factory PairCreated", "Early Swap density", "Factory PairCreated", "Early Swap density", "Factory PairCreated"], ["Factory PairCreated", "早期 Swap 密度", "Factory PairCreated", "早期 Swap 密度", "Factory PairCreated"]);
  const names = ["ARCPAD", "DAY1X", "OPENARC", "PAIRNOW", "DENSARC"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`arc${i}${names[i % names.length]}`);
    const dens = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: dens ? ["DENS", "ARC"] : ["NEW", "ARC", "DAY1"],
      title: names[i % names.length],
      body: `${short(pair)} · #${1_000_000 + i * 9}`,
      address: pair,
      block: 1_000_000 + i * 9,
      tx: fakeAddr(`txarc${i}`),
      chain: "ARC",
      at: now - i * 1600,
      metric: dens ? String(3 + i) : short(pair),
      metricLabel: dens ? (L(locale, "Early swaps", "早期换手")) : "pair",
      metric2: dens ? "DENS" : "OPEN",
      metric2Label: L(locale, "Signal", "信号"),
    };
  });
}

export function buildBaseStockSwapFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kind = L(locale, "Stock big print", "股币大单");
  const syms = ["AAPL", "TSLA", "NVDA", "MSFT", "COIN"];
  const venues = ["V2", "V3", "V2", "V3", "V2"];
  return Array.from({ length: n }, (_, i) => {
    const pool = fakeAddr(`bsswap${i}${syms[i % syms.length]}`);
    const size = (250_000 + i * 80_000).toLocaleString();
    return {
      id: rid(),
      kind,
      tags: ["BIG", "BASE", venues[i % venues.length], syms[i % syms.length]],
      title: `${syms[i % syms.length]} · ${venues[i % venues.length]}`,
      body: `chain=base · venue=${venues[i % venues.length]} · print $${size} · pool ${short(pool)} · #${28_930_000 + i * 5}`,
      address: pool,
      block: 28_930_000 + i * 5,
      tx: fakeAddr(`txbsswap${i}`),
      chain: "BASE",
      at: now - i * 1400,
      metric: `$${size}`,
      metricLabel: L(locale, "Print", "大单"),
      metric2: venues[i % venues.length],
      metric2Label: "venue",
    };
  });
}

export function buildAnyQuoteFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["any-quote Initialize", "any-quote PairCreated", "any-quote Initialize", "any-quote PairCreated", "any-quote Initialize"], ["任意报价 Initialize", "任意报价 PairCreated", "任意报价 Initialize", "任意报价 PairCreated", "任意报价 Initialize"]);
  const quotes = ["USDC", "WETH", "RHUSD", "cbBTC", "USDC"];
  return Array.from({ length: n }, (_, i) => {
    const launch = fakeAddr(`aqlaunch${i}${quotes[i % quotes.length]}`);
    const quote = fakeAddr(`aqquote${i}${quotes[i % quotes.length]}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: ["ANYQUOTE", "RH", quotes[i % quotes.length]],
      title: short(launch),
      body: `path=any-quote · quoteSide ${quotes[i % quotes.length]} ${short(quote)} · launchSide ${short(launch)} · #${12_820_000 + i * 13}`,
      address: launch,
      block: 12_820_000 + i * 13,
      tx: fakeAddr(`txaq${i}`),
      chain: "RH",
      at: now - i * 1700,
      metric: quotes[i % quotes.length],
      metricLabel: L(locale, "quoteSide", "报价侧"),
      metric2: short(launch),
      metric2Label: L(locale, "launchSide", "发射侧"),
    };
  });
}


export function buildPumpCustomPairFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["Create", "CustomPair", "Create", "PumpSwap graduated", "CustomPair"], ["Create", "CustomPair", "Create", "PumpSwap 毕业", "CustomPair"]);
  const quotes = [
    { tag: "WSOL", mint: "So11111111111111111111111111111111111111112" },
    { tag: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
    { tag: "NVDA.x", mint: "XstkNVDAsampleMint111111111111111111111111" },
    { tag: "TSLA.x", mint: "XstkTSLAsampleMint111111111111111111111111" },
    { tag: "Sunrise", mint: "SunrisesampleMint1111111111111111111111111" },
  ];
  return Array.from({ length: n }, (_, i) => {
    const q = quotes[i % quotes.length];
    const base = fakeAddr(`pumpbase${i}${q.tag}`).replace("0x", "BaseMint");
    const baseMint = (base + "111111111111111111111111111").slice(0, 44);
    const sig = `SigPump${i}${q.tag}${"1".repeat(40)}`.slice(0, 64);
    const grad = i === 3;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: grad
        ? ["GRAD", "PUMPSWAP"]
        : i % 2 === 1
          ? ["CUSTOM", "PUMP", q.tag]
          : ["CREATE", "PUMP", q.tag],
      title: short(baseMint),
      body: `pad pump-custom-pair · base ${short(baseMint)} · quote ${q.tag} ${short(q.mint)} · slot ${250_000_000 + i * 17}`,
      address: baseMint,
      block: 250_000_000 + i * 17,
      tx: sig,
      chain: "SOL",
      at: now - i * 1500,
      metric: q.tag,
      metricLabel: "quoteTag",
      metric2: short(q.mint),
      metric2Label: "quoteMint",
    };
  });
}

export function buildMonadO1Fixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["Factory PairCreated", "Early Swap density", "Factory PairCreated", "Early Swap density", "Factory PairCreated"], ["Factory PairCreated", "早期 Swap 密度", "Factory PairCreated", "早期 Swap 密度", "Factory PairCreated"]);
  const names = ["O1PAD", "DAY0X", "MONADOPEN", "PAIRO1", "DENSO1"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`monado1${i}${names[i % names.length]}`);
    const dens = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: dens ? ["DENS", "MONAD", "O1"] : ["NEW", "MONAD", "O1", "DAY0"],
      title: names[i % names.length],
      body: `pad monad-o1 · ${short(pair)} · #${143_000 + i * 9}`,
      address: pair,
      block: 143_000 + i * 9,
      tx: fakeAddr(`txmonado1${i}`),
      chain: "MONAD",
      at: now - i * 1600,
      metric: dens ? String(3 + i) : short(pair),
      metricLabel: dens ? (L(locale, "Early swaps", "早期换手")) : "pair",
      metric2: dens ? "DENS" : "OPEN",
      metric2Label: L(locale, "Signal", "信号"),
    };
  });
}


function shortSol(a: string) {
  if (!a || a.length < 10) return a || "—";
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

/** Changelog filter fixtures — filtered log rows + upgrade-window alert chips. */
export function buildChangelogFilterFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const programs = [
    { id: "BPFLoaderUpgradeab1e11111111111111111111111", tag: "BPF-UPG" },
    { id: "Config1111111111111111111111111111111111111", tag: "CONFIG" },
    { id: "Vote111111111111111111111111111111111111111", tag: "VOTE" },
    { id: "Stake11111111111111111111111111111111111111", tag: "STAKE" },
    { id: "AddressLookupTab1e1111111111111111111111111", tag: "ALT" },
  ];
  const filters = ["upgrade", "setAuthority", "deploy", "extendProgram", "close"];
  const upgradeTags = ["v2.1-window", "v2.2-window", "agave-v3", "v2.1-window", "hotfix"];
  const kinds =
    locList(locale, ["Filter hit", "Upgrade-window alert", "Filter hit", "Upgrade-window alert", "Filter hit"], ["Filter 命中", "升级窗告警", "Filter 命中", "升级窗告警", "Filter 命中"]);
  return Array.from({ length: n }, (_, i) => {
    const p = programs[i % programs.length];
    const fk = filters[i % filters.length];
    const ut = upgradeTags[i % upgradeTags.length];
    const alert = i % 2 === 1;
    const sig = `SigChg${i}${fk}${"1".repeat(40)}`.slice(0, 64);
    const slot = 310_000_000 + i * 23;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: alert
        ? ["UPGRADE", "ALERT", ut]
        : ["FILTER", "CHANGELOG", fk],
      title: shortSol(p.id),
      body: `pad changelog-filter · program ${p.tag} ${shortSol(p.id)} · filterKey ${fk} · upgradeTag ${ut} · sig ${shortSol(sig)} · slot ${slot}`,
      address: p.id,
      block: slot,
      tx: sig,
      chain: "SOL",
      at: now - i * 1600,
      metric: fk,
      metricLabel: "filterKey",
      metric2: ut,
      metric2Label: "upgradeTag",
    };
  });
}

/** Agave RPC compat watch fixtures — tip/slot rows + pre/post diff chips + checklist. */
export function buildAgaveCompatFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const releases = ["v2.1.0", "v2.1.11", "v2.2.0", "v3.0.0-rc", "v2.1.21"];
  const diffs = ["logs+ok", "pre≠post", "fp-match", "sub-lag", "capabilityΔ"];
  const kinds =
    locList(locale, ["tip/slot probe", "pre/post diff", "tip/slot probe", "sub healthy", "compat checklist"], ["tip/slot 探针", "pre/post 差", "tip/slot 探针", "sub 健康", "兼容清单"]);
  return Array.from({ length: n }, (_, i) => {
    const releaseTag = releases[i % releases.length];
    const tipSlot = 312_500_000 + i * 41;
    const programDiff = diffs[i % diffs.length];
    const subLag = `${40 + i * 12}ms`;
    const checks =
      i % 2 === 0
        ? "nodeCapability·tipAligned·subHealthy"
        : "tipAligned·programDiffReady";
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: i % 2 === 1 ? ["DIFF", "AGAVE", releaseTag] : ["PROBE", "AGAVE", releaseTag],
      title: releaseTag,
      body: `pad agave-compat · releaseTag ${releaseTag} · tipSlot ${tipSlot} · programDiff ${programDiff} · subLag ${subLag} · checks ${checks}`,
      address: `AgaveProg${i}${"1".repeat(40)}`.slice(0, 44),
      block: tipSlot,
      tx: `SigAgave${i}${"2".repeat(40)}`.slice(0, 64),
      chain: "SOL",
      at: now - i * 1800,
      metric: String(tipSlot),
      metricLabel: "tipSlot",
      metric2: programDiff,
      metric2Label: "programDiff",
    };
  });
}


export function buildBrewDoublePairFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["Twin progress", "Twin ready", "Twin progress", "Twin ready", "Twin progress"], ["双池进度", "双池齐听 twinReady", "双池进度", "双池齐听 twinReady", "双池进度"]);
  const names = ["BREW1", "CAPX", "TWINBNB", "POOLY", "DBLP"];
  return Array.from({ length: n }, (_, i) => {
    const token = fakeAddr(`brewtok${i}${names[i % names.length]}`);
    const poolA = fakeAddr(`brewpa${i}`);
    const poolB = fakeAddr(`brewpb${i}`);
    const twin = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: twin
        ? ["TWIN", "READY", "BREW", "BSC"]
        : ["PART", "BREW", "BSC"],
      title: names[i % names.length],
      body: twin
        ? `pad brew-double-pair · launchId ${short(token)} · capUsd $69000 · poolA ${short(poolA)} · poolB ${short(poolB)} · #${60_000_000 + i * 11}`
        : `pad brew-double-pair · launch ${short(token)} · pools 1/2 · cap $69000 · ${short(poolA)} · #${60_000_000 + i * 11}`,
      address: token,
      block: 60_000_000 + i * 11,
      tx: fakeAddr(`txbrew${i}`),
      chain: "BSC",
      at: now - i * 1500,
      metric: twin ? "twinReady" : "1/2",
      metricLabel: twin ? (L(locale, "Twin", "双池齐")) : (L(locale, "Pools", "池进度")),
      metric2: "$69000",
      metric2Label: "CAP_USD",
    };
  });
}

export function buildArbRwaFlowFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["mint", "transfer", "pair", "mint", "transfer"], ["mint 铸币", "Transfer", "PairCreated 开池", "mint 铸币", "Transfer"]);
  const syms = ["USDY", "USDC", "BUIDL", "USDT", "USDY"];
  const kindTags = ["MINT", "TRANSFER", "PAIR", "MINT", "TRANSFER"];
  return Array.from({ length: n }, (_, i) => {
    const token = fakeAddr(`arbrwa${i}${syms[i % syms.length]}`);
    const pair = fakeAddr(`arbpair${i}`);
    const kind = kindTags[i % kindTags.length];
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: [kind, "RWA", "ARB", syms[i % syms.length]],
      title: syms[i % syms.length],
      body:
        kind === "PAIR"
          ? `pad rwa-flow · kind=pair · ${short(token)}/USDC · pair ${short(pair)} · #${250_000_000 + i * 13}`
          : `pad rwa-flow · kind=${kind.toLowerCase()} · token ${syms[i % syms.length]} ${short(token)} · amt ${(10 + i * 3).toFixed(1)}K · #${250_000_000 + i * 13}`,
      address: kind === "PAIR" ? pair : token,
      block: 250_000_000 + i * 13,
      tx: fakeAddr(`txarbrwa${i}`),
      chain: "ARB",
      at: now - i * 1400,
      metric: kind === "PAIR" ? short(pair) : `${10 + i * 3}K`,
      metricLabel: kind === "PAIR" ? "pair" : (L(locale, "Amount", "数量")),
      metric2: kind.toLowerCase(),
      metric2Label: "kind",
    };
  });
}

export function buildCronosLaunchpadFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["Pool open", "First liquidity", "Pool open", "Early transfer", "First liquidity"], ["池子开了", "首流动性", "池子开了", "早期转账", "首流动性"]);
  const names = ["CROAPP", "PADX", "LAUNCHY", "MINT1", "XFERY"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`cro${i}${names[i % names.length]}`);
    const first = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: first
        ? ["FIRST", "MINT", "CRO", "LAUNCHPAD", "pad:app-launchpad"]
        : ["NEW", "CRO", "LAUNCHPAD", "pad:app-launchpad"],
      title: names[i % names.length],
      body: `pad:app-launchpad · pair ${short(pair)} · amount0 ${(i + 1) * 1000} · amount1 ${(i + 1) * 50} · #${22_000_000 + i * 11}`,
      address: pair,
      block: 22_000_000 + i * 11,
      tx: fakeAddr(`txcro${i}`),
      chain: "CRO",
      at: now - i * 1600,
      metric: String((i + 1) * 1000),
      metricLabel: "amount0",
      metric2: String((i + 1) * 50),
      metric2Label: "amount1",
    };
  });
}

export function buildEthV4StablePairFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["swap", "peg drift", "fee", "lp", "swap"], ["Swap", "peg 偏离", "费率", "LP 变动", "Swap"]);
  const kindTags = ["swap", "peg", "fee", "lp", "swap"];
  const pools = ["USDC/USDT", "USDC/USDG", "USDC/USDT", "USDC/USDG", "USDC/USDT"];
  return Array.from({ length: n }, (_, i) => {
    const poolId = fakeAddr(`ethv4sp${i}${pools[i % pools.length]}`);
    const peg = 12 + i * 17;
    const fee = 100 + i * 25;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: ["V4", "STABLEPAIR", "ETH", `kind:${kindTags[i % kindTags.length]}`, "pad:stablepair-hook"],
      title: pools[i % pools.length],
      body: `pad:stablepair-hook · kind=${kindTags[i % kindTags.length]} · poolId ${short(poolId)} · pegBps ${peg} · fee ${fee} · #${23_500_000 + i * 9}`,
      address: poolId,
      block: 23_500_000 + i * 9,
      tx: fakeAddr(`txethsp${i}`),
      chain: "ETH",
      at: now - i * 1700,
      metric: String(peg),
      metricLabel: "pegBps",
      metric2: kindTags[i % kindTags.length] === "lp" ? String(1_000_000 * (i + 1)) : String(fee),
      metric2Label: kindTags[i % kindTags.length] === "lp" ? "liquidityDelta" : "fee",
    };
  });
}

export function buildBaseLaptopFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["firstMint", "swapBurst", "holderConc", "thinExit", "firstMint"], ["首池 Mint", "换手簇", "持仓集中", "薄 LP 退出", "首池 Mint"]);
  const kindTags = ["firstMint", "swapBurst", "holderConc", "thinExit", "firstMint"];
  const names = ["LAPTOP", "LPT1", "SNIPX", "THINLP", "BURST"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`laptop${i}${names[i % names.length]}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: ["BASE", "LAPTOP", `kind:${kindTags[i % kindTags.length]}`, "pad:laptop-liq"],
      title: names[i % names.length],
      body: `pad:laptop-liq · kind=${kindTags[i % kindTags.length]} · pair ${short(pair)} · #${29_100_000 + i * 7}`,
      address: pair,
      block: 29_100_000 + i * 7,
      tx: fakeAddr(`txlaptop${i}`),
      chain: "BASE",
      at: now - i * 1400,
      metric: kindTags[i % kindTags.length] === "holderConc" ? "42%" : String(4 + i * 2),
      metricLabel: kindTags[i % kindTags.length] === "holderConc" ? (L(locale, "top share", "顶仓占比")) : (L(locale, "signal", "信号")),
      metric2: kindTags[i % kindTags.length],
      metric2Label: "kind",
    };
  });
}

export function buildMultiplrLeverageFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["Leverage open", "Curve print", "V3 graduate", "ETH2x transfer burst", "Leverage open"], ["杠杆开池", "曲线早打印", "V3 毕业", "ETH2x 转账爆发", "杠杆开池"]);
  const tagsList = [
    ["NEW", "LAUNCH"],
    ["TRADE", "CURVE"],
    ["V3", "GRAD"],
    ["XFER", "BURST"],
    ["NEW", "LAUNCH"],
  ];
  const names = ["ETH2X", "MPLR", "LEVX", "FLIQ", "OPEN"];
  return Array.from({ length: n }, (_, i) => {
    const token = fakeAddr(`mplr${i}${names[i % names.length]}`);
    const quote = "0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd";
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: ["ETH", "MULTIPLR", "LEVERAGE", "pad:multiplr-leverage", ...tagsList[i % tagsList.length]],
      title: names[i % names.length],
      body: `pad:multiplr-leverage · token ${short(token)} · quote ${short(quote)} · creator ${short(fakeAddr("creator" + i))} · launchTx ${short(fakeAddr("txmplr" + i))} · #${23_600_000 + i * 11}`,
      address: token,
      block: 23_600_000 + i * 11,
      tx: fakeAddr(`txmplr${i}`),
      chain: "ETH",
      at: now - i * 1500,
      metric: short(quote),
      metricLabel: "quote",
      metric2: `#${23_600_000 + i * 11}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

export function buildHarmonicRhcFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locList(locale, ["Pons launch", "HARMONIC launch hit", "Hookr launch", "V4 Initialize", "Pons launch"], ["Pons 发射", "HARMONIC 命中发射", "Hookr 发射", "V4 Initialize", "Pons 发射"]);
  const tagsList = [
    ["PONS", "LAUNCH", "pad:pons-v2"],
    ["HARMONIC", "HIT", "LAUNCH", "pad:pons-v2"],
    ["HOOKR", "LAUNCH", "pad:hookr"],
    ["V4", "INIT", "pad:v4-init"],
    ["PONS", "LAUNCH", "pad:pons-v2"],
  ];
  const names = ["HRMNC", "AGENTX", "HOOKY", "V4OPEN", "PONCAT"];
  return Array.from({ length: n }, (_, i) => {
    const token = fakeAddr(`harm${i}${names[i % names.length]}`);
    const curve = fakeAddr(`curve${i}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: ["RH", "HARMONIC", "AGENT", ...tagsList[i % tagsList.length]],
      title: names[i % names.length],
      body: `pad:${tagsList[i % tagsList.length].find((t) => t.startsWith("pad:"))?.slice(4) || "pons-v2"} · token ${short(token)} · curve ${short(curve)} · deployer ${short(fakeAddr("dep" + i))} · launchTx ${short(fakeAddr("txharm" + i))} · #${12_800_000 + i * 17}`,
      address: token,
      block: 12_800_000 + i * 17,
      tx: fakeAddr(`txharm${i}`),
      chain: "RH",
      at: now - i * 1600,
      metric: short(curve),
      metricLabel: "curve",
      metric2: `#${12_800_000 + i * 17}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

export function buildLongshotFootballFixtures(locale: Locale, n = 6): FeedEvent[] {
  const now = Date.now();
  const kindsZh = ["开市", "成交", "结算", "开市", "成交", "结算"];
  const kindsEn = ["create", "trade", "resolve", "create", "trade", "resolve"];
  const kindKeys = ["create", "trade", "resolve", "create", "trade", "resolve"] as const;
  const leagues = ["EPL", "LaLiga", "UCL", "SerieA", "Bundesliga", "EPL"];
  const names = ["ARS-MCI", "RMA-BAR", "INT-MIL", "BAY-DOR", "PSG-OL", "LIV-CHE"];
  return Array.from({ length: n }, (_, i) => {
    const marketId = fakeAddr(`lsfb${i}${names[i % names.length]}`);
    const kind = kindKeys[i % kindKeys.length];
    return {
      id: rid(),
      kind: L(locale, kindsEn[i % kindsEn.length], kindsZh[i % kindsZh.length]),
      tags: [
        "BASE",
        "LONGSHOT",
        "FOOTBALL",
        `kind:${kind}`,
        "pad:longshot-football",
        leagues[i % leagues.length],
      ],
      title: names[i % names.length],
      body: `pad:longshot-football · kind=${kind} · marketId ${short(marketId)} · tx ${short(fakeAddr("txls" + i))} · #${29_200_000 + i * 9}`,
      address: marketId,
      block: 29_200_000 + i * 9,
      tx: fakeAddr(`txls${i}`),
      chain: "BASE",
      at: now - i * 1300,
      metric: kind,
      metricLabel: "kind",
      metric2: `#${29_200_000 + i * 9}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

export function buildCompanypadRhcFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const tickers = ["NVDA", "AAPL", "TSLA", "META", "MSFT"];
  const markets = [
    "0x094cA423757D96B5334AF5D5386a2105a8B3fCE1",
    fakeAddr("cpmkt1"),
    fakeAddr("cpmkt2"),
    fakeAddr("cpmkt3"),
    fakeAddr("cpmkt4"),
  ];
  return Array.from({ length: n }, (_, i) => {
    const ticker = tickers[i % tickers.length];
    const market = markets[i % markets.length];
    const metricId = String(1000 + i);
    return {
      id: rid(),
      kind: "Launched",
      tags: ["RH", "COMPANYPAD", "LAUNCHED", "pad:companypad", "RADAR"],
      title: ticker,
      body: `pad:companypad · ticker ${ticker} · metricId ${metricId} · market ${short(market)} · creator ${short(fakeAddr("cpcr" + i))} · curve ${short(fakeAddr("cpcurve" + i))} · #${4_660_000 + i * 11}`,
      address: market.toLowerCase(),
      block: 4_660_000 + i * 11,
      tx: fakeAddr(`txcp${i}`),
      chain: "RH",
      at: now - i * 1200,
      metric: metricId,
      metricLabel: "metricId",
      metric2: `#${4_660_000 + i * 11}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}

export function buildBucketRhcFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const tokens = [
    "0x2d2e5cb9319c3b893db80eb6f9e2cea386720cf9",
    "0xbd305151d3d7eb612d3969e9fa05315cd47374e4",
    fakeAddr("bktok2"),
    fakeAddr("bktok3"),
    fakeAddr("bktok4"),
  ];
  const labels = ["BHC", "INFINITY", "NEW", "NEW", "NEW"];
  return Array.from({ length: n }, (_, i) => {
    const token = tokens[i % tokens.length];
    const label = labels[i % labels.length];
    const founding = i === 0;
    return {
      id: rid(),
      kind: "Launched",
      tags: [
        "RH",
        "BUCKET",
        "LAUNCHED",
        "pad:bucket",
        founding ? "FOUNDING" : "STD",
        "RADAR",
      ],
      title: label === "NEW" ? short(token) : label,
      body: `pad:bucket · token ${short(token)} · creator ${short(fakeAddr("bkcr" + i))} · curve ${short(fakeAddr("bkcurve" + i))} · tierId ${i} · id ${100 + i} · founding ${founding ? "yes" : "no"} · #${4_670_000 + i * 13}`,
      address: token.toLowerCase(),
      block: 4_670_000 + i * 13,
      tx: fakeAddr(`txbk${i}`),
      chain: "RH",
      at: now - i * 1200,
      metric: founding ? "FOUNDING" : String(100 + i),
      metricLabel: founding ? "founding" : "id",
      metric2: `#${4_670_000 + i * 13}`,
      metric2Label: L(locale, "Block", "区块"),
    };
  });
}


export function buildCrossrateRhcFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const dubai = "0xd63a5E75412CC82d5aA68CD390578e993a2d4c4f";
  const aed = "0x8998b43B5450D41B88E67a0914064b8F8445126D";
  const usdg = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
  const tokens = [dubai, fakeAddr("crtok1"), fakeAddr("crtok2"), fakeAddr("crtok3"), fakeAddr("crtok4")];
  const quotes = [aed, aed, usdg, aed, usdg];
  const codes = ["AED", "AED", "USDG", "AED", "USDG"];
  return Array.from({ length: n }, (_, i) => {
    const token = tokens[i % tokens.length];
    const quote = quotes[i % quotes.length];
    const currency = codes[i % codes.length];
    const taxBps = String(100 + i * 25);
    return {
      id: rid(),
      kind: "TokenLaunched",
      tags: ["RH", "CROSSRATE", "TOKENLAUNCHED", "pad:crossrate", currency, "FX", "RADAR"],
      title: currency,
      body: `pad:crossrate · currency ${currency} · token ${short(token)} · creator ${short(fakeAddr("crcr" + i))} · quoteToken ${short(quote)} · poolId ${short(fakeAddr("crpool" + i))} · taxBps ${taxBps} · supply ${String(1_000_000_000n + BigInt(i))} · liquidity ${String(50_000n + BigInt(i * 100))} · #${4_680_000 + i * 17}`,
      address: token.toLowerCase(),
      block: 4_680_000 + i * 17,
      tx: fakeAddr(`txcr${i}`),
      chain: "RH",
      at: now - i * 1200,
      metric: currency,
      metricLabel: L(locale, "FX", "货币"),
      metric2: `${taxBps} bps`,
      metric2Label: "tax",
    };
  });
}

export function buildBasestonkAdvancedLauncherFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  /** Verified sample BSTONK AdvancedLaunchToken (hint / idle only) */
  const bstonk = "0x0f61edbfe6cd86024c0f210c0695b08df55fdfc9";
  const sampleTx = "0x4c564ba2a09921e830f12368f80be2c26e6a020d6e49167907ee43dd6aa9905b";
  const tokens = [bstonk, fakeAddr("bstok1"), fakeAddr("bstok2"), fakeAddr("bstok3"), fakeAddr("bstok4")];
  return Array.from({ length: n }, (_, i) => {
    const token = tokens[i % tokens.length];
    const taxBps = String(100 + i * 50);
    const burnBps = String(50 + i * 10);
    const liquidityBps = String(8000 + i * 25);
    return {
      id: rid(),
      kind: "AdvancedLaunched",
      tags: ["BASE", "BASESTONK", "ADVANCEDLAUNCHED", "pad:basestonk", "RADAR"],
      title: short(token),
      body: `pad:basestonk · token ${short(token)} · creator ${short(fakeAddr("bscr" + i))} · poolId ${short(fakeAddr("bspool" + i))} · pairToken ${short(fakeAddr("bspair" + i))} · sqrtPriceX96 ${String(79228162514264337593543950336n + BigInt(i))} · taxBps ${taxBps} · burnBps ${burnBps} · liquidityBps ${liquidityBps} · payees ${1 + i} · #${38_000_000 + i * 17}`,
      address: token.toLowerCase(),
      block: 38_000_000 + i * 17,
      tx: i === 0 ? sampleTx : fakeAddr(`txbs${i}`),
      chain: "BASE",
      at: now - i * 1200,
      metric: `${taxBps} bps`,
      metricLabel: "tax",
      metric2: `burn ${burnBps}`,
      metric2Label: "burn",
    };
  });
}

export function buildMessierRwaP2pVaultFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const rwa = "0xE2B1dc2D4A3b4E59FDF0c47B71A7A86391a8B35a";
  const vault = "0xa5E09fBCaB81B2F501262035A9721f98532BD16B";
  const poolUrl = "https://p2p.messier.app/pools?network=BASE&s=RWA_USDC";
  const depositTx = "0xd8b19b0d666858eed6d9eb5fdda9f194a8e21c1f9808391c93b4e009347e06d4";
  const withdrawTx = "0x1ba4dc5bf46a6816d1447751d4bbcb5de9c5f483f75b9fce62255539c6a2e3a1";
  const rows: { side: "lock" | "release"; token: string; amount: string; maker: string; tx: string; highlight: boolean; block: number }[] = [
    {
      side: "lock",
      token: rwa,
      amount: "9999.99",
      maker: "0xe227c46f778f451318a48337c257693a3d2783aa",
      tx: depositTx,
      highlight: true,
      block: 51_265_509,
    },
    {
      side: "release",
      token: "0xf53a3b2cf482494eec4ca096af4b107a6c3b759b",
      amount: "530181.101988",
      maker: "0x505f99d145bb9f7d9cf87c4dedb7b1e4b3f57a99",
      tx: withdrawTx,
      highlight: false,
      block: 49_347_278,
    },
    {
      side: "lock",
      token: rwa,
      amount: "1200",
      maker: fakeAddr("msmaker2"),
      tx: fakeAddr("txms2"),
      highlight: true,
      block: 51_266_000,
    },
    {
      side: "release",
      token: rwa,
      amount: "88.5",
      maker: fakeAddr("msmaker3"),
      tx: fakeAddr("txms3"),
      highlight: true,
      block: 51_266_100,
    },
    {
      side: "lock",
      token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      amount: "2500",
      maker: fakeAddr("msmaker4"),
      tx: fakeAddr("txms4"),
      highlight: false,
      block: 51_266_200,
    },
  ];
  return Array.from({ length: n }, (_, i) => {
    const row = rows[i % rows.length];
    const sideLabel = row.side === "lock" ? (L(locale, "LOCK", "锁仓")) : L(locale, "RELEASE", "释放");
    const tokenLabel = row.highlight ? "$RWA" : short(row.token);
    const rawKind = row.side === "lock" ? (L(locale, "VaultDeposit", "锁仓")) : (L(locale, "VaultWithdraw", "释放"));
    const rawTitle = `${tokenLabel} ${sideLabel}`;
    const rawBody = `pad:messier-p2p · ${t(locale, "feed.bodySide")} ${row.side} · ${t(locale, "feed.bodyToken")} ${row.token} · ${t(locale, "feed.bodyAmount")} ${row.amount} · ${t(locale, "feed.bodyMaker")} ${row.maker} · ${t(locale, "feed.bodyVault")} ${vault} · #${row.block}`;
    return {
      id: rid(),
      kind: scrubDemoText(rawKind),
      tags: [
        "BASE",
        "MESSIER",
        row.side === "lock" ? "VAULTDEPOSIT" : "VAULTWITHDRAW",
        "pad:messier-p2p",
        row.highlight ? "RWA" : "TOKEN",
        "RADAR",
      ],
      title: scrubDemoText(rawTitle),
      body: scrubDemoText(rawBody),
      address: row.token.toLowerCase(),
      maker: row.maker.toLowerCase(),
      block: row.block,
      tx: row.tx,
      chain: "BASE",
      at: now - i * 1200,
      metric: row.amount,
      metricLabel: tokenLabel,
      metric2: sideLabel,
      metric2Label: t(locale, "feed.bodySide"),
      highlight: row.highlight,
      links: [
        { label: L(locale, "Messier pool", "Messier 池"), href: poolUrl },
        { label: L(locale, "BaseScan tx", "BaseScan 交易"), href: `https://basescan.org/tx/${row.tx}` },
      ],
    };
  });
}

export function buildStonksExchangeBaseLauncherFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const weth = "0x4200000000000000000000000000000000000006";
  const basecat = "0xb200000000000000000000d9192b6b456483c2e8";
  const feeLocker = "0x71D1D363176723f85d98B8B430DF33cde89f0A7f";
  const sampleMetaTx = "0x72d2abe9fef721127c6c5301ee2b8f93d70c3738c9d30f0a5ff60e84955e910a";
  const sampleCatTx = "0x0f6c917e0c3f7bd2be07d5d1e431691f75177f43287be8b5a87523f5ae67b36d";
  const hotPost = "https://x.com/Stonks_Exchange/status/2100204805738090962";
  const site = "https://thestonks.exchange/";
  const rows: {
    token: string;
    tokenId: string;
    creator: string;
    quote: string;
    quoteTag: string;
    pool: string;
    fee: string;
    launchTick: string;
    totalSupply: string;
    tx: string;
    block: number;
  }[] = [
    {
      token: "0xeab2d0296f98c8ddad2bf09ae7ad5e7715ed6f38",
      tokenId: "6013691",
      creator: "0x471a3203eefa0104623425a18ec2c36cb471e113",
      quote: weth,
      quoteTag: "WETH",
      pool: "0xf927d3086a01c7bd8d2222bec1f6477caacaed23",
      fee: "10000",
      launchTick: "202000",
      totalSupply: "1000000000000000000000000000",
      tx: sampleMetaTx,
      block: 51_386_924,
    },
    {
      token: "0x03fc710a4bb06653c6c6dbc767e85c45dbadd3a8",
      tokenId: "6008945",
      creator: "0xf2cc587310db112e3719d3a370a4bc82bcb9b043",
      quote: basecat,
      quoteTag: "BASECAT",
      pool: "0x62dd1911fd1a2e98bafb72df49ce36a2499829bd",
      fee: "10000",
      launchTick: "-409600",
      totalSupply: "1000000000000000000000000000",
      tx: sampleCatTx,
      block: 51_382_239,
    },
  ];
  return Array.from({ length: n }, (_, i) => {
    const row = rows[i % rows.length];
    const token = i < 2 ? row.token : fakeAddr("sxtok" + i);
    const quoteTag = row.quoteTag;
    const supply = "1000000000";
    return {
      id: rid(),
      kind: L(locale, "Stonks Exchange TokenLaunched", "Stonks Exchange TokenLaunched"),
      tags: ["BASE", "STONKS", "TOKENLAUNCHED", "pad:stonks-exchange", quoteTag, "RADAR"],
      title: short(token),
      body: `pad:stonks-exchange · token ${short(token)} · tokenId ${row.tokenId} · creator ${short(row.creator)} · quote ${quoteTag} ${short(row.quote)} · pool ${short(row.pool)} · fee ${row.fee} · launchTick ${row.launchTick} · totalSupply ${supply} · feeLocker ${short(feeLocker)} · #${row.block}`,
      address: token.toLowerCase(),
      block: row.block,
      tx: i < 2 ? row.tx : fakeAddr(`txsx${i}`),
      chain: "BASE",
      at: now - i * 1200,
      metric: quoteTag,
      metricLabel: L(locale, "quote", "报价"),
      metric2: "1%",
      metric2Label: L(locale, "fee", "费率"),
      highlight: quoteTag === "BASECAT",
      links: [
        { label: "thestonks.exchange", href: site },
        { label: "BaseScan", href: `https://basescan.org/tx/${i < 2 ? row.tx : fakeAddr(`txsx${i}`)}` },
        ...(quoteTag === "BASECAT"
          ? [{ label: L(locale, "Hot post · Basecat listed as quote", "热点 · Basecat 已加报价"), href: hotPost }]
          : []),
      ],
    };
  });
}

export function buildFlapBscPortalTokenCreatedFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const sampleCreatedTx =
    "0xbd7c42cb2f39558c15f9714b34b74c2f70213984a3b564954aa878a4f2ef9fac";
  const sampleDexTx =
    "0x3ba8fc6e2be1b747b0094e1df69309c65295355606e3af8c92a5239644b6b1e3";
  const hotPost = "https://x.com/bitecong/status/2100281832634003543";
  const docs = "https://docs.flap.sh/flap/developers/deployed-contract-addresses";
  const created = {
    token: "0xb635e0346a50e57c52652778a07c7a4ddf7d7777",
    creator: "0xf2e2f0ae68ca7214181ec814b75b24658c4bf1ee",
    nonce: "3151500",
    name: "Dogecoin",
    symbol: "DOGE",
    meta: "bafkreibh3qxg36pwye2uibqgkgtxqzpecqaxhabi3cu3cfxdjsek33mdrq",
    tx: sampleCreatedTx,
    block: 122_268_629,
  };
  const dex = {
    token: "0x2206d69ef31b80fbe1de057c9037cc8e5f2b7777",
    creator: "0xbd86bde99fd1a9e59a09ad788c920df59aab0225",
    nonce: "3151433",
    name: "币安时间",
    symbol: "币安时间",
    pool: "0x5c39d3f541186e249af77ce12a2fc1cdaa7ecfeb",
    tx: sampleDexTx,
    block: 122_265_999,
  };
  return Array.from({ length: n }, (_, i) => {
    const useDex = i % 2 === 1;
    const token = i < 2 ? (useDex ? dex.token : created.token) : fakeAddr("flaptok" + i);
    const tx = i < 2 ? (useDex ? dex.tx : created.tx) : fakeAddr(`txflap${i}`);
    if (useDex) {
      return {
        id: rid(),
        kind: t(locale, "flap.kindDex"),
        tags: ["BSC", "FLAP", "LAUNCHEDTODEX", "pad:flap", "DEX"],
        title: dex.symbol,
        body: `pad:flap · token ${short(token)} · pool ${short(dex.pool)} · amount 200.00M · eth 1.20M BNB · creator ${short(dex.creator)} · nonce ${dex.nonce} · #${dex.block}`,
        address: token.toLowerCase(),
        block: dex.block,
        tx,
        chain: "BSC",
        at: now - i * 1200,
        metric: "1.20M",
        metricLabel: t(locale, "flap.metricBnb"),
        metric2: short(dex.pool),
        metric2Label: t(locale, "flap.metricPool"),
        links: [
          { label: t(locale, "flap.docs"), href: docs },
          { label: t(locale, "flap.bscscan"), href: `https://bscscan.com/tx/${tx}` },
          { label: t(locale, "flap.hotPost"), href: hotPost },
        ],
      };
    }
    return {
      id: rid(),
      kind: t(locale, "flap.kindCreated"),
      tags: ["BSC", "FLAP", "TOKENCREATED", "pad:flap", created.symbol, "RADAR"],
      title: created.symbol,
      body: `pad:flap · token ${short(token)} · creator ${short(created.creator)} · nonce ${created.nonce} · name ${created.name} · symbol ${created.symbol} · meta ${created.meta} · #${created.block}`,
      address: token.toLowerCase(),
      block: created.block,
      tx,
      chain: "BSC",
      at: now - i * 1200,
      metric: created.symbol,
      metricLabel: t(locale, "flap.metricSymbol"),
      metric2: created.nonce,
      metric2Label: t(locale, "flap.metricNonce"),
      links: [
        { label: t(locale, "flap.docs"), href: docs },
        { label: t(locale, "flap.bscscan"), href: `https://bscscan.com/tx/${tx}` },
        { label: t(locale, "flap.hotPost"), href: hotPost },
      ],
    };
  });
}

