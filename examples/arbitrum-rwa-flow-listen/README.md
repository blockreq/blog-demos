# Arbitrum · RWA flow listen

Browser demo: parallel `eth_subscribe` → Transfer (mint if `from` = zero) on RWA ∪ stable lists + PairCreated on factory list → kind-tagged flow cards.

On each hit:
- **mint** — Transfer where `topics[1]` (from) is the zero address
- **transfer** — Transfer above MIN_RAW / MIN_TRANSFER_USD soft gate
- **pair** — PairCreated where either side hits RWA or stable tables

RWA / STABLE / FACTORY lists + MIN filters live in UI textareas (demo stand-ins for env lists). Sample Arb addresses — verify / replace before production use.

## Endpoints (public only)

- Chain: Arbitrum One `chainId = 0xa4b1` (42161)
- WSS: `wss://arbitrum-one-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://arbitrum-one-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/arbitrum-rwa-flow-listen

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
