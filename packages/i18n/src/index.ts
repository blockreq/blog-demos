export type Locale = "en" | "zh";

export const LOCALES: Locale[] = ["en", "zh"];

export function isLocale(v: string): v is Locale {
  return v === "en" || v === "zh";
}

type Dict = Record<string, string>;

const en: Dict = {
  "index.title": "BlockReq demos1",
  "index.subtitle": "Browser-only public WSS demos · React + TanStack + viem · embedded on blockreq.com",
  "index.open": "Open",
  "shell.locale": "Language",
  "shell.back": "All demos",
  "shell.stackblitz": "StackBlitz twin",
  "common.start": "Start listening",
  "common.stop": "Stop",
  "common.clear": "Clear",
  "common.feed": "Launch feed",
  "common.log": "Log",
  "common.waiting": "Waiting for events… demo cards appear first.",
  "common.publicOnly": "No API keys · visitor browser connects to BlockReq public HTTP/WSS only.",
  "anoncoin.title": "Anoncoin · RH anon launch listen",
  "anoncoin.blurb": "Auto-starts on load. Listens for new launches on Robinhood Chain via BlockReq public WSS using eth_subscribe logs.",
  "openlaunch.title": "OpenLaunch · Base one-tx launch listen",
  "openlaunch.blurb": "Auto-starts on load. Listens for Uniswap v4 pool Initialize (+ optional lock) on Base via BlockReq public WSS.",
  "equifold.title": "Equifold · multi-market open listen",
  "equifold.blurb": "Dual-endpoint toggle. Factory create/open logs → aggregate markets per token → P0 first / P1 nth cards.",
};

const zh: Dict = {
  "index.title": "BlockReq demos1",
  "index.subtitle": "仅浏览器连接公共 WSS · React + TanStack + viem · 可嵌入 blockreq.com",
  "index.open": "打开",
  "shell.locale": "语言",
  "shell.back": "全部演示",
  "shell.stackblitz": "StackBlitz 同源",
  "common.start": "开始监听",
  "common.stop": "停止",
  "common.clear": "清空",
  "common.feed": "开盘动态",
  "common.log": "日志",
  "common.waiting": "等待事件… 演示卡片会先出现。",
  "common.publicOnly": "无 API Key · 仅访客浏览器连接 BlockReq 公共 HTTP/WSS。",
  "anoncoin.title": "Anoncoin · RH 匿名开盘监听",
  "anoncoin.blurb": "加载后自动开始。通过 BlockReq 公共 WSS 的 eth_subscribe logs 监听 Robinhood Chain 新开盘。",
  "openlaunch.title": "OpenLaunch · Base 一笔开盘监听",
  "openlaunch.blurb": "加载后自动开始。通过 BlockReq 公共 WSS 监听 Base 上 Uniswap v4 Initialize（+ 可选 lock）。",
  "equifold.title": "Equifold · 多市场开盘监听",
  "equifold.blurb": "双端点切换。Factory create/open → 按 token 聚合市场 → P0 首个 / P1 第 N 个卡片。",
};

const catalogs: Record<Locale, Dict> = { en, zh };

export function t(locale: Locale, key: string): string {
  return catalogs[locale][key] ?? catalogs.en[key] ?? key;
}

export const DEMO_META = [
  {
    slug: "anoncoin-rh-launch-listen",
    titleKey: "anoncoin.title",
    blurbKey: "anoncoin.blurb",
    blogEn: "https://blockreq.com/blog/en/anoncoin-rh-launch-listen",
    blogZh: "https://blockreq.com/blog/zh/anoncoin-rh-launch-listen",
    stackblitz:
      "https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/anoncoin-rh-launch-listen",
  },
  {
    slug: "openlaunch-base-eth-subscribe",
    titleKey: "openlaunch.title",
    blurbKey: "openlaunch.blurb",
    blogEn: "https://blockreq.com/blog/en/openlaunch-base-eth-subscribe",
    blogZh: "https://blockreq.com/blog/zh/openlaunch-base-eth-subscribe",
    stackblitz:
      "https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/openlaunch-base-eth-subscribe",
  },
  {
    slug: "equifold-multi-market-listen",
    titleKey: "equifold.title",
    blurbKey: "equifold.blurb",
    blogEn: "https://blockreq.com/blog/en/equifold-multi-market-listen",
    blogZh: "https://blockreq.com/blog/zh/equifold-multi-market-listen",
    stackblitz:
      "https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/equifold-multi-market-listen",
  },
] as const;

export type DemoSlug = (typeof DEMO_META)[number]["slug"];

export function getDemo(slug: string) {
  return DEMO_META.find((d) => d.slug === slug);
}
