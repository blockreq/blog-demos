# Solana new mint watcher

Browser demo: logsSubscribe on SPL Token / Token-2022, filter InitializeMint / InitializeMint2.
Second page resolves mint via getTransaction.

## Endpoints (public only)

- WSS: wss://solana-rpc.blockreq.com/v1/rpc/public
- HTTPS: https://solana-rpc.blockreq.com/v1/rpc/public

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/solana-new-mint

Click Run after open (ctl=1).

## Local

Install deps, then start Vite.
- Watcher entry: src/index.ts
- Resolve mint entry: src/get-mint.ts via get-mint.html
