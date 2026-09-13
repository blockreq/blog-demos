# Crossrate RHC FX launchpad listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`CrossrateRhcCurrencyLaunchListenDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/crossrate-rhc-currency-launch-listen.tsx` (no vanilla HTML/JS twin).

Launcher `TokenLaunched` FX radar (token / creator / quoteToken / currency / poolId / taxBps / supply / liquidity).

## Endpoints (public only)

- Chain: Robinhood Chain `chainId = 0x1237 (4663)`
- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero Solana / Arc / publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/crossrate-rhc-currency-launch-listen/src/main.tsx&startScript=dev:crossrate-rhc-currency-launch-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/crossrate-rhc-currency-launch-listen/src/main.tsx
startScript: dev:crossrate-rhc-currency-launch-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-crossrate-rhc-currency-launch-listen dev
pnpm --filter @blockreq/ex-crossrate-rhc-currency-launch-listen build
pnpm --filter @blockreq/ex-crossrate-rhc-currency-launch-listen typecheck
```
