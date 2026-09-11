# demos1 layout choices (2026-09-11 pump + monad)

Product shells are selected per slug via `DEMO_CATALOG[].layout` (not a feel tab).

| Slug | Layout | Why |
| --- | --- | --- |
| `pumpfun-custom-pairs-listen` | **launch-feed** | Continuous Create/CustomPair stream + sticky latest hit; same family as stock/eco/any-quote whitelist feeds. single-focus would hide the quote-tag tape. |
| `monad-o1-launchpad-listen` | **launch-feed** | Day-0 Factory PairCreated + optional early Swap density — same shell as `arc-mainnet-day1-listen` / Base spike. |

Both demos reuse MonitorChrome (centered header, BlockReq RPC · 注册每月免费 3M 请求 CTA), editable RPC bar, and addr hover via shared chrome/feed components.
