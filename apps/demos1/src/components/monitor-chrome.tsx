import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import {
  Badge,
  StatusPill,
  ToggleGroup,
  ToggleGroupItem,
  type ConnStatus,
  cn,
} from "@blockreq/ui";
import { toFeelState } from "../lib/ui-state";
import {
  freshnessKind,
  relativeFreshLabel,
  updatedFreshLabel,
  type FreshnessKind,
} from "../lib/freshness";

function liveVariant(kind: FreshnessKind): "live" | "warn" | "offline" {
  if (kind === "fresh") return "live";
  if (kind === "warming") return "warn";
  return "offline";
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
  const label =
    kind === "offline"
      ? t(locale, "shell.offline")
      : kind === "stale"
        ? t(locale, "shell.stale")
        : kind === "warming" && connecting
          ? t(locale, "state.connecting")
          : t(locale, "shell.live");

  return (
    <Badge
      variant={liveVariant(kind)}
      className={cn("gap-2", kind === "fresh" && "live-pill-pulse")}
      title={lastUpdateAt ? updatedFreshLabel(locale, lastUpdateAt) : undefined}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]",
          (kind === "fresh" || kind === "warming") && "dot-pulse"
        )}
      />
      {label}
    </Badge>
  );
}

function localeBtnClass(active: boolean) {
  return cn(
    "inline-flex h-8 items-center justify-center border px-2.5 font-mono text-xs font-bold transition-colors",
    active
      ? "border-[rgba(0,240,255,0.55)] bg-[rgba(0,240,255,0.12)] text-[var(--color-neon-cyan)] shadow-[inset_0_0_0_1px_rgba(0,240,255,0.2)]"
      : "border-[var(--color-line)] bg-transparent text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.35)] hover:text-[var(--color-neon-cyan)]"
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
      <ToggleGroup
        type="single"
        value={locale}
        onValueChange={(v) => {
          if (v === "en" || v === "zh") onChange?.(v);
        }}
        variant="outline"
        size="sm"
        aria-label={t(locale, "shell.locale")}
      >
        <ToggleGroupItem value="zh" aria-label="中文">
          中文
        </ToggleGroupItem>
        <ToggleGroupItem value="en" aria-label="EN">
          EN
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }
  if (!slug) return null;
  return (
    <div className="inline-flex gap-1" role="group" aria-label={t(locale, "shell.locale")}>
      <Link to="/$slug/$locale/" params={{ slug, locale: "zh" }} className={localeBtnClass(locale === "zh")}>
        中文
      </Link>
      <Link to="/$slug/$locale/" params={{ slug, locale: "en" }} className={localeBtnClass(locale === "en")}>
        EN
      </Link>
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
    const id = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(id);
  }, [at]);
  if (!at) return null;
  const rel = relativeFreshLabel(locale, at);
  return (
    <span
      className={cn(
        "freshness-stamp",
        flash && "flash refresh-flash",
        className
      )}
      data-live={live ? "true" : undefined}
      title={new Date(at).toISOString()}
    >
      <span>{t(locale, "shell.freshStamp")}</span>
      <span className={cn("age-live", rel.just && "just")}>{rel.text}</span>
    </span>
  );
}

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
  /** Epoch ms of last live event / heartbeat — drives LIVE freshness + 「刚刚」. */
  lastUpdateAt?: number | null;
}) {
  const feel = toFeelState(status, !!hasHit);
  const live = feel === "listening" || feel === "hit";
  const connecting = feel === "connecting";
  const statusKey =
    feel === "idle"
      ? "state.idle"
      : feel === "connecting"
        ? "state.connecting"
        : feel === "listening"
          ? "state.listening"
          : "state.hit";

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-[rgba(10,10,16,0.92)] px-3 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        {slug ? (
          <Link
            to="/"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-neon-cyan)] hover:underline"
          >
            ← {t(locale, "shell.back")}
          </Link>
        ) : (
          <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff,#00F0FF_40%,#FF2BD6_75%)] shadow-[0_0_12px_rgba(0,240,255,0.55)]" />
        )}
        <strong className="truncate text-base font-black tracking-tight sm:text-[17px]">{title}</strong>
        {tag ? (
          <span className="hidden font-mono text-[10px] font-bold tracking-[0.08em] text-[var(--color-muted-foreground)] sm:inline">
            {tag}
          </span>
        ) : null}
      </div>
      <LivePill live={live} locale={locale} connecting={connecting} lastUpdateAt={lastUpdateAt} />
      <StatusPill status={feel} label={t(locale, statusKey)} />
      <FreshnessChip locale={locale} at={lastUpdateAt} live={live || connecting} className="hidden sm:inline" />
      <Badge variant="secondary">{t(locale, "shell.demoData")}</Badge>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {trailing}
        <LocaleToggle locale={locale} slug={slug} mode={localeMode} onChange={onLocaleChange} />
      </div>
    </header>
  );
}
