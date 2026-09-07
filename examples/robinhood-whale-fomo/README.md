# Robinhood Chain whale / FOMO watch

Browser demo: editable 车头 watchlist + `eth_subscribe` → Transfer `logs` (from/to) with FOMO window tags.

On each watchlist hit:
- **FOMO** — ≥ min hits inside the FOMO window (default 3 / 30s)
- **车头跟风** — ≥ min distinct watchlist addresses in the same window
- **打狗** — dense sub-burst (many hits in a tight slice of the window)

Watchlist is stored in `localStorage` (`blockreq.rh-whale-fomo.watchlist`).

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-whale-fomo

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
