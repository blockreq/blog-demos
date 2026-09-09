# Anoncoin · RH anon launch listen (hosted)

Next.js App Router + shadcn-style UI demo for Cloudflare Pages.

- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`
- StackBlitz twin: `examples/anoncoin-rh-launch-listen`
- Blog deep-link env: `NEXT_PUBLIC_BLOG_URL` (default `https://blockreq.com/blog/en/anoncoin-rh-launch-listen`)

```bash
npm install
npm run dev
npm run build          # static export → out/
npm run pages:deploy   # wrangler pages deploy (needs CLOUDFLARE_API_TOKEN)
```

Pages project name: `anoncoin-rh-launch-listen`
