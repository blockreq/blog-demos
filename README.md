# BlockReq blog demos

Runnable browser demos for BlockReq blog posts.

## Open in StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/solana-new-mint

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-open-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-volume-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-whale-fomo

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-position-watchtower

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-timed-launch-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-new-pairs-agent-feed

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-thin-liquidity-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-stock-pairs-launch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-bridge-rotation-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/arc-bridge-launch-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-kol-wallet-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-gas-heat-radar

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/anoncoin-rh-launch-listen

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/openlaunch-base-eth-subscribe

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/equifold-multi-market-listen

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/brew-bnb-double-pair-listen/src/main.tsx&startScript=dev:brew-bnb-double-pair-listen&ctl=1

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/arbitrum-rwa-flow-listen/src/main.tsx&startScript=dev:arbitrum-rwa-flow-listen&ctl=1

Click Run after open (ctl=1).

### React + viem shells (Brew / Arb)

These two open the **repo root** (pnpm workspace) with `file=` pointing at the Vite entry — not a vanilla `examples/<slug>/` single-file HTML twin.

| Demo | StackBlitz (root + file) |
| --- | --- |
| Brew BNB double-pair | `tree/main` + `examples/brew-bnb-double-pair-listen/src/main.tsx` · `startScript=dev:brew-bnb-double-pair-listen` |
| Arb RWA flow | `tree/main` + `examples/arbitrum-rwa-flow-listen/src/main.tsx` · `startScript=dev:arbitrum-rwa-flow-listen` |

```bash
pnpm install
pnpm dev:brew-bnb-double-pair-listen
pnpm dev:arbitrum-rwa-flow-listen
pnpm build:examples-brew-arb
```

## Public-only warning

No API keys in runnable code. Defaults to BlockReq public WSS/HTTPS. See docs.blockreq.com/build/public-endpoints/

## Examples

- examples/solana-new-mint
- examples/robinhood-open-watch
- examples/robinhood-volume-watch
- examples/robinhood-whale-fomo
- examples/robinhood-position-watchtower
- examples/robinhood-timed-launch-watch
- examples/robinhood-new-pairs-agent-feed
- examples/robinhood-thin-liquidity-watch
- examples/robinhood-stock-pairs-launch
- examples/robinhood-bridge-rotation-watch
- examples/arc-bridge-launch-watch
- examples/robinhood-kol-wallet-watch
- examples/robinhood-gas-heat-radar
- examples/anoncoin-rh-launch-listen
- examples/openlaunch-base-eth-subscribe
- examples/equifold-multi-market-listen
- examples/brew-bnb-double-pair-listen (Vite+React+viem+@blockreq/ui)
- examples/arbitrum-rwa-flow-listen (Vite+React+viem+@blockreq/ui)

## Hosted demos1 (Cloudflare Worker + static assets)

Single Worker (`blockreq-demos1`) serves many demos under `/demos1/`.

| Demo | Paths |
| --- | --- |
| Anoncoin RH launch listen | `/demos1/anoncoin-rh-launch-listen/en/` · `/zh/` |
| OpenLaunch Base eth_subscribe | `/demos1/openlaunch-base-eth-subscribe/en/` · `/zh/` |
| Equifold multi-market listen | `/demos1/equifold-multi-market-listen/en/` · `/zh/` |
| Index | `/demos1/` |

Stack: **React + TanStack Router/Query + shadcn-style UI + viem**. No Next.js. Browser-only RPC — the Worker serves assets + CSP headers and does **not** proxy WSS/subscriptions.

### Local

```bash
pnpm install
pnpm --filter @blockreq/demos1 dev          # Vite at /demos1/
pnpm --filter @blockreq/demos1 build
pnpm --filter @blockreq/demos1 wrangler:dev # build + wrangler preview
```

### Production route (Boss / gitops)

Wire zone route `blockreq.com/demos1*` → Worker `blockreq-demos1` later. Local `wrangler dev` / Workers preview is enough for this PR.

### Deploy (optional, secrets gated)

Workflow `.github/workflows/demos1.yml`:
- **pull_request / push**: build only (no secrets required to merge)
- **workflow_dispatch** deploy: needs `CLOUDFLARE_API_TOKEN` + `CF_ACCOUNT_ID` (or `CLOUDFLARE_ACCOUNT_ID`)

See `docs/BOSS-DEMOS1-WORKER.md`.

StackBlitz twins stay under `examples/`. Brew/Arb are React+viem workspace shells (open repo root); other slugs may still be single-file HTML until converted.

## License

MIT
