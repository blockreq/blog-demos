import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@blockreq/i18n";
import type { FeedEvent } from "../components/feed-types";

/** Query / catalog / local toggle — default OFF for normal visitors. */
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

/** Fixture payloads — clearly tagged DEMO so 美工 can verify flash/hit/columns. */
export function buildAnonFixtures(locale: Locale, n = 4): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["新开盘", "LP 到位", "新开盘", "新开盘"]
      : ["New launch", "LP ready", "New launch", "New launch"];
  const syms = ["GHOSTX", "VOIDPEPE", "NEONANON", "SHADOW"];
  return Array.from({ length: n }, (_, i) => {
    const addr = fakeAddr(`anon${i}${syms[i % syms.length]}`);
    const lp = (12_400 + i * 860).toLocaleString();
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: i % 2 === 0 ? ["NEW", "ANON", "DEMO"] : ["LP", "DEMO"],
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
  const kind = locale === "zh" ? "一枪开盘" : "One-shot launch";
  const names = ["PIXELMOON", "BASEBEAM", "OPENSHOT"];
  return Array.from({ length: n }, (_, i) => {
    const addr = fakeAddr(`open${i}${names[i % names.length]}`);
    const px = (0.00084 * (i + 1)).toFixed(5);
    const vol = (18_200 + i * 4_100).toLocaleString();
    return {
      id: rid(),
      kind,
      tags: ["HIT", "BASE", "DEMO"],
      title: names[i % names.length],
      body: `${short(addr)} · pool init+lock · #${28_900_000 + i * 9}`,
      address: addr,
      block: 28_900_000 + i * 9,
      tx: fakeAddr(`txopen${i}`),
      chain: "BASE",
      at: now - i * 2200,
      metric: `$${px}`,
      metricLabel: locale === "zh" ? "价格" : "Price",
      metric2: `$${vol}`,
      metric2Label: locale === "zh" ? "成交额" : "Volume",
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
        ? locale === "zh"
          ? "首个市场"
          : "First market"
        : locale === "zh"
          ? "又开一个"
          : "Next market";
    const tags =
      m.tag === "FIRST" ? ["FIRST", "DEMO"] : ["NEXT", `N=${m.idx}`, "DEMO", ...(m.idx >= 3 ? ["BURST"] : [])];
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
      metricLabel: locale === "zh" ? "价格" : "Price",
      metric2: `$${Number(vol).toLocaleString()}`,
      metric2Label: locale === "zh" ? "量" : "Vol",
    };
  });
  return { coinLabel, coinAddr, events };
}


export function buildStockFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["币股配对开盘", "首次 LP", "币股配对开盘", "配对资产", "开盘簇"]
      : ["pair landed", "first LP", "pair landed", "paired asset", "paired open cluster"];
  const syms = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN"];
  return Array.from({ length: n }, (_, i) => {
    const addr = fakeAddr(`stock${i}${syms[i % syms.length]}`);
    const meme = fakeAddr(`meme${i}${syms[i % syms.length]}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: i % 2 === 0 ? ["STOCK", "PAIR", "DEMO"] : ["LP", "STOCK", "DEMO"],
      title: short(addr),
      body: `${syms[i % syms.length]} ↔ ${short(meme)} · #${12_500_000 + i * 11}`,
      address: addr,
      block: 12_500_000 + i * 11,
      tx: fakeAddr(`txstock${i}`),
      chain: "RH",
      at: now - i * 1600,
      metric: syms[i % syms.length],
      metricLabel: locale === "zh" ? "股票" : "Stock",
    };
  });
}

export function buildPonsFixtures(locale: Locale, n = 4): FeedEvent[] {
  const now = Date.now();
  const kind = locale === "zh" ? "Pons 发射" : "Pons launch";
  const names = ["PONCAT", "CURVEPEPE", "GRADX", "LAUNCHY"];
  return Array.from({ length: n }, (_, i) => {
    const addr = fakeAddr(`pons${i}${names[i % names.length]}`);
    const curve = fakeAddr(`curve${i}`);
    return {
      id: rid(),
      kind: i === 1 && locale === "zh" ? "Pons 毕业" : i === 1 ? "Pons graduated" : kind,
      tags: i === 1 ? ["GRAD", "PONS", "DEMO"] : ["NEW", "PONS", "DEMO"],
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
      metric2Label: locale === "zh" ? "区块" : "Block",
    };
  });
}

function short(a: string) {
  if (!a || a.length < 10) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Opt-in demo/fixture mode. Default off.
 * Enables via `?demoHits=1`, catalog `demoHits: true`, or the in-page toggle.
 */
export function useDemoHits(opts?: { catalogFlag?: boolean }) {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    setEnabledState(readDemoHitsFromUrl() || !!opts?.catalogFlag);
  }, [opts?.catalogFlag]);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    writeDemoHitsToUrl(on);
  }, []);

  return { enabled, setEnabled };
}

export function buildRhV4DirectFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kind = locale === "zh" ? "V4 直开" : "V4 direct open";
  const names = ["RHDIRECT", "POOLNOW", "NOBOND", "V4FLASH", "INITX"];
  return Array.from({ length: n }, (_, i) => {
    const poolId = fakeAddr(`rhv4${i}${names[i % names.length]}`);
    const c0 = fakeAddr(`c0rh${i}`);
    const c1 = fakeAddr(`c1rh${i}`);
    return {
      id: rid(),
      kind: i === 2 && locale === "zh" ? "流动性到位" : i === 2 ? "Liquidity in" : kind,
      tags: i === 2 ? ["LP", "V4", "DIRECT", "DEMO"] : ["NEW", "V4", "DIRECT", "DEMO"],
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
      metric2Label: locale === "zh" ? "区块" : "Block",
    };
  });
}

export function buildBaseSpikeFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["工厂开盘", "开盘尖刺", "工厂开盘", "早期换手密", "开盘尖刺"]
      : ["Factory create", "Launch spike", "Factory create", "Early swap dens", "Launch spike"];
  const names = ["SPIKEX", "BASEBURST", "DENSECAT", "OPENFAST", "TIPPY"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`spike${i}${names[i % names.length]}`);
    const swaps = 4 + i * 3;
    const spike = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: spike ? ["SPIKE", "BASE", "DEMO"] : ["NEW", "BASE", "DEMO"],
      title: names[i % names.length],
      body: `${short(pair)} · swaps ${swaps}/window · #${28_920_000 + i * 7}`,
      address: pair,
      block: 28_920_000 + i * 7,
      tx: fakeAddr(`txspike${i}`),
      chain: "BASE",
      at: now - i * 1500,
      metric: String(swaps),
      metricLabel: locale === "zh" ? "早期换手" : "Early swaps",
      metric2: spike ? (locale === "zh" ? "尖刺" : "SPIKE") : (locale === "zh" ? "开盘" : "OPEN"),
      metric2Label: locale === "zh" ? "信号" : "Signal",
    };
  });
}

export function buildBasketFixtures(locale: Locale, n = 4): FeedEvent[] {
  const now = Date.now();
  const kind = locale === "zh" ? "篮筐创建" : "Basket created";
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
      tags: ["NEW", "BASKET", "RH", "DEMO"],
      title: `${b.symbol} · ${b.name}`,
      body: `components ${b.comps} · ${short(addr)} · #${12_800_000 + i * 15}`,
      address: addr,
      block: 12_800_000 + i * 15,
      tx: fakeAddr(`txbasket${i}`),
      chain: "RH",
      at: now - i * 1900,
      metric: b.symbol,
      metricLabel: locale === "zh" ? "符号" : "Symbol",
      metric2: b.comps,
      metric2Label: locale === "zh" ? "成分" : "Components",
    };
  });
}

export function buildLongEcoFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["生态配对开盘", "生态配对开盘", "首次 LP", "生态配对", "开盘簇"]
      : ["eco pair landed", "eco pair landed", "first LP", "eco pair", "eco open cluster"];
  const ecos = ["USDC", "WETH", "LONG", "RHUSD", "cbBTC"];
  return Array.from({ length: n }, (_, i) => {
    const eco = fakeAddr(`eco${i}${ecos[i % ecos.length]}`);
    const meme = fakeAddr(`memeeeco${i}${ecos[i % ecos.length]}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: i % 3 === 2 ? ["LP", "ECO", "DEMO"] : ["ECO", "PAIR", "DEMO"],
      title: short(meme),
      body: `${ecos[i % ecos.length]} ↔ ${short(meme)} · #${12_810_000 + i * 11}`,
      address: meme,
      block: 12_810_000 + i * 11,
      tx: fakeAddr(`txeco${i}`),
      chain: "RH",
      at: now - i * 1700,
      metric: ecos[i % ecos.length],
      metricLabel: locale === "zh" ? "生态侧" : "ecoSide",
      metric2: short(meme),
      metric2Label: locale === "zh" ? "meme侧" : "memeSide",
    };
  });
}


export function buildArcDay1Fixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["Factory PairCreated", "早期 Swap 密度", "Factory PairCreated", "早期 Swap 密度", "Factory PairCreated"]
      : ["Factory PairCreated", "Early Swap density", "Factory PairCreated", "Early Swap density", "Factory PairCreated"];
  const names = ["ARCPAD", "DAY1X", "OPENARC", "PAIRNOW", "DENSARC"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`arc${i}${names[i % names.length]}`);
    const dens = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: dens ? ["DENS", "ARC", "DEMO"] : ["NEW", "ARC", "DAY1", "DEMO"],
      title: names[i % names.length],
      body: `${short(pair)} · #${1_000_000 + i * 9}`,
      address: pair,
      block: 1_000_000 + i * 9,
      tx: fakeAddr(`txarc${i}`),
      chain: "ARC",
      at: now - i * 1600,
      metric: dens ? String(3 + i) : short(pair),
      metricLabel: dens ? (locale === "zh" ? "早期换手" : "Early swaps") : "pair",
      metric2: dens ? "DENS" : "OPEN",
      metric2Label: locale === "zh" ? "信号" : "Signal",
    };
  });
}

export function buildBaseStockSwapFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kind = locale === "zh" ? "股币大单" : "Stock big print";
  const syms = ["AAPL", "TSLA", "NVDA", "MSFT", "COIN"];
  const venues = ["V2", "V3", "V2", "V3", "V2"];
  return Array.from({ length: n }, (_, i) => {
    const pool = fakeAddr(`bsswap${i}${syms[i % syms.length]}`);
    const size = (250_000 + i * 80_000).toLocaleString();
    return {
      id: rid(),
      kind,
      tags: ["BIG", "BASE", venues[i % venues.length], syms[i % syms.length], "DEMO"],
      title: `${syms[i % syms.length]} · ${venues[i % venues.length]}`,
      body: `chain=base · venue=${venues[i % venues.length]} · print $${size} · pool ${short(pool)} · #${28_930_000 + i * 5}`,
      address: pool,
      block: 28_930_000 + i * 5,
      tx: fakeAddr(`txbsswap${i}`),
      chain: "BASE",
      at: now - i * 1400,
      metric: `$${size}`,
      metricLabel: locale === "zh" ? "大单" : "Print",
      metric2: venues[i % venues.length],
      metric2Label: "venue",
    };
  });
}

export function buildAnyQuoteFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["任意报价 Initialize", "任意报价 PairCreated", "任意报价 Initialize", "任意报价 PairCreated", "任意报价 Initialize"]
      : ["any-quote Initialize", "any-quote PairCreated", "any-quote Initialize", "any-quote PairCreated", "any-quote Initialize"];
  const quotes = ["USDC", "WETH", "RHUSD", "cbBTC", "USDC"];
  return Array.from({ length: n }, (_, i) => {
    const launch = fakeAddr(`aqlaunch${i}${quotes[i % quotes.length]}`);
    const quote = fakeAddr(`aqquote${i}${quotes[i % quotes.length]}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: ["ANYQUOTE", "RH", quotes[i % quotes.length], "DEMO"],
      title: short(launch),
      body: `path=any-quote · quoteSide ${quotes[i % quotes.length]} ${short(quote)} · launchSide ${short(launch)} · #${12_820_000 + i * 13}`,
      address: launch,
      block: 12_820_000 + i * 13,
      tx: fakeAddr(`txaq${i}`),
      chain: "RH",
      at: now - i * 1700,
      metric: quotes[i % quotes.length],
      metricLabel: locale === "zh" ? "报价侧" : "quoteSide",
      metric2: short(launch),
      metric2Label: locale === "zh" ? "发射侧" : "launchSide",
    };
  });
}


export function buildPumpCustomPairFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["Create", "CustomPair", "Create", "PumpSwap 毕业", "CustomPair"]
      : ["Create", "CustomPair", "Create", "PumpSwap graduated", "CustomPair"];
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
        ? ["GRAD", "PUMPSWAP", "DEMO"]
        : i % 2 === 1
          ? ["CUSTOM", "PUMP", "DEMO", q.tag]
          : ["CREATE", "PUMP", "DEMO", q.tag],
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
    locale === "zh"
      ? ["Factory PairCreated", "早期 Swap 密度", "Factory PairCreated", "早期 Swap 密度", "Factory PairCreated"]
      : ["Factory PairCreated", "Early Swap density", "Factory PairCreated", "Early Swap density", "Factory PairCreated"];
  const names = ["O1PAD", "DAY0X", "MONADOPEN", "PAIRO1", "DENSO1"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`monado1${i}${names[i % names.length]}`);
    const dens = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: dens ? ["DENS", "MONAD", "O1", "DEMO"] : ["NEW", "MONAD", "O1", "DAY0", "DEMO"],
      title: names[i % names.length],
      body: `pad monad-o1 · ${short(pair)} · #${143_000 + i * 9}`,
      address: pair,
      block: 143_000 + i * 9,
      tx: fakeAddr(`txmonado1${i}`),
      chain: "MONAD",
      at: now - i * 1600,
      metric: dens ? String(3 + i) : short(pair),
      metricLabel: dens ? (locale === "zh" ? "早期换手" : "Early swaps") : "pair",
      metric2: dens ? "DENS" : "OPEN",
      metric2Label: locale === "zh" ? "信号" : "Signal",
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
    locale === "zh"
      ? ["Filter 命中", "升级窗告警", "Filter 命中", "升级窗告警", "Filter 命中"]
      : ["Filter hit", "Upgrade-window alert", "Filter hit", "Upgrade-window alert", "Filter hit"];
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
        ? ["UPGRADE", "ALERT", "DEMO", ut]
        : ["FILTER", "CHANGELOG", "DEMO", fk],
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
    locale === "zh"
      ? ["tip/slot 探针", "pre/post 差", "tip/slot 探针", "sub 健康", "兼容清单"]
      : ["tip/slot probe", "pre/post diff", "tip/slot probe", "sub healthy", "compat checklist"];
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
      tags: i % 2 === 1 ? ["DIFF", "AGAVE", "DEMO", releaseTag] : ["PROBE", "AGAVE", "DEMO", releaseTag],
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
    locale === "zh"
      ? ["双池进度", "双池齐听 twinReady", "双池进度", "双池齐听 twinReady", "双池进度"]
      : ["Twin progress", "Twin ready", "Twin progress", "Twin ready", "Twin progress"];
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
        ? ["TWIN", "READY", "BREW", "BSC", "DEMO"]
        : ["PART", "BREW", "BSC", "DEMO"],
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
      metricLabel: twin ? (locale === "zh" ? "双池齐" : "Twin") : (locale === "zh" ? "池进度" : "Pools"),
      metric2: "$69000",
      metric2Label: "CAP_USD",
    };
  });
}

export function buildArbRwaFlowFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["mint 铸币", "Transfer", "PairCreated 开池", "mint 铸币", "Transfer"]
      : ["mint", "transfer", "pair", "mint", "transfer"];
  const syms = ["USDY", "USDC", "BUIDL", "USDT", "USDY"];
  const kindTags = ["MINT", "TRANSFER", "PAIR", "MINT", "TRANSFER"];
  return Array.from({ length: n }, (_, i) => {
    const token = fakeAddr(`arbrwa${i}${syms[i % syms.length]}`);
    const pair = fakeAddr(`arbpair${i}`);
    const kind = kindTags[i % kindTags.length];
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: [kind, "RWA", "ARB", syms[i % syms.length], "DEMO"],
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
      metricLabel: kind === "PAIR" ? "pair" : (locale === "zh" ? "数量" : "Amount"),
      metric2: kind.toLowerCase(),
      metric2Label: "kind",
    };
  });
}

export function buildCronosLaunchpadFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["池子开了", "首流动性", "池子开了", "早期转账", "首流动性"]
      : ["Pool open", "First liquidity", "Pool open", "Early transfer", "First liquidity"];
  const names = ["CROAPP", "PADX", "LAUNCHY", "MINT1", "XFERY"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`cro${i}${names[i % names.length]}`);
    const first = i % 2 === 1;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: first
        ? ["FIRST", "MINT", "CRO", "LAUNCHPAD", "DEMO", "pad:app-launchpad"]
        : ["NEW", "CRO", "LAUNCHPAD", "DEMO", "pad:app-launchpad"],
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
    locale === "zh"
      ? ["Swap", "peg 偏离", "费率", "LP 变动", "Swap"]
      : ["swap", "peg drift", "fee", "lp", "swap"];
  const kindTags = ["swap", "peg", "fee", "lp", "swap"];
  const pools = ["USDC/USDT", "USDC/USDG", "USDC/USDT", "USDC/USDG", "USDC/USDT"];
  return Array.from({ length: n }, (_, i) => {
    const poolId = fakeAddr(`ethv4sp${i}${pools[i % pools.length]}`);
    const peg = 12 + i * 17;
    const fee = 100 + i * 25;
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: ["V4", "STABLEPAIR", "ETH", `kind:${kindTags[i % kindTags.length]}`, "DEMO", "pad:stablepair-hook"],
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
    locale === "zh"
      ? ["首池 Mint", "换手簇", "持仓集中", "薄 LP 退出", "首池 Mint"]
      : ["firstMint", "swapBurst", "holderConc", "thinExit", "firstMint"];
  const kindTags = ["firstMint", "swapBurst", "holderConc", "thinExit", "firstMint"];
  const names = ["LAPTOP", "LPT1", "SNIPX", "THINLP", "BURST"];
  return Array.from({ length: n }, (_, i) => {
    const pair = fakeAddr(`laptop${i}${names[i % names.length]}`);
    return {
      id: rid(),
      kind: kinds[i % kinds.length],
      tags: ["BASE", "LAPTOP", `kind:${kindTags[i % kindTags.length]}`, "DEMO", "pad:laptop-liq"],
      title: names[i % names.length],
      body: `pad:laptop-liq · kind=${kindTags[i % kindTags.length]} · pair ${short(pair)} · #${29_100_000 + i * 7}`,
      address: pair,
      block: 29_100_000 + i * 7,
      tx: fakeAddr(`txlaptop${i}`),
      chain: "BASE",
      at: now - i * 1400,
      metric: kindTags[i % kindTags.length] === "holderConc" ? "42%" : String(4 + i * 2),
      metricLabel: kindTags[i % kindTags.length] === "holderConc" ? (locale === "zh" ? "顶仓占比" : "top share") : (locale === "zh" ? "信号" : "signal"),
      metric2: kindTags[i % kindTags.length],
      metric2Label: "kind",
    };
  });
}

export function buildMultiplrLeverageFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["杠杆开池", "曲线早打印", "V3 毕业", "ETH2x 转账爆发", "杠杆开池"]
      : ["Leverage open", "Curve print", "V3 graduate", "ETH2x transfer burst", "Leverage open"];
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
      tags: ["ETH", "MULTIPLR", "LEVERAGE", "DEMO", "pad:multiplr-leverage", ...tagsList[i % tagsList.length]],
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
      metric2Label: locale === "zh" ? "区块" : "Block",
    };
  });
}

export function buildHarmonicRhcFixtures(locale: Locale, n = 5): FeedEvent[] {
  const now = Date.now();
  const kinds =
    locale === "zh"
      ? ["Pons 发射", "HARMONIC 命中发射", "Hookr 发射", "V4 Initialize", "Pons 发射"]
      : ["Pons launch", "HARMONIC launch hit", "Hookr launch", "V4 Initialize", "Pons launch"];
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
      tags: ["RH", "HARMONIC", "AGENT", "DEMO", ...tagsList[i % tagsList.length]],
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
      metric2Label: locale === "zh" ? "区块" : "Block",
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
      kind: locale === "zh" ? kindsZh[i % kindsZh.length] : kindsEn[i % kindsEn.length],
      tags: [
        "BASE",
        "LONGSHOT",
        "FOOTBALL",
        "DEMO",
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
      metric2Label: locale === "zh" ? "区块" : "Block",
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
      tags: ["RH", "COMPANYPAD", "LAUNCHED", "DEMO", "pad:companypad", "RADAR"],
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
      metric2Label: locale === "zh" ? "区块" : "Block",
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
        "DEMO",
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
      metric2Label: locale === "zh" ? "区块" : "Block",
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
      tags: ["RH", "CROSSRATE", "TOKENLAUNCHED", "DEMO", "pad:crossrate", currency, "FX", "RADAR"],
      title: currency,
      body: `pad:crossrate · currency ${currency} · token ${short(token)} · creator ${short(fakeAddr("crcr" + i))} · quoteToken ${short(quote)} · poolId ${short(fakeAddr("crpool" + i))} · taxBps ${taxBps} · supply ${String(1_000_000_000n + BigInt(i))} · liquidity ${String(50_000n + BigInt(i * 100))} · #${4_680_000 + i * 17}`,
      address: token.toLowerCase(),
      block: 4_680_000 + i * 17,
      tx: fakeAddr(`txcr${i}`),
      chain: "RH",
      at: now - i * 1200,
      metric: currency,
      metricLabel: locale === "zh" ? "货币" : "FX",
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
      tags: ["BASE", "BASESTONK", "ADVANCEDLAUNCHED", "DEMO", "pad:basestonk", "RADAR"],
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
    const sideLabel = row.side === "lock" ? (locale === "zh" ? "锁仓" : "LOCK") : locale === "zh" ? "释放" : "RELEASE";
    const tokenLabel = row.highlight ? "$RWA" : short(row.token);
    return {
      id: rid(),
      kind: row.side === "lock" ? (locale === "zh" ? "锁仓" : "VaultDeposit") : (locale === "zh" ? "释放" : "VaultWithdraw"),
      tags: [
        "BASE",
        "MESSIER",
        row.side === "lock" ? "VAULTDEPOSIT" : "VAULTWITHDRAW",
        "DEMO",
        "pad:messier-p2p",
        row.highlight ? "RWA" : "TOKEN",
        "RADAR",
      ],
      title: `${tokenLabel} ${sideLabel}`,
      body: `pad:messier-p2p · side ${row.side} · token ${short(row.token)} · amount ${row.amount} · maker ${short(row.maker)} · vault ${short(vault)} · ${poolUrl} · https://basescan.org/tx/${row.tx} · #${row.block}`,
      address: row.token.toLowerCase(),
      block: row.block,
      tx: row.tx,
      chain: "BASE",
      at: now - i * 1200,
      metric: row.amount,
      metricLabel: tokenLabel,
      metric2: sideLabel,
      metric2Label: locale === "zh" ? "方向" : "side",
      highlight: row.highlight,
      links: [
        { label: locale === "zh" ? "Messier 池" : "Messier pool", href: poolUrl },
        { label: locale === "zh" ? "BaseScan 交易" : "BaseScan tx", href: `https://basescan.org/tx/${row.tx}` },
      ],
    };
  });
}

