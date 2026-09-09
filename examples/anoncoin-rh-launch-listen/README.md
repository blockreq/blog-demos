# Anoncoin · RH anon launch listen

Browser demo: `eth_subscribe` → Anoncoin Factory PairCreated (or equivalent) → filter `quote=$SPCX` → 「新开盘」/new launch cards.

On each hit:
- **新开盘** — PairCreated where token0 or token1 == quote whitelist ($SPCX)
- **quote hit** — which side matched QUOTE_TOKEN
- **LP 到位** — optional first Mint on that pair (≥ MIN_LIQ gate)

Factory / quote live in UI fields (demo stand-in for `ANONCOIN_FACTORY` / `QUOTE_TOKEN` env). Placeholder factory + V2-style ABI comment — swap real factory when known.

## Endpoints (public only)

- Chain: Robinhood Chain `chainId = 0x1237` (4663)
- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/anoncoin-rh-launch-listen

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
