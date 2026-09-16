# Flap BSC Portal TokenCreated listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`FlapBscPortalTokenCreatedListenDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/flap-bsc-portal-token-created-listen.tsx` (no vanilla HTML/JS twin).

Flap Portal `TokenCreated` open-card radar (token / creator / nonce / name / symbol / meta / ts; optional LaunchedToDEX). Distinct from brew-bnb-double-pair-listen.

## Endpoints (public only)

- Chain: BSC `chainId = 0x38 (56)`
- WSS: `wss://bsc-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://bsc-rpc.blockreq.com/v1/rpc/public`

Portal: `0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0`  
TokenCreated topic0: `0x504e7f360b2e5fe33cbaaae4c593bc55305328341bf79009e43e0e3b7f699603`  
Optional LaunchedToDEX topic0: `0x6e4f47630b8745b8cacbd44f42a8a33e7eea7cc08ef22fc7630f4f385784ff7d`

No API keys in this repo. Zero Solana / Arc / Monad / publicnode. Pancake V2 factory `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` is a hint chip only.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/flap-bsc-portal-token-created-listen/src/main.tsx&startScript=dev:flap-bsc-portal-token-created-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/flap-bsc-portal-token-created-listen/src/main.tsx
startScript: dev:flap-bsc-portal-token-created-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-flap-bsc-portal-token-created-listen dev
pnpm --filter @blockreq/ex-flap-bsc-portal-token-created-listen build
pnpm --filter @blockreq/ex-flap-bsc-portal-token-created-listen typecheck
```
