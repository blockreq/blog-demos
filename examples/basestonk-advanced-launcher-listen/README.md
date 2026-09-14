# BaseStonk AdvancedLauncherV2 AdvancedLaunched listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`BasestonkAdvancedLauncherListenDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/basestonk-advanced-launcher-listen.tsx` (no vanilla HTML/JS twin).

AdvancedLauncherV2 `AdvancedLaunched` open-card radar (token / creator / poolId / pairToken / sqrtPriceX96 / taxBps / burnBps / liquidityBps / payees; optional RewardsEnabled).

## Endpoints (public only)

- Chain: Base `chainId = 0x2105 (8453)`
- WSS: `wss://base-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://base-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero Solana / Arc / Robinhood / publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/basestonk-advanced-launcher-listen/src/main.tsx&startScript=dev:basestonk-advanced-launcher-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/basestonk-advanced-launcher-listen/src/main.tsx
startScript: dev:basestonk-advanced-launcher-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-basestonk-advanced-launcher-listen dev
pnpm --filter @blockreq/ex-basestonk-advanced-launcher-listen build
pnpm --filter @blockreq/ex-basestonk-advanced-launcher-listen typecheck
```
