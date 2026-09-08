# Robinhood Chain gas heat radar

Browser demo: `eth_subscribe` → `newHeads` + rolling `eth_feeHistory` → 5m / 15m heat windows with spike alerts.

On each head / feeHistory refresh:
- **baseFee heat** — current baseFee vs 5m / 15m mean
- **utilization** — sliding mean of `gasUsed / gasLimit` (heads) and `gasUsedRatio` (feeHistory)
- **heat-lift** — 5m baseFee > 15m mean
- **heat-spike** — 5m baseFee > 15m × mult and util ≥ floor
- **open-window hint** — heat-spike near a local launch window (optional HH:MM)

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-gas-heat-radar

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
