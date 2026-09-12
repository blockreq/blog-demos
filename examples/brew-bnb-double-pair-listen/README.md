# Brew BNB · double-pair listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`BrewBnbDoublePairDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/brew-bnb-double-pair-listen.tsx` (no vanilla HTML/JS twin).

Browser demo: `eth_subscribe` → Brew / Pancake-style Factory PairCreated → group twin pools by launch token + CAP_USD → 「双池进度」/「twinReady」cards.

On each hit:
- **Twin progress** — PairCreated; same launch token, pools `1/2`
- **Twin ready** — same token collected ≥2 pools (same-cap twin set)
- **Quote chip** — optional QUOTE_HINT match (WBNB / USDT / …)

Factory / CAP_USD / quote hints live in UI fields (demo stand-in for `BREW_FACTORY` / `CAP_USD` / `QUOTE_HINT` env). Default factory = PancakeSwap V2 on BSC — swap for live Brew launch factory when known.

## Endpoints (public only)

- Chain: BNB Smart Chain `chainId = 0x38` (56)
- WSS: `wss://bsc-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://bsc-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz (repo root + file)

Open the **monorepo root** (workspace packages) with the example entry file:

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/brew-bnb-double-pair-listen/src/main.tsx&startScript=dev:brew-bnb-double-pair-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/brew-bnb-double-pair-listen/src/main.tsx
startScript: dev:brew-bnb-double-pair-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-brew-bnb-double-pair-listen dev
pnpm --filter @blockreq/ex-brew-bnb-double-pair-listen build
pnpm --filter @blockreq/ex-brew-bnb-double-pair-listen typecheck
```
