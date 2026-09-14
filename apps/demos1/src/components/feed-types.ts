export type FeedEvent = {
  id: string;
  kind: string;
  tags: string[];
  body: string;
  /** Short primary label for dense rows (pair / token / pool). */
  title?: string;
  address?: string;
  /** Counterparty / maker (e.g. Messier vault maker). */
  maker?: string;
  block?: number;
  tx?: string;
  chain?: string;
  at: number;
  /** Large focus metric (price, LP, volume, trade size). */
  metric?: string;
  metricLabel?: string;
  /** Secondary metric for diffs / volume. */
  metric2?: string;
  metric2Label?: string;
  /** Flash $RWA (or other) highlight on the sticky card. */
  highlight?: boolean;
  /** Deep links (pool UI, explorer tx). */
  links?: { label: string; href: string }[];
};

/** Fixture/seed markers — never show as UI badges. */
const NOISE_TAG_RE = /^(DEMO|FIXTURE|SEED|示意)$/i;

export function isNoiseTag(tag: string): boolean {
  return NOISE_TAG_RE.test(tag);
}

/** Tags safe to render as badges (filters DEMO/FIXTURE/SEED/示意). */
export function displayTags(tags: string[]): string[] {
  return tags.filter((tag) => !isNoiseTag(tag));
}

/** Bracketed or bare fixture markers in body/title/kind Meta lines. */
const BRACKET_LABEL_RE = /\[(?:DEMO|FIXTURE|SEED|示意)\]/gi;
const NOISE_SEGMENT_RE = /^(?:DEMO|FIXTURE|SEED|示意)$/i;
const LEADING_KIND_PREFIX_RE = /^(?:Demo|示意)\s+/i;

/**
 * Scrub DEMO/FIXTURE/SEED/示意 tokens from event body/title/kind text.
 * Handles bracketed DEMO/FIXTURE/SEED/示意, ·-separated bare tokens, and leading Demo/示意 prefixes.
 */
export function scrubDemoText(s: string): string {
  if (!s) return s;
  let out = s.replace(BRACKET_LABEL_RE, "");
  const parts = out
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !NOISE_SEGMENT_RE.test(p));
  out = parts.join(" · ");
  out = out.replace(LEADING_KIND_PREFIX_RE, "");
  out = out.replace(/\s*·\s*·\s*/g, " · ").replace(/\s{2,}/g, " ").trim();
  out = out.replace(/^(?:\s*·\s*)+|(?:\s*·\s*)+$/g, "").trim();
  return out;
}
