# Robinhood Chain thin liquidity / reserves watch

Browser demo: `eth_subscribe` → Sync / Swap `logs` → reserves · rough depth · depth/mcap with thin / cliff / punch-through tags.

On each Sync:
- **rough depth** — `min(reserve0, reserve1)` (1e18 quote feel)
- **depth / mcap** — vs editable mcap; under threshold → **thin liquidity**
- **reserve cliff** — depth vs last-N Sync mean drops past threshold

On each Swap:
- **punch-through** — swap size / current depth ≥ impact %

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-thin-liquidity-watch

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
