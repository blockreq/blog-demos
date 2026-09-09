/**
 * App-local re-export of the demos1 catalog.
 * Source of truth lives in `@blockreq/i18n` so index + routes share one list.
 * Layout is selected per slug from `layout` — catalog grows over time.
 */
export {
  DEMO_CATALOG,
  DEMO_META,
  getDemo,
  publishedDemos,
  type DemoSlug,
  type DemoLayout,
} from "@blockreq/i18n";
