# Arc bridge + launch watch (day-0 recipe)

Browser demo: bridge Deposit / Withdraw + Factory `PairCreated` / first `Mint` → launch cards (`inflow spike` · `first pool` · `first LP`).

## Arc public endpoint status

**Arc BlockReq public WSS/HTTPS is live.** Use `/v1/rpc/public` (the bare host without that path returns 401 invalid key). This demo runs the day-0 recipe on Arc public WSS.

On each hit:
- **bridge inflow spike** — 5m net vs 15m baseline (≥ multiple / floor)
- **first pool** — Factory PairCreated → token0 / token1 / pair
- **first LP** — first Mint on that new pair
- **day-0 compose** — spike then first pool + first LP inside the compose window

Bridge / factory lists live in `localStorage` (`blockreq.arc-bridge-launch.*`). Topic0 fields are editable (defaults: WETH-style Deposit / Withdrawal + Uniswap V2 PairCreated / Mint).

## Endpoints (public only)

- HTTPS: `https://arc-rpc.blockreq.com/v1/rpc/public`
- WSS: `wss://arc-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/arc-bridge-launch-watch

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
