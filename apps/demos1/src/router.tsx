import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  redirect,
} from "@tanstack/react-router";
import { DEMO_CATALOG, getDemo, isLocale, t, type Locale } from "@blockreq/i18n";
import { DemoCta } from "@blockreq/ui";
import { AnoncoinDemo } from "./demos/anoncoin-rh-launch-listen";
import { OpenLaunchDemo } from "./demos/openlaunch-base-eth-subscribe";
import { EquifoldDemo } from "./demos/equifold-multi-market-listen";

const ACCENT: Record<"eth" | "sol" | "bnb", string> = {
  eth: "border-[rgba(85,124,242,0.55)] shadow-[0_0_24px_rgba(85,124,242,0.12)]",
  sol: "border-[rgba(162,60,249,0.55)] shadow-[0_0_24px_rgba(162,60,249,0.12)]",
  bnb: "border-[rgba(241,185,44,0.55)] shadow-[0_0_24px_rgba(241,185,44,0.12)]",
};

function RootLayout() {
  return (
    <div className="min-h-screen pb-28 text-[var(--color-foreground)]">
      <Outlet />
    </div>
  );
}

function IndexPage() {
  const locale: Locale = "en";
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 border border-[rgba(0,240,255,0.45)] bg-[rgba(0,240,255,0.08)] px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--color-neon-cyan)] shadow-[0_0_18px_rgba(0,240,255,0.15)]">
          {t(locale, "index.pill")}
        </div>
        <h1 className="text-[clamp(28px,5vw,40px)] font-black leading-[1.12] tracking-[-0.02em] [text-shadow:0_0_24px_rgba(0,240,255,0.25)]">
          {t(locale, "index.title")}
        </h1>
        <p className="max-w-[56ch] text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">
          {t(locale, "index.subtitle")}
        </p>
        <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
          {t(locale, "common.publicOnly")}
        </p>
      </header>

      <ul className="grid gap-4">
        {DEMO_CATALOG.map((d) => (
          <li key={d.slug} className={`panel-neon p-5 ${ACCENT[d.accent]}`}>
            <div className="relative z-[1] space-y-3">
              <h2 className="text-[22px] font-black tracking-tight">{t(locale, d.titleKey)}</h2>
              <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                {t(locale, d.blurbKey)}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to="/$slug/$locale/"
                  params={{ slug: d.slug, locale: "en" }}
                  className="inline-flex min-h-[44px] items-center border border-[rgba(0,240,255,0.55)] bg-[rgba(0,240,255,0.12)] px-5 font-bold text-[var(--color-neon-cyan)] hover:brightness-110"
                >
                  {t(locale, "index.openEn")}
                </Link>
                <Link
                  to="/$slug/$locale/"
                  params={{ slug: d.slug, locale: "zh" }}
                  className="inline-flex min-h-[44px] items-center border border-[rgba(255,43,214,0.45)] bg-[rgba(255,43,214,0.1)] px-5 font-bold text-white hover:brightness-110"
                >
                  {t(locale, "index.openZh")}
                </Link>
                <a
                  href={d.stackblitz}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center border border-[var(--color-line)] bg-[var(--color-panel)] px-4 font-mono text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.35)]"
                >
                  StackBlitz
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
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
  const blogUrl = locale === "zh" ? meta.blogZh : meta.blogEn;

  return (
    <>
      <div className="border-b border-[var(--color-line)] bg-[rgba(10,10,16,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <Link
            to="/"
            className="font-mono text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-neon-cyan)] hover:underline"
          >
            ← {t(locale, "shell.back")}
          </Link>
          <span className="text-[var(--color-line)]">|</span>
          <div className="inline-flex border border-[var(--color-line)] bg-[var(--color-panel)] p-0.5">
            <Link
              to="/$slug/$locale/"
              params={{ slug, locale: "en" }}
              className={
                locale === "en"
                  ? "bg-[rgba(255,43,214,0.15)] px-3 py-1.5 font-mono text-xs font-extrabold text-white shadow-[inset_0_0_0_1px_rgba(255,43,214,0.6)]"
                  : "px-3 py-1.5 font-mono text-xs font-bold text-[var(--color-muted-foreground)]"
              }
            >
              EN
            </Link>
            <Link
              to="/$slug/$locale/"
              params={{ slug, locale: "zh" }}
              className={
                locale === "zh"
                  ? "bg-[rgba(255,43,214,0.15)] px-3 py-1.5 font-mono text-xs font-extrabold text-white shadow-[inset_0_0_0_1px_rgba(255,43,214,0.6)]"
                  : "px-3 py-1.5 font-mono text-xs font-bold text-[var(--color-muted-foreground)]"
              }
            >
              中文
            </Link>
          </div>
          <a
            href={meta.stackblitz}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] hover:text-[var(--color-neon-cyan)]"
          >
            {t(locale, "shell.stackblitz")}
          </a>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {slug === "anoncoin-rh-launch-listen" && <AnoncoinDemo locale={locale} />}
        {slug === "openlaunch-base-eth-subscribe" && <OpenLaunchDemo locale={locale} />}
        {slug === "equifold-multi-market-listen" && <EquifoldDemo locale={locale} />}
      </main>
      <DemoCta
        title={t(locale, meta.titleKey)}
        blogUrl={blogUrl}
        readLabel={t(locale, "shell.readGuide")}
        pricingLabel={t(locale, "shell.pricing")}
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
    if (!isLocale(params.locale) || !getDemo(params.slug)) {
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
