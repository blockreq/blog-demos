export type Locale = "en" | "zh";

export const LOCALES: Locale[] = ["en", "zh"];

export function isLocale(v: string): v is Locale {
  return v === "en" || v === "zh";
}

type Dict = Record<string, string>;

const en: Dict = {
  "index.pill": "DEMOS1 // CYBERPUNK BLACK",
  "index.title": "Black + neon · states that slap",
  "index.subtitle": "Browser demos on BlockReq public nodes. Big type, loud states, no wallet.",
  "index.open": "Open",
  "index.openEn": "EN",
  "index.openZh": "中文",
  "shell.locale": "Language",
  "shell.back": "All demos",
  "shell.stackblitz": "Open in StackBlitz",
  "shell.readGuide": "Read the guide",
  "shell.pricing": "Pricing →",
  "common.start": "Start listening",
  "common.starting": "Connecting…",
  "common.listening": "Listening…",
  "common.nice": "Nice",
  "common.reset": "Listen again",
  "common.stop": "Stop",
  "common.clear": "Clear",
  "common.feed": "Launches",
  "common.waiting": "Waiting for a launch…",
  "common.publicOnly": "No wallet. Your browser talks to BlockReq public nodes only.",
  "common.settings": "Advanced (optional)",
  "state.idle": "Not connected",
  "state.connecting": "Connecting",
  "state.listening": "Listening",
  "state.hit": "Got one!",
  "state.error": "Something broke",
  "state.stopped": "Stopped",
  "stage.idle.label": "Not linked",
  "stage.idle.hint": "Hit the big button",
  "stage.connecting.label": "Connecting…",
  "stage.connecting.hint": "A second or two",
  "stage.listening.label": "Ears up",
  "stage.listening.hint": "A launch will slam in",
  "stage.hit.label": "Locked",
  "stage.hit.hint": "See the card below",
  "anoncoin.title": "Listen for anon launches",
  "anoncoin.blurb": "One tap. Wait for a launch on Robinhood Chain. No wallet.",
  "anoncoin.tag": "ANON // RH",
  "anoncoin.toast": "Got one! Anon launch just hit",
  "anoncoin.hero.idle": "One tap. Wait for a launch. No wallet.",
  "anoncoin.hero.connecting": "Hooking up to a public node…",
  "anoncoin.hero.listening": "You’re live. Launches pop here.",
  "anoncoin.hero.hit": "Caught one — details below.",
  "openlaunch.title": "Catch Base one-shot launches",
  "openlaunch.blurb": "One tap. Wait for a pool to open on Base. No wallet.",
  "openlaunch.tag": "OPEN // BASE",
  "openlaunch.toast": "Got one! Base launch just hit",
  "openlaunch.hero.idle": "One tap. Wait for a pool to open. No wallet.",
  "openlaunch.hero.connecting": "Hooking up to a public node…",
  "openlaunch.hero.listening": "You’re live. Opens pop here.",
  "openlaunch.hero.hit": "Caught one — details below.",
  "equifold.title": "Watch multi-market opens",
  "equifold.blurb": "One tap. See first vs next markets for the same token. No wallet.",
  "equifold.tag": "EQUI // MULTI",
  "equifold.toast": "Got one! Market just opened",
  "equifold.hero.idle": "One tap. First market vs the next ones. No wallet.",
  "equifold.hero.connecting": "Hooking up to a public node…",
  "equifold.hero.listening": "You’re live. Opens pop here.",
  "equifold.hero.hit": "Caught one — details below.",
};

const zh: Dict = {
  "index.pill": "DEMOS1 // 黑·赛博朋克",
  "index.title": "黑底霓虹 · 状态高对比",
  "index.subtitle": "浏览器直连 BlockReq 公共节点。大字、强状态、不用装钱包。",
  "index.open": "打开",
  "index.openEn": "EN",
  "index.openZh": "中文",
  "shell.locale": "语言",
  "shell.back": "全部演示",
  "shell.stackblitz": "在 StackBlitz 打开",
  "shell.readGuide": "看教程",
  "shell.pricing": "定价 →",
  "common.start": "开始听",
  "common.starting": "连接中…",
  "common.listening": "听着…",
  "common.nice": "太好了",
  "common.reset": "重新听",
  "common.stop": "停止",
  "common.clear": "清空",
  "common.feed": "开盘动态",
  "common.waiting": "等开盘冒出来…",
  "common.publicOnly": "不用装钱包。访客浏览器只连 BlockReq 公共节点。",
  "common.settings": "高级（可选）",
  "state.idle": "未连接",
  "state.connecting": "连接中",
  "state.listening": "在听",
  "state.hit": "来事件了",
  "state.error": "出错了",
  "state.stopped": "已停止",
  "stage.idle.label": "还没连",
  "stage.idle.hint": "准备好就按下面的大按钮",
  "stage.connecting.label": "正在连…",
  "stage.connecting.hint": "大概一两秒",
  "stage.listening.label": "竖起耳朵",
  "stage.listening.hint": "开盘会「砰」一下出现",
  "stage.hit.label": "抓住了",
  "stage.hit.hint": "看下面这张卡",
  "anoncoin.title": "匿名开盘怎么听",
  "anoncoin.blurb": "点一下，等 Robinhood Chain 上开盘冒出来。不用装钱包。",
  "anoncoin.tag": "ANON // RH",
  "anoncoin.toast": "来了！匿名币刚开盘",
  "anoncoin.hero.idle": "点一下，等开盘冒出来。不用装钱包。",
  "anoncoin.hero.connecting": "正在连上公共节点…",
  "anoncoin.hero.listening": "在听了。一有开盘就弹出来。",
  "anoncoin.hero.hit": "抓住一笔了——往下看。",
  "openlaunch.title": "Base 一笔开盘怎么听",
  "openlaunch.blurb": "点一下，等 Base 上池子开出来。不用装钱包。",
  "openlaunch.tag": "OPEN // BASE",
  "openlaunch.toast": "来了！Base 刚开盘",
  "openlaunch.hero.idle": "点一下，等池子开出来。不用装钱包。",
  "openlaunch.hero.connecting": "正在连上公共节点…",
  "openlaunch.hero.listening": "在听了。一有开盘就弹出来。",
  "openlaunch.hero.hit": "抓住一笔了——往下看。",
  "equifold.title": "多市场开盘怎么听",
  "equifold.blurb": "点一下，看同一币的首个市场和下一个。不用装钱包。",
  "equifold.tag": "EQUI // MULTI",
  "equifold.toast": "来了！市场刚开出来",
  "equifold.hero.idle": "点一下，看首个市场和下一个。不用装钱包。",
  "equifold.hero.connecting": "正在连上公共节点…",
  "equifold.hero.listening": "在听了。一有开盘就弹出来。",
  "equifold.hero.hit": "抓住一笔了——往下看。",
};

const catalogs: Record<Locale, Dict> = { en, zh };

export function t(locale: Locale, key: string): string {
  return catalogs[locale][key] ?? catalogs.en[key] ?? key;
}

/** Catalog driving `/demos1/` index — slug, titles, blurbs, entry paths. */
export const DEMO_CATALOG = [
  {
    slug: "anoncoin-rh-launch-listen",
    titleKey: "anoncoin.title",
    blurbKey: "anoncoin.blurb",
    accent: "eth" as const,
    blogEn: "https://blockreq.com/blog/en/anoncoin-rh-launch-listen",
    blogZh: "https://blockreq.com/blog/zh/anoncoin-rh-launch-listen",
    stackblitz:
      "https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/anoncoin-rh-launch-listen",
    pathEn: "/demos1/anoncoin-rh-launch-listen/en/",
    pathZh: "/demos1/anoncoin-rh-launch-listen/zh/",
  },
  {
    slug: "openlaunch-base-eth-subscribe",
    titleKey: "openlaunch.title",
    blurbKey: "openlaunch.blurb",
    accent: "bnb" as const,
    blogEn: "https://blockreq.com/blog/en/openlaunch-base-eth-subscribe",
    blogZh: "https://blockreq.com/blog/zh/openlaunch-base-eth-subscribe",
    stackblitz:
      "https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/openlaunch-base-eth-subscribe",
    pathEn: "/demos1/openlaunch-base-eth-subscribe/en/",
    pathZh: "/demos1/openlaunch-base-eth-subscribe/zh/",
  },
  {
    slug: "equifold-multi-market-listen",
    titleKey: "equifold.title",
    blurbKey: "equifold.blurb",
    accent: "sol" as const,
    blogEn: "https://blockreq.com/blog/en/equifold-multi-market-listen",
    blogZh: "https://blockreq.com/blog/zh/equifold-multi-market-listen",
    stackblitz:
      "https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/equifold-multi-market-listen",
    pathEn: "/demos1/equifold-multi-market-listen/en/",
    pathZh: "/demos1/equifold-multi-market-listen/zh/",
  },
] as const;

/** @deprecated Prefer DEMO_CATALOG */
export const DEMO_META = DEMO_CATALOG;

export type DemoSlug = (typeof DEMO_CATALOG)[number]["slug"];

export function getDemo(slug: string) {
  return DEMO_CATALOG.find((d) => d.slug === slug);
}
