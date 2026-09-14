/** Freshness bands for LIVE pill + relative age labels. */
import { t, type Locale } from "@blockreq/i18n";

export type FreshnessKind = "fresh" | "warming" | "stale" | "offline";

/** Visual warn when lastUpdate drifts past ~6s; STALE after ~10s. */
export const FRESH_MS = 6_000;
export const WARM_MS = 10_000;

export function ageMs(at: number | null | undefined, now = Date.now()) {
  if (!at || at <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - at);
}

export function freshnessKind(opts: {
  live: boolean;
  connecting?: boolean;
  lastUpdateAt?: number | null;
  now?: number;
}): FreshnessKind {
  if (opts.connecting) return "warming";
  if (!opts.live) return "offline";
  const age = ageMs(opts.lastUpdateAt, opts.now);
  if (age <= FRESH_MS) return "fresh";
  if (age <= WARM_MS) return "warming";
  return "stale";
}

/** Relative age — Just now → Ns ago / Nm ago (ticks every second). */
export function relativeFreshLabel(
  locale: Locale,
  at: number | null | undefined,
  now = Date.now()
): { text: string; just: boolean } {
  const age = ageMs(at, now);
  if (!Number.isFinite(age)) {
    return { text: t(locale, "shell.freshNa"), just: false };
  }
  const s = Math.floor(age / 1000);
  if (s < 2) return { text: t(locale, "shell.freshJustNow"), just: true };
  if (s < 60) return { text: t(locale, "shell.freshAgo").replace("{n}", String(s)), just: false };
  const m = Math.floor(s / 60);
  return { text: t(locale, "shell.freshAgoMin").replace("{n}", String(m)), just: false };
}

export function updatedFreshLabel(
  locale: Locale,
  at: number | null | undefined,
  now = Date.now()
): string {
  const rel = relativeFreshLabel(locale, at, now).text;
  return t(locale, "shell.freshUpdated").replace("{rel}", rel);
}
