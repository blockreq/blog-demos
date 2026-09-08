# Arc bridge + launch watch (day-0 recipe)

Browser demo: bridge Deposit / Withdraw + Factory `PairCreated` / first `Mint` → launch cards (`inflow spike` · `first pool` · `first LP`).

## Arc public endpoint status

**Arc BlockReq public WSS/HTTPS is not live yet.** This demo runs the same day-0 recipe on Robinhood public WSS so you can practice the pipe today. When Arc public endpoints light up, swap the WSS host (keep trailing `/v1/rpc/public`) — logic ports over unchanged.

On each hit:
- **bridge inflow spike** — 5m net vs 15m baseline (≥ multiple / floor)
- **first pool** — Factory PairCreated → token0 / token1 / pair
- **first LP** — first Mint on that new pair
- **day-0 compose** — spike then first pool + first LP inside the compose window

Bridge / factory lists live in `localStorage` (`blockreq.arc-bridge-launch.*`). Topic0 fields are editable (defaults: WETH-style Deposit / Withdrawal + Uniswap V2 PairCreated / Mint).

## Endpoints (public only)

- Demo WSS (Robinhood fallback): `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`
- Arc public: *not live yet* — swap host when available

No API keys in this repo.

## StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/arc-bridge-launch-watch

Open `index.html` in the preview (single-file demo).

## Local

Open `index.html` in a browser, or serve the folder with any static server.
