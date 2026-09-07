# Robinhood Chain position watchtower

Browser demo: `eth_subscribe` → Transfer / Swap / Sync (pool-reserve) `logs` with local state-diff alerts.

On each hit:
- **LP plunge** — Sync reserve drop ≥ threshold vs last snapshot (default 15%)
- **large swap** — Swap amountIn ≥ threshold (default 1e18 raw units)
- **phase-switch** — reserve0/reserve1 ratio flips across 1.0 (or custom pivot)

Optional pair address scopes the filter; empty = topic-wide listen.

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-position-watchtower

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
