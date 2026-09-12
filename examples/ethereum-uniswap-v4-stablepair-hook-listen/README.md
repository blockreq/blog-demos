# ETH StablePair Hook listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`EthUniswapV4StablePairHookDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/ethereum-uniswap-v4-stablepair-hook-listen.tsx` (no vanilla HTML/JS twin).

PoolManager Swap + ModifyLiquidity filtered by official StablePair poolIds (peg / fee / LP).

## Endpoints (public only)

- Chain: Ethereum `chainId = 0x1 (1)`
- WSS: `wss://ethereum-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://ethereum-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/ethereum-uniswap-v4-stablepair-hook-listen/src/main.tsx&startScript=dev:ethereum-uniswap-v4-stablepair-hook-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/ethereum-uniswap-v4-stablepair-hook-listen/src/main.tsx
startScript: dev:ethereum-uniswap-v4-stablepair-hook-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-ethereum-uniswap-v4-stablepair-hook-listen dev
pnpm --filter @blockreq/ex-ethereum-uniswap-v4-stablepair-hook-listen build
pnpm --filter @blockreq/ex-ethereum-uniswap-v4-stablepair-hook-listen typecheck
```
