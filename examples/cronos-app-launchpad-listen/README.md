# Cronos app launchpad listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`CronosAppLaunchpadDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/cronos-app-launchpad-listen.tsx` (no vanilla HTML/JS twin).

PairCreated on pasteable LAUNCHPAD_FACTORY → narrow Mint + Transfer on decoded pair (first-liquidity).

## Endpoints (public only)

- Chain: Cronos `chainId = 0x19 (25)`
- WSS: `wss://cronos-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://cronos-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/cronos-app-launchpad-listen/src/main.tsx&startScript=dev:cronos-app-launchpad-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/cronos-app-launchpad-listen/src/main.tsx
startScript: dev:cronos-app-launchpad-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-cronos-app-launchpad-listen dev
pnpm --filter @blockreq/ex-cronos-app-launchpad-listen build
pnpm --filter @blockreq/ex-cronos-app-launchpad-listen typecheck
```
