# Longshot Base football market listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`LongshotBaseFootballMarketDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/longshot-base-football-market-listen.tsx` (no vanilla HTML/JS twin).

Football create / trade / resolve timeline. All factory/topics empty by default — paste when known. Product: https://longshot.xyz

## Endpoints (public only)

- Chain: Base `chainId = 0x2105 (8453)`
- WSS: `wss://base-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://base-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero publicnode. Zero invented Longshot factory addresses.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/longshot-base-football-market-listen/src/main.tsx&startScript=dev:longshot-base-football-market-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/longshot-base-football-market-listen/src/main.tsx
startScript: dev:longshot-base-football-market-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-longshot-base-football-market-listen dev
pnpm --filter @blockreq/ex-longshot-base-football-market-listen build
pnpm --filter @blockreq/ex-longshot-base-football-market-listen typecheck
```
