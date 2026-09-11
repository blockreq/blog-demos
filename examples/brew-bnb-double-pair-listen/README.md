# Brew BNB · double-pair listen

Browser demo: `eth_subscribe` → Brew / Pancake-style Factory PairCreated → group twin pools by launch token + CAP_USD → 「双池进度」/「twinReady」cards.

On each hit:
- **Twin progress** — PairCreated; same launch token, pools `1/2`
- **Twin ready** — same token collected ≥2 pools (same-cap twin set)
- **Quote chip** — optional QUOTE_HINT match (WBNB / USDT / …)

Factory / CAP_USD / quote hints live in UI fields (demo stand-in for `BREW_FACTORY` / `CAP_USD` / `QUOTE_HINT` env). Default factory = PancakeSwap V2 on BSC — swap for live Brew launch factory when known.

## Endpoints (public only)

- Chain: BNB Smart Chain `chainId = 0x38` (56)
- WSS: `wss://bsc-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://bsc-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/brew-bnb-double-pair-listen

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
