# Robinhood Chain volume watch

Browser demo: `eth_subscribe` → `newHeads` with volume tags (`gas`, `burst`, `same-block`).

On each head:
- **gas** — `gasUsed/gasLimit` ratio; `gas:high` when ≥ threshold (default 0.7)
- **burst** — `eth_getBlockByNumber(hex, false)` tx-hash count vs rolling avg; burst when `count ≥ max(avg×m, avg+20)`
- **same-block** — optional Transfer logs; when ≥2 share a `blockNumber`, tag `same-block n=K`

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-volume-watch

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
