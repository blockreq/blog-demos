import { useMemo, useState } from "react";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  redirect,
} from "@tanstack/react-router";
import {
  DEMO_CATALOG,
  demoBlogUrl,
  demoSiteUrl,
  getDemo,
  isLocale,
  publishedDemos,
  t,
  type Locale,
} from "@blockreq/i18n";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DemoCta,
  DemoTerminal,
  Input,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
  cn,
  type DemoTerminalLine,
} from "@blockreq/ui";
import { MonitorChrome } from "./components/monitor-chrome";
import { AnoncoinDemo } from "./demos/anoncoin-rh-launch-listen";
import { OpenLaunchDemo } from "./demos/openlaunch-base-eth-subscribe";
import { EquifoldDemo } from "./demos/equifold-multi-market-listen";
import { StockPairDemo } from "./demos/stock-pair-meme-launch-listen";
import { PonsLaunchpadDemo } from "./demos/pons-launchpad-listen";
import { RhUniswapV4DirectDemo } from "./demos/rh-uniswap-v4-direct-launch-listen";
import { BaseLaunchSpikeDemo } from "./demos/base-launch-spike-listen";
import { RhBasketFactoryDemo } from "./demos/rh-basket-factory-listen";
import { LongEcoLaunchDemo } from "./demos/long-eco-launch-listen";
import { ArcMainnetDay1Demo } from "./demos/arc-mainnet-day1-listen";
import { BaseStockTokenSwapDemo } from "./demos/base-stock-token-swap-listen";
import { RhAnyQuoteLaunchDemo } from "./demos/rh-any-quote-launch-listen";
import { PumpfunCustomPairsDemo } from "./demos/pumpfun-custom-pairs-listen";
import { MonadO1LaunchpadDemo } from "./demos/monad-o1-launchpad-listen";
import { SolanaChangelogSubscriptionFilterDemo } from "./demos/solana-changelog-subscription-filter";
import { AnzaAgaveRpcCompatWatchDemo } from "./demos/anza-agave-rpc-compat-watch";
import { BrewBnbDoublePairDemo } from "./demos/brew-bnb-double-pair-listen";
import { ArbitrumRwaFlowDemo } from "./demos/arbitrum-rwa-flow-listen";
import { CronosAppLaunchpadDemo } from "./demos/cronos-app-launchpad-listen";
import { EthUniswapV4StablePairHookDemo } from "./demos/ethereum-uniswap-v4-stablepair-hook-listen";
import { BaseLaptopSniperLiquidityDemo } from "./demos/base-laptop-sniper-liquidity-listen";
import { MultiplrEthLeverageLaunchpadDemo } from "./demos/multiplr-eth-leverage-launchpad-listen";

const ACCENT: Record<"eth" | "sol" | "bnb", string> = {
  eth: "border-[rgba(85,124,242,0.55)]",
  sol: "border-[rgba(162,60,249,0.55)]",
  bnb: "border-[rgba(241,185,44,0.55)]",
};

function RootLayout() {
  return (
    <div className="min-h-screen text-[var(--color-foreground)]">
      <Outlet />
    </div>
  );
}

/** Catalog/discovery only — radar wall lists published tools; each card routes to its own slug layout. */
function IndexPage() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [filter, setFilter] = useState("");
  const [lane, setLane] = useState<string>("all");
  const demos = publishedDemos();

  const lanes = useMemo(() => {
    const set = new Set(demos.map((d) => d.chainLabel));
    return ["all", ...Array.from(set)];
  }, [demos]);

  const filtered = demos.filter((d) => {
    if (lane !== "all" && d.chainLabel !== lane) return false;
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    return (
      d.slug.includes(q) ||
      t(locale, d.titleKey).toLowerCase().includes(q) ||
      t(locale, d.blurbKey).toLowerCase().includes(q) ||
      d.layout.includes(q)
    );
  });

  const logLines: DemoTerminalLine[] = demos.map((d, i) => ({
    id: d.slug,
    ts: `${String(i + 1).padStart(2, "0")}`,
    text: `${d.slug} · layout=${d.layout} · ${d.chainLabel} · published`,
    tone: "ok",
  }));

  return (
    <div className="flex min-h-screen flex-col" data-layout="radar">
      <MonitorChrome
        locale={locale}
        title="BlockReq demos1"
        status="idle"
        localeMode="catalog"
        onLocaleChange={setLocale}
        siteUrl="https://blockreq.com/"
      />
      <div className="demo-shell flex flex-1 flex-col gap-3 py-3">
        <div className="border border-[rgba(57,255,154,0.25)] bg-[rgba(57,255,154,0.06)] px-3 py-2 text-xs text-[#b7ffd8]">
          {t(locale, "index.radarBanner")}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
            {t(locale, "index.chainLabel")}
          </span>
          <ToggleGroup
            type="single"
            value={lane}
            onValueChange={(v) => v && setLane(v)}
            variant="outline"
            size="sm"
          >
            {lanes.map((l) => (
              <ToggleGroupItem key={l} value={l}>
                {l === "all" ? (locale === "zh" ? "全部" : "All") : l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="ml-auto flex min-w-[220px] flex-1 items-center gap-2 md:max-w-sm">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={locale === "zh" ? "筛选产品 / slug…" : "Filter product / slug…"}
              className="h-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 border border-[rgba(0,240,255,0.45)] bg-[rgba(0,240,255,0.08)] px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--color-neon-cyan)]">
              {t(locale, "index.pill")}
            </div>
            <h1 className="type-display">
              {t(locale, "index.title")}
            </h1>
            <p className="mt-1 max-w-[60ch] text-sm text-[var(--color-muted-foreground)]">
              {t(locale, "index.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://blockreq.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center border border-[rgba(57,255,154,0.45)] bg-[rgba(57,255,154,0.08)] px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-ok)] hover:brightness-110"
            >
              {t(locale, "index.site")}
            </a>
            <span className="font-mono text-[11px] font-bold text-[var(--color-muted-foreground)]">
              {t(locale, "shell.quotaAfter")}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">{t(locale, "index.radarTitle")}</h2>
          <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
            {filtered.length}/{demos.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d, i) => (
            <Card key={d.slug} className={cn(ACCENT[d.accent], i === 0 && "focus-card ring-1 ring-[rgba(0,240,255,0.25)]")}>
              <CardHeader className="space-y-2 p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-[clamp(18px,2vw,22px)] font-black tracking-tight">{t(locale, d.titleKey)}</CardTitle>
                  <Badge variant="ok">{d.chainLabel}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{t(locale, `layout.${d.layout}`)}</Badge>
                  <Badge variant="secondary">{d.slug}</Badge>
                </div>
                <CardDescription className="text-[13px] leading-relaxed">
                  {t(locale, d.blurbKey)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
                <Link
                  to="/$slug/$locale/"
                  params={{ slug: d.slug, locale }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center border border-[rgba(0,240,255,0.55)] bg-[rgba(0,240,255,0.12)] px-4 text-sm font-bold text-[var(--color-neon-cyan)] hover:brightness-110"
                >
                  {t(locale, "index.open")}
                </Link>
                <a
                  href={demoBlogUrl(d.blogSlug, locale)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center border border-[var(--color-line)] bg-[var(--color-panel)] px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-foreground)] hover:border-[rgba(0,240,255,0.35)]"
                >
                  {t(locale, "index.docs")}
                </a>
                <a
                  href={demoSiteUrl(d)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center border border-[rgba(57,255,154,0.4)] bg-[rgba(57,255,154,0.06)] px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-ok)] hover:brightness-110"
                >
                  {t(locale, "index.site")}
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />
        <DemoTerminal
          title={t(locale, "index.radarLog")}
          lines={logLines}
          emptyLabel={t(locale, "common.terminalEmpty")}
        />
        <p className="pb-4 font-mono text-[11px] text-[var(--color-muted-foreground)]">
          {t(locale, "common.publicOnly")}
        </p>
      </div>
    </div>
  );
}

function DemoPage() {
  const { slug, locale: localeParam } = demoRoute.useParams();
  if (!isLocale(localeParam) || !getDemo(slug)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p>Unknown demo or locale.</p>
        <Link to="/" className="text-[var(--color-neon-cyan)] underline">
          Back
        </Link>
      </main>
    );
  }
  const locale = localeParam;
  const meta = getDemo(slug)!;
  const blogUrl = demoBlogUrl(meta.blogSlug, locale);
  const siteUrl = demoSiteUrl(meta);

  return (
    <>
      {/* Layout is chosen by catalog.layout via the demo component itself — not a tabbed feel page. */}
      {slug === "anoncoin-rh-launch-listen" && <AnoncoinDemo locale={locale} />}
      {slug === "openlaunch-base-eth-subscribe" && <OpenLaunchDemo locale={locale} />}
      {slug === "equifold-multi-market-listen" && <EquifoldDemo locale={locale} />}
      {slug === "stock-pair-meme-launch-listen" && <StockPairDemo locale={locale} />}
      {slug === "pons-launchpad-listen" && <PonsLaunchpadDemo locale={locale} />}
      {slug === "rh-uniswap-v4-direct-launch-listen" && <RhUniswapV4DirectDemo locale={locale} />}
      {slug === "base-launch-spike-listen" && <BaseLaunchSpikeDemo locale={locale} />}
      {slug === "rh-basket-factory-listen" && <RhBasketFactoryDemo locale={locale} />}
      {slug === "long-eco-launch-listen" && <LongEcoLaunchDemo locale={locale} />}
      {slug === "arc-mainnet-day1-listen" && <ArcMainnetDay1Demo locale={locale} />}
      {slug === "base-stock-token-swap-listen" && <BaseStockTokenSwapDemo locale={locale} />}
      {slug === "rh-any-quote-launch-listen" && <RhAnyQuoteLaunchDemo locale={locale} />}
      {slug === "pumpfun-custom-pairs-listen" && <PumpfunCustomPairsDemo locale={locale} />}
      {slug === "monad-o1-launchpad-listen" && <MonadO1LaunchpadDemo locale={locale} />}
      {slug === "solana-changelog-subscription-filter" && <SolanaChangelogSubscriptionFilterDemo locale={locale} />}
      {slug === "anza-agave-rpc-compat-watch" && <AnzaAgaveRpcCompatWatchDemo locale={locale} />}
      {slug === "brew-bnb-double-pair-listen" && <BrewBnbDoublePairDemo locale={locale} />}
      {slug === "arbitrum-rwa-flow-listen" && <ArbitrumRwaFlowDemo locale={locale} />}
      {slug === "cronos-app-launchpad-listen" && <CronosAppLaunchpadDemo locale={locale} />}
      {slug === "ethereum-uniswap-v4-stablepair-hook-listen" && (
        <EthUniswapV4StablePairHookDemo locale={locale} />
      )}
      {slug === "base-laptop-sniper-liquidity-listen" && (
        <BaseLaptopSniperLiquidityDemo locale={locale} />
      )}
      {slug === "multiplr-eth-leverage-launchpad-listen" && (
        <MultiplrEthLeverageLaunchpadDemo locale={locale} />
      )}
      <DemoCta
        title={t(locale, meta.titleKey)}
        blogUrl={blogUrl}
        siteUrl={siteUrl}
        readLabel={t(locale, "shell.readGuide")}
        siteLabel={t(locale, "shell.site")}
        pricingLabel={t(locale, "shell.pricing")}
        quotaLabel={t(locale, "shell.quotaAfter")}
      />
    </>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$slug/$locale",
  beforeLoad: ({ params }) => {
    const demo = getDemo(params.slug);
    if (!isLocale(params.locale) || !demo || !demo.published) {
      throw redirect({ to: "/" });
    }
  },
  component: DemoPage,
});

const routeTree = rootRoute.addChildren([indexRoute, demoRoute]);

export const router = createRouter({
  routeTree,
  basepath: "/demos1",
  trailingSlash: "always",
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Keep catalog import live for tree growth checks
void DEMO_CATALOG;
