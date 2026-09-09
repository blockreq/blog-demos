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
};
