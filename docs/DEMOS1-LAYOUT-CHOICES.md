# demos1 layout choices (2026-09-12 brew BNB + arb RWA)

Product shells are selected per slug via `DEMO_CATALOG[].layout` (not a feel tab).

| Slug | Layout | Why |
| --- | --- | --- |
| `brew-bnb-double-pair-listen` | **launch-feed** | Continuous twin-progress / twinReady PairCreated tape + sticky card (launchId/token/capUsd/poolA/poolB). single-focus would hide the twin grouping tape. |
| `arbitrum-rwa-flow-listen` | **launch-feed** | Parallel mint / Transfer / PairCreated flow panel with kind chips — same family as Base stock-swap whitelist feeds. |

Both demos reuse MonitorChrome (centered header, BlockReq RPC · 注册每月免费 3M 请求 CTA), editable RPC bar prefilled with **live** BlockReq BSC / Arbitrum One public HTTPS/WSS, and addr hover via shared chrome/feed components. Factory / RWA / stable lists use labeled editable samples — RPC defaults are live public only (zero Solana / fake endpoints).

---

# demos1 layout choices (2026-09-11 sol changelog + anza agave)

Product shells are selected per slug via `DEMO_CATALOG[].layout` (not a feel tab).

| Slug | Layout | Why |
| --- | --- | --- |
| `solana-changelog-subscription-filter` | **launch-feed** | Continuous filtered logsSubscribe tape + sticky hit (program/filterKey/upgradeTag/signature/slot) + upgrade-window alert chips. single-focus would hide the filter tape. |
| `anza-agave-rpc-compat-watch` | **launch-feed** | Tip/slot probe + pre/post diff stream with sticky compat card; COMPAT_CHECKS checklist lives in settings. single-focus would collapse the probe tape into a one-shot stage. |

Both demos reuse MonitorChrome (centered header, BlockReq RPC · 注册每月免费 3M 请求 CTA), editable RPC bar, and addr hover via shared chrome/feed components. Empty `PUBLIC_ENDPOINTS.solana` placeholders from #26 — never hardcode a live `*.blockreq.com` Solana public URL.

---

# demos1 layout choices (2026-09-11 pump + monad)

Product shells are selected per slug via `DEMO_CATALOG[].layout` (not a feel tab).

| Slug | Layout | Why |
| --- | --- | --- |
| `pumpfun-custom-pairs-listen` | **launch-feed** | Continuous Create/CustomPair stream + sticky latest hit; same family as stock/eco/any-quote whitelist feeds. single-focus would hide the quote-tag tape. |
| `monad-o1-launchpad-listen` | **launch-feed** | Day-0 Factory PairCreated + optional early Swap density — same shell as `arc-mainnet-day1-listen` / Base spike. |

Both demos reuse MonitorChrome (centered header, BlockReq RPC · 注册每月免费 3M 请求 CTA), editable RPC bar, and addr hover via shared chrome/feed components.
