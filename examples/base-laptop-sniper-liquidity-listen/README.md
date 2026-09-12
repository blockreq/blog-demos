# Base $LAPTOP liquidity detector

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`BaseLaptopSniperLiquidityDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/base-laptop-sniper-liquidity-listen.tsx` (no vanilla HTML/JS twin).

Technical detector: firstMint / swapBurst / holderConc / thinExit on pasteable TOKEN + PAIR_OR_POOL.

## Endpoints (public only)

- Chain: Base `chainId = 0x2105 (8453)`
- WSS: `wss://base-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://base-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/base-laptop-sniper-liquidity-listen/src/main.tsx&startScript=dev:base-laptop-sniper-liquidity-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/base-laptop-sniper-liquidity-listen/src/main.tsx
startScript: dev:base-laptop-sniper-liquidity-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-base-laptop-sniper-liquidity-listen dev
pnpm --filter @blockreq/ex-base-laptop-sniper-liquidity-listen build
pnpm --filter @blockreq/ex-base-laptop-sniper-liquidity-listen typecheck
```
