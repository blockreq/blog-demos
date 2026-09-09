/** Freshness bands for LIVE pill + 「刚刚 / Ns 前」 labels. */
export type FreshnessKind = "fresh" | "warming" | "stale" | "offline";

export const FRESH_MS = 12_000;
export const WARM_MS = 30_000;

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

/** Relative age — 「刚刚」 / Just now → 「Ns 前」 / Ns ago (ticks every second). */
export function relativeFreshLabel(
  locale: "en" | "zh",
  at: number | null | undefined,
  now = Date.now()
): { text: string; just: boolean } {
  const age = ageMs(at, now);
  if (!Number.isFinite(age)) {
    return { text: locale === "zh" ? "暂无" : "n/a", just: false };
  }
  const s = Math.floor(age / 1000);
  if (s < 2) return { text: locale === "zh" ? "刚刚" : "Just now", just: true };
  if (s < 60) return { text: locale === "zh" ? `${s}s 前` : `${s}s ago`, just: false };
  const m = Math.floor(s / 60);
  return { text: locale === "zh" ? `${m}m 前` : `${m}m ago`, just: false };
}

export function updatedFreshLabel(
  locale: "en" | "zh",
  at: number | null | undefined,
  now = Date.now()
): string {
  const rel = relativeFreshLabel(locale, at, now).text;
  return locale === "zh" ? `更新于 ${rel}` : `Updated ${rel}`;
}
