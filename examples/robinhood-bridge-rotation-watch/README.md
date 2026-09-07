# Robinhood Chain bridge rotation watch

Browser demo: bridge watchlist + `eth_subscribe` → Deposit / Withdraw `logs` → 5 / 15 / 60m netflow with rotation tags.

On each in/out log:
- roll samples into **5m / 15m / 60m** windows
- **bridge-netflow-lift** — short-window net vs 60m baseline
- **bridge-rotation-confirm** — 15m holds same direction
- **bridge-activity-thick** — both in and out thicken vs baseline

Bridge list lives in `localStorage` (`blockreq.rh-bridge-rotation.bridges`). Topic0 fields are editable (defaults: WETH-style Deposit / Withdrawal).

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-bridge-rotation-watch

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
