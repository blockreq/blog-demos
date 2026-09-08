# Robinhood Chain KOL wallet watch

Browser demo: multi-address KOL / smart-money watchlist + `eth_subscribe` → Transfer `logs` with dedupe / follow-spike tags.

On each watchlist hit:
- **kol-hit** — Transfer from/to a labeled watchlist address
- **rotate** — same addr, several Transfers in/out quickly
- **follow-spike** — ≥ K distinct watchlist addrs touch the same token inside N minutes
- dust / same-tx / self-shuffle noise filter

Watchlist lives in `localStorage` (`blockreq.rh-kol-wallet.watchlist`). Format: `0xaddr` or `LABEL 0xaddr` per line.

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-kol-wallet-watch

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
