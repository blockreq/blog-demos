# Arbitrum RWA flow listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`ArbitrumRwaFlowDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/arbitrum-rwa-flow-listen.tsx` (no vanilla HTML/JS twin).

Browser demo: `eth_subscribe` → RWA Transfer / mint + optional PairCreated on Arb → large stable/RWA flow cards.

## Endpoints (public only)

- Chain: Arbitrum One `chainId = 0xa4b1` (42161)
- WSS: `wss://arbitrum-one-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://arbitrum-one-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz (repo root + file)

Open the **monorepo root** (workspace packages) with the example entry file:

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/arbitrum-rwa-flow-listen/src/main.tsx&startScript=dev:arbitrum-rwa-flow-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/arbitrum-rwa-flow-listen/src/main.tsx
startScript: dev:arbitrum-rwa-flow-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-arbitrum-rwa-flow-listen dev
pnpm --filter @blockreq/ex-arbitrum-rwa-flow-listen build
pnpm --filter @blockreq/ex-arbitrum-rwa-flow-listen typecheck
```
