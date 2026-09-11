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
