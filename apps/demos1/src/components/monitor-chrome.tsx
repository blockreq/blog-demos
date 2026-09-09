import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { type ConnStatus, cn } from "@blockreq/ui";
import { toFeelState } from "../lib/ui-state";
import {
  ageMs,
  freshnessKind,
  FRESH_MS,
  relativeFreshLabel,
  updatedFreshLabel,
  type FreshnessKind,
} from "../lib/freshness";

const PRICING = "https://blockreq.com/pricing";
const SITE = "https://blockreq.com/";

function liveVariant(kind: FreshnessKind): "on" | "warn" | "off" {
  if (kind === "fresh") return "on";
  if (kind === "warming") return "warn";
  if (kind === "stale") return "warn";
  return "off";
}

function Sparkline({ live, tickAt }: { live: boolean; tickAt?: number | null }) {
  const [pts, setPts] = useState(() => [14, 12, 13, 9, 11, 6, 8, 4]);
  useEffect(() => {
    if (!live || !tickAt) return;
    setPts((prev) => {
      const next = prev.slice(1);
      const base = 4 + Math.floor(Math.random() * 11);
      next.push(Math.max(2, Math.min(16, base)));
      return next;
    });
  }, [live, tickAt]);
  const points = pts
    .map((y, i) => `${(i * 56) / Math.max(pts.length - 1, 1)},${y}`)
    .join(" ");
  return (
    <svg
      className={cn("tb-sparkline", live && "on")}
      viewBox="0 0 56 18"
      aria-hidden
      focusable="false"
    >
      <polyline points={points} />
    </svg>
  );
}

export function LivePill({
  live,
  locale,
  connecting,
  lastUpdateAt,
}: {
  live: boolean;
  locale: Locale;
  connecting?: boolean;
  lastUpdateAt?: number | null;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live && !connecting) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [live, connecting]);

  const kind = freshnessKind({ live, connecting, lastUpdateAt });
  const variant = liveVariant(kind);
  const label =
    kind === "offline"
      ? t(locale, "shell.offline")
      : kind === "stale"
        ? t(locale, "shell.stale")
        : kind === "warming" && connecting
          ? t(locale, "state.connecting")
          : t(locale, "shell.live");

  return (
    <div
      className={cn("tb-live-pill", variant === "on" && "on", variant === "warn" && "warn")}
      title={lastUpdateAt ? updatedFreshLabel(locale, lastUpdateAt) : undefined}
      data-fresh={kind}
    >
      <span className="dot" />
      <span>{label}</span>
    </div>
  );
}

function ConnState({
  locale,
  feel,
}: {
  locale: Locale;
  feel: "idle" | "connecting" | "listening" | "hit";
}) {
  const key =
    feel === "idle"
      ? "state.idle"
      : feel === "connecting"
        ? "state.connecting"
        : feel === "listening"
          ? "state.listening"
          : "state.hit";
  return (
    <div className="tb-conn" data-state={feel === "idle" ? "idle" : feel}>
      <span className="dot" />
      <span>{t(locale, key)}</span>
    </div>
  );
}

export function FreshnessChip({
  locale,
  at,
  live,
  className,
}: {
  locale: Locale;
  at?: number | null;
  live?: boolean;
  className?: string;
}) {
  const [, tick] = useState(0);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!at) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 750);
    return () => window.clearTimeout(id);
  }, [at]);
  if (!at) {
    return (
      <span className={cn("freshness-stamp", className)} data-live={live ? "true" : undefined}>
        <span>{t(locale, "shell.freshStamp")}</span>
        &nbsp;
        <span className="age-live">{locale === "zh" ? "暂无" : "n/a"}</span>
      </span>
    );
  }
  const rel = relativeFreshLabel(locale, at);
  const stale = !!live && ageMs(at) > FRESH_MS;
  return (
    <span
      className={cn(
        "freshness-stamp",
        flash && "flash refresh-flash",
        stale && "freshness-stamp-stale",
        className
      )}
      data-live={live ? "true" : undefined}
      data-stale={stale ? "true" : undefined}
      title={new Date(at).toISOString()}
    >
      <span>{t(locale, "shell.freshStamp")}</span>
      &nbsp;
      <span className={cn("age-live", rel.just && "just")}>{rel.text}</span>
    </span>
  );
}

export function LocaleToggle({
  locale,
  slug,
  mode = "links",
  onChange,
}: {
  locale: Locale;
  slug?: string;
  mode?: "links" | "catalog";
  onChange?: (locale: Locale) => void;
}) {
  if (mode === "catalog") {
    return (
      <div className="tb-lang" role="group" aria-label={t(locale, "shell.locale")}>
        <button
          type="button"
          aria-pressed={locale === "zh"}
          onClick={() => onChange?.("zh")}
        >
          中文
        </button>
        <button
          type="button"
          aria-pressed={locale === "en"}
          onClick={() => onChange?.("en")}
        >
          EN
        </button>
      </div>
    );
  }
  if (!slug) return null;
  return (
    <div className="tb-lang" role="group" aria-label={t(locale, "shell.locale")}>
      <Link
        to="/$slug/$locale/"
        params={{ slug, locale: "zh" }}
        aria-pressed={locale === "zh"}
        className={cn(locale === "zh" && "is-active")}
      >
        中文
      </Link>
      <Link
        to="/$slug/$locale/"
        params={{ slug, locale: "en" }}
        aria-pressed={locale === "en"}
        className={cn(locale === "en" && "is-active")}
      >
        EN
      </Link>
    </div>
  );
}

/**
 * Locked product top bar (full-width) — match demos1-feel-baseline.
 * L→R: Back+title+DEMO DATA | LIVE+conn+fresh+stream+spark | PUBLIC·Free 3M+Sign up | Blog+Site | ZH/EN
 */
export function MonitorChrome({
  locale,
  title,
  status,
  hasHit,
  slug,
  tag,
  trailing,
  localeMode = "links",
  onLocaleChange,
  lastUpdateAt,
  blogUrl,
  siteUrl = SITE,
}: {
  locale: Locale;
  title: string;
  status: ConnStatus;
  hasHit?: boolean;
  slug?: string;
  tag?: string;
  trailing?: ReactNode;
  localeMode?: "links" | "catalog";
  onLocaleChange?: (locale: Locale) => void;
  lastUpdateAt?: number | null;
  blogUrl?: string;
  siteUrl?: string;
}) {
  const feel = toFeelState(status, !!hasHit);
  const live = feel === "listening" || feel === "hit";
  const connecting = feel === "connecting";
  const streaming = live || connecting;
  const blogHref = blogUrl || "https://blockreq.com/blog";

  const dataState = useMemo(() => {
    if (feel === "hit") return "hit";
    if (feel === "listening") return "listening";
    if (feel === "connecting") return "connecting";
    return "idle";
  }, [feel]);

  return (
    <header
      className={cn("topbar", streaming && "is-live")}
      data-state={dataState}
      aria-label="Product chrome"
    >
      {/* [nav + title + DEMO DATA] */}
      <div className="tb-group tb-nav">
        {slug ? (
          <Link to="/" className="tb-back" title={t(locale, "shell.back")} aria-label={t(locale, "shell.back")}>
            ‹
          </Link>
        ) : (
          <span className="tb-mark" aria-hidden />
        )}
        <div className="tb-brand">
          <strong className="tb-title">{title}</strong>
          {tag ? <span className="tb-tag-muted">{tag}</span> : null}
        </div>
        <span className="tb-demo-tag">{t(locale, "shell.demoData")}</span>
      </div>

      <span className="tb-sep" aria-hidden />

      {/* [LIVE + conn + freshness + streaming + sparkline] */}
      <div className="tb-group tb-live">
        <LivePill live={live} locale={locale} connecting={connecting} lastUpdateAt={lastUpdateAt} />
        <ConnState locale={locale} feel={feel} />
        <FreshnessChip locale={locale} at={lastUpdateAt} live={streaming} />
        <span className={cn("tb-stream", streaming && "on")}>
          <span className="dot" />
          <span>{t(locale, "shell.streaming")}</span>
        </span>
        <Sparkline live={streaming} tickAt={lastUpdateAt} />
      </div>

      <span className="tb-sep" aria-hidden />

      {/* [PUBLIC · Free 3M + Sign up] — Free 3M is post-signup quota; chip + CTA → pricing */}
      <div className="tb-group tb-public">
        <a
          className="tb-public-chip"
          href={PRICING}
          target="_blank"
          rel="noopener noreferrer"
          title={t(locale, "shell.quotaAfter")}
        >
          <span className="tag">{t(locale, "shell.publicTag")}</span>
          <span aria-hidden>·</span>
          <span>{t(locale, "shell.publicFree")}</span>
        </a>
        <a
          className="tb-signup"
          href={PRICING}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t(locale, "shell.signup")}
        </a>
      </div>

      <span className="tb-sep" aria-hidden />

      {/* [Blog · Site] */}
      <div className="tb-group tb-links">
        <a href={blogHref} target="_blank" rel="noopener noreferrer">
          {t(locale, "shell.blog")}
        </a>
        <span className="dot-sep" aria-hidden>
          ·
        </span>
        <a href={siteUrl} target="_blank" rel="noopener noreferrer">
          {t(locale, "shell.site")}
        </a>
        {trailing}
      </div>

      <div className="tb-spacer" />

      {/* [ZH/EN] */}
      <div className="tb-group">
        <LocaleToggle locale={locale} slug={slug} mode={localeMode} onChange={onLocaleChange} />
      </div>
    </header>
  );
}
