# Equifold · multi-market open listen

Browser demo: Base (+ optional Robinhood) public WSS `eth_subscribe` → Equifold factory create/open logs → aggregate markets per token → first / Nth priority cards.

On each hit:
- **market open** — factory create/open decode (baseToken / quoteToken / market)
- **P0 · first** — first market for that token
- **P1 · nth** — subsequent market (`index`, Δt from first)
- **rate · burst** — same token opens multiple markets in a short window

Dual-endpoint toggle: Base `0x2105` / RH `0x1237`. Factory + topic0 are UI stand-ins for `EQUIFOLD_FACTORY` / `EQUIFOLD_MARKET_TOPIC0` env. Placeholder OK.

## Endpoints (public only)

| | Base (default) | Robinhood (toggle) |
| --- | --- | --- |
| chainId | `0x2105` (8453) | `0x1237` (4663) |
| WSS | `wss://base-rpc.blockreq.com/v1/rpc/public` | `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public` |
| HTTPS | `https://base-rpc.blockreq.com/v1/rpc/public` | `https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public` |

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/equifold-multi-market-listen

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
