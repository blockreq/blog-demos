# Robinhood Chain timed launch watch

Browser demo: time-window `eth_subscribe` → PairCreated / first Swap / Mint (LP) with on-time alert cards.

Set a launch window (start + duration). Inside the window:
- **PairCreated** — new pair card
- **first swap** — first Swap per pair in-window
- **LP in** — Mint / Sync as liquidity signal

Outside the window subscriptions stay quiet (events buffered only as out-of-window noise count).

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-timed-launch-watch

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
