# Robinhood Chain new-pairs agent feed

Browser demo: `eth_subscribe` → PairCreated / Mint / Sync `logs` → field filter → fake TG / webhook payload + light heuristics.

Pipeline:
1. Subscribe PairCreated (+ optional Mint/Sync for LP signal)
2. Decode token0 / token1 / pair
3. Heuristics: `fresh-pair`, `same-block LP`, `base-hit` (watchlist base tokens)
4. Emit fake Telegram / webhook JSON cards into the feed

## Endpoints (public only)

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-new-pairs-agent-feed

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
