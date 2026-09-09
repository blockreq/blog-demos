import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  redirect,
} from "@tanstack/react-router";
import { DEMO_META, getDemo, isLocale, t, type Locale } from "@blockreq/i18n";
import { DemoCta } from "@blockreq/ui";
import { AnoncoinDemo } from "./demos/anoncoin-rh-launch-listen";
import { OpenLaunchDemo } from "./demos/openlaunch-base-eth-subscribe";
import { EquifoldDemo } from "./demos/equifold-multi-market-listen";

function RootLayout() {
  return (
    <div className="min-h-screen bg-white pb-28">
      <Outlet />
    </div>
  );
}

function IndexPage() {
  const locale: Locale = "en";
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t(locale, "index.title")}
        </h1>
        <p className="text-base text-slate-600 sm:text-lg">{t(locale, "index.subtitle")}</p>
        <p className="text-sm text-slate-500">{t(locale, "common.publicOnly")}</p>
      </header>
      <ul className="space-y-4">
        {DEMO_META.map((d) => (
          <li key={d.slug} className="rounded-2xl border-2 border-slate-200 p-5 shadow-sm">
            <h2 className="text-xl font-bold">{t(locale, d.titleKey)}</h2>
            <p className="mt-1 text-slate-600">{t(locale, d.blurbKey)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/$slug/$locale/"
                params={{ slug: d.slug, locale: "en" }}
                className="inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700"
              >
                EN
              </Link>
              <Link
                to="/$slug/$locale/"
                params={{ slug: d.slug, locale: "zh" }}
                className="inline-flex h-11 items-center rounded-xl border-2 border-slate-200 px-5 font-bold text-slate-800 hover:bg-slate-50"
              >
                中文
              </Link>
              <a
                href={d.stackblitz}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-xl border-2 border-slate-200 px-5 font-bold text-slate-600 hover:bg-slate-50"
              >
                StackBlitz
              </a>
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
        <Link to="/" className="text-blue-600 underline">
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
      <div className="border-b bg-slate-50">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <Link to="/" className="font-semibold text-blue-700 hover:underline">
            ← {t(locale, "shell.back")}
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            to="/$slug/$locale/"
            params={{ slug, locale: "en" }}
            className={locale === "en" ? "font-bold" : "text-slate-600 hover:underline"}
          >
            EN
          </Link>
          <Link
            to="/$slug/$locale/"
            params={{ slug, locale: "zh" }}
            className={locale === "zh" ? "font-bold" : "text-slate-600 hover:underline"}
          >
            中文
          </Link>
          <a
            href={meta.stackblitz}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-slate-600 hover:underline"
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
      <DemoCta title={t(locale, meta.titleKey)} blogUrl={blogUrl} />
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
