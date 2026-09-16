# Stonks Exchange StonkLauncher2 TokenLaunched listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`StonksExchangeBaseLauncherListenDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/stonks-exchange-base-launcher-listen.tsx` (no vanilla HTML/JS twin).

StonkLauncher2 `TokenLaunched` stock-quote open-card radar (token / tokenId / creator / quote / pool / fee / launchTick / totalSupply / feeLocker; optional TokenMetaSet + DevBuy). Distinct from BaseStonk AdvancedLauncherV2.

## Endpoints (public only)

- Chain: Base `chainId = 0x2105 (8453)`
- WSS: `wss://base-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://base-rpc.blockreq.com/v1/rpc/public`

Factory (proxy): `0x4714f6EC81639Ca59EEBE634490a4d8671DCe7B4`  
TokenLaunched topic0: `0x61f1eebe27442a95a99d94de30c81be127888456287e5bd9fbb5a6105e1aaad3`

No API keys in this repo. Zero Solana / Arc / Robinhood / publicnode. Never BaseStonk factory `0x74655F443D25c5d401a582c68dEA02ACd170E12f`.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/stonks-exchange-base-launcher-listen/src/main.tsx&startScript=dev:stonks-exchange-base-launcher-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/stonks-exchange-base-launcher-listen/src/main.tsx
startScript: dev:stonks-exchange-base-launcher-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-stonks-exchange-base-launcher-listen dev
pnpm --filter @blockreq/ex-stonks-exchange-base-launcher-listen build
pnpm --filter @blockreq/ex-stonks-exchange-base-launcher-listen typecheck
```
