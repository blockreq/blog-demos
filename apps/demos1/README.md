# @blockreq/demos1

Vite + TanStack Router SPA under base path `/demos1/`, served by Cloudflare Worker `blockreq-demos1` (static assets + CSP).

## Routes

- `/demos1/`
- `/demos1/<slug>/en/`
- `/demos1/<slug>/zh/`

Slugs: `anoncoin-rh-launch-listen`, `openlaunch-base-eth-subscribe`, `equifold-multi-market-listen`.

## Browser-only RPC

All `eth_subscribe` / WSS traffic originates in the visitor browser to BlockReq public endpoints. This Worker never proxies RPC.

## Scripts

```bash
pnpm --filter @blockreq/demos1 dev
pnpm --filter @blockreq/demos1 build
pnpm --filter @blockreq/demos1 wrangler:dev
```
