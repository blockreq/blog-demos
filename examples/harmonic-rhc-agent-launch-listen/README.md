# HARMONIC RHC agent launch listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`HarmonicRhcAgentLaunchDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/harmonic-rhc-agent-launch-listen.tsx` (no vanilla HTML/JS twin).

Pons V2 TokenLaunched primary; optional Hookr / PoolManager Initialize. Paste HARMONIC token/vault when known.

## Endpoints (public only)

- Chain: Robinhood Chain `chainId = 0x1237 (4663)`
- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/harmonic-rhc-agent-launch-listen/src/main.tsx&startScript=dev:harmonic-rhc-agent-launch-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/harmonic-rhc-agent-launch-listen/src/main.tsx
startScript: dev:harmonic-rhc-agent-launch-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-harmonic-rhc-agent-launch-listen dev
pnpm --filter @blockreq/ex-harmonic-rhc-agent-launch-listen build
pnpm --filter @blockreq/ex-harmonic-rhc-agent-launch-listen typecheck
```
