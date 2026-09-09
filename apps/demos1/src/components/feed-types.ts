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
};
