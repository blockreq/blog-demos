# OpenLaunch · Base one-tx launch listen (hosted)

Next.js App Router + shadcn-style UI demo for Cloudflare Pages.

- WSS: `wss://base-rpc.blockreq.com/v1/rpc/public` (**not** `base-mainnet-rpc`)
- StackBlitz twin: `examples/openlaunch-base-eth-subscribe`
- Blog deep-link env: `NEXT_PUBLIC_BLOG_URL` (default `https://blockreq.com/blog/en/openlaunch-base-eth-subscribe`)

```bash
npm install
npm run dev
npm run build          # static export → out/
npm run pages:deploy   # wrangler pages deploy (needs CLOUDFLARE_API_TOKEN)
```

Pages project name: `openlaunch-base-eth-subscribe`
