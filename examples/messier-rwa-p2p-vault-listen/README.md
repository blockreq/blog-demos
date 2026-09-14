# Messier P2P vault listen: $RWA zero-slippage lock radar

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`MessierRwaP2pVaultListenDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/messier-rwa-p2p-vault-listen.tsx` (no vanilla HTML/JS twin).

Messier P2P vault `VaultDeposit` / `VaultWithdraw` lock-release radar (token / amount / maker via receipt sibling ERC-20 Transfer; $RWA highlight; optional USDC filter).

## Endpoints (public only)

- Chain: Base `chainId = 0x2105 (8453)`
- WSS: `wss://base-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://base-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero Solana / Arc / Robinhood / publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/messier-rwa-p2p-vault-listen/src/main.tsx&startScript=dev:messier-rwa-p2p-vault-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/messier-rwa-p2p-vault-listen/src/main.tsx
startScript: dev:messier-rwa-p2p-vault-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-messier-rwa-p2p-vault-listen dev
pnpm --filter @blockreq/ex-messier-rwa-p2p-vault-listen build
pnpm --filter @blockreq/ex-messier-rwa-p2p-vault-listen typecheck
```
