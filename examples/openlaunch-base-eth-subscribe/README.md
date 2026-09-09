# OpenLaunch · Base one-tx launch listen

Browser demo: Base public WSS `eth_subscribe` → Uniswap v4 `Initialize` (+ optional OpenLaunch factory / lock topics) → one-tx launch cards (pool · full-supply hint · lock).

On each hit:
- **pool Initialize** — PoolManager Initialize (currency0 / currency1 / poolId)
- **一笔开盘** — same-tx cluster when Initialize + factory/lock topics land together
- **lock** — permanent-lock-ish topic match (placeholder ABI — swap real OpenLaunch lock event)

Addresses / topics are UI stand-ins for `OPENLAUNCH_FACTORY` / `POOL_MANAGER` env. Placeholder OK with comments.

## Endpoints (public only)

- Chain: Base `chainId = 0x2105` (8453)
- WSS: `wss://base-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://base-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/openlaunch-base-eth-subscribe

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
