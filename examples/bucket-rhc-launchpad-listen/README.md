# Bucket RHC launchpad listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`BucketRhcLaunchpadListenDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/bucket-rhc-launchpad-listen.tsx` (no vanilla HTML/JS twin).

Factory `Launched` radar (token / creator / curve / founding / id); optional Graduated follow on selected token.

## Endpoints (public only)

- Chain: Robinhood Chain `chainId = 0x1237 (4663)`
- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero Solana / Arc / publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/bucket-rhc-launchpad-listen/src/main.tsx&startScript=dev:bucket-rhc-launchpad-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/bucket-rhc-launchpad-listen/src/main.tsx
startScript: dev:bucket-rhc-launchpad-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-bucket-rhc-launchpad-listen dev
pnpm --filter @blockreq/ex-bucket-rhc-launchpad-listen build
pnpm --filter @blockreq/ex-bucket-rhc-launchpad-listen typecheck
```
