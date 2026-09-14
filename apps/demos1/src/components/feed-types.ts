export type FeedEvent = {
  id: string;
  kind: string;
  tags: string[];
  body: string;
  /** Short primary label for dense rows (pair / token / pool). */
  title?: string;
  address?: string;
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
