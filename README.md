# BlockReq blog demos

Runnable browser demos for BlockReq blog posts.

## Open in StackBlitz

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/solana-new-mint

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-open-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-volume-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-whale-fomo

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-position-watchtower

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-timed-launch-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-new-pairs-agent-feed

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-thin-liquidity-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-stock-pairs-launch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-bridge-rotation-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/arc-bridge-launch-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-kol-wallet-watch

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/robinhood-gas-heat-radar

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/anoncoin-rh-launch-listen

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/openlaunch-base-eth-subscribe

https://stackblitz.com/github/blockreq/blog-demos/tree/main/examples/equifold-multi-market-listen

Click Run after open (ctl=1).

## Public-only warning

No API keys in runnable code. Defaults to BlockReq public WSS/HTTPS. See docs.blockreq.com/build/public-endpoints/

## Examples

- examples/solana-new-mint
- examples/robinhood-open-watch
- examples/robinhood-volume-watch
- examples/robinhood-whale-fomo
- examples/robinhood-position-watchtower
- examples/robinhood-timed-launch-watch
- examples/robinhood-new-pairs-agent-feed
- examples/robinhood-thin-liquidity-watch
- examples/robinhood-stock-pairs-launch
- examples/robinhood-bridge-rotation-watch
- examples/arc-bridge-launch-watch
- examples/robinhood-kol-wallet-watch
- examples/robinhood-gas-heat-radar
- examples/anoncoin-rh-launch-listen
- examples/openlaunch-base-eth-subscribe
- examples/equifold-multi-market-listen



## Hosted Next.js demos (Cloudflare Pages)

iframe-friendly App Router demos with big beginner UI + local enter/highlight/pulse motion.

| App | Source | Expected Pages URL | Blog deep-link (`NEXT_PUBLIC_BLOG_URL`) |
| --- | --- | --- | --- |
| Anoncoin RH launch listen | `apps/anoncoin-rh-launch-listen` | https://anoncoin-rh-launch-listen.pages.dev | https://blockreq.com/blog/en/anoncoin-rh-launch-listen |
| OpenLaunch Base eth_subscribe | `apps/openlaunch-base-eth-subscribe` | https://openlaunch-base-eth-subscribe.pages.dev | https://blockreq.com/blog/en/openlaunch-base-eth-subscribe |

StackBlitz twins stay under `examples/` (unchanged).

Deploy (CI on `main`, or locally):

```bash
cd apps/anoncoin-rh-launch-listen && npm ci && npm run pages:deploy
cd apps/openlaunch-base-eth-subscribe && npm ci && npm run pages:deploy
```

Requires org secret `CLOUDFLARE_API_TOKEN` + repo secret `CF_ACCOUNT_ID`.

## License

MIT
