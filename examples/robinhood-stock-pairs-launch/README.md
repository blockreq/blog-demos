# Robinhood Chain stock-pairs launch

Browser demo: Stock Token table + `eth_subscribe` → PairCreated / Mint → launch cards for 币股配对 / Bags Stock Pairs.

On each hit:
- **pair landed** — PairCreated where token0 or token1 ∈ stock table
- **paired asset** — stock-side addr + symbol hint
- **first LP** — first Mint on that new pair
- **paired open cluster** — pair + first LP packed into one card

Stock table lives in `localStorage` (`blockreq.rh-stock-pairs.stocks`).

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-stock-pairs-launch

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
