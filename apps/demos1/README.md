# @blockreq/demos1

Vite + TanStack Router SPA under base path `/demos1/`, served by Cloudflare Worker `blockreq-demos1` (static assets + CSP).

## Routes

- `/demos1/`
- `/demos1/<slug>/en/`
- `/demos1/<slug>/zh/`

Slugs: `anoncoin-rh-launch-listen`, `openlaunch-base-eth-subscribe`, `equifold-multi-market-listen`.

## Browser-only RPC

All `eth_subscribe` / WSS traffic originates in the visitor browser to BlockReq public endpoints. This Worker never proxies RPC.

## Worker path mapping

Vite `base: "/demos1/"` emits `/demos1/assets/...` URLs, but build output lives at `dist/assets/...` (no nested `demos1/` folder). The Worker strips the `/demos1` prefix before `ASSETS.fetch` so zone route `blockreq.com/demos1*` matches `dist/`. `/demos1` still 308-redirects to `/demos1/`. CSP headers are applied after the asset response.

## Scripts

```bash
pnpm --filter @blockreq/demos1 dev
pnpm --filter @blockreq/demos1 build
pnpm --filter @blockreq/demos1 wrangler:dev
```

## Verify (after deploy)

```bash
# HTML shell
curl -sI https://blockreq.com/demos1/ | head -n 5
# Expect: 200, content-type: text/html

# JS/CSS must NOT be text/html (the SPA-fallback bug)
JS=$(curl -sL https://blockreq.com/demos1/ | rg -o '/demos1/assets/[^"]+\.js' | head -1)
CSS=$(curl -sL https://blockreq.com/demos1/ | rg -o '/demos1/assets/[^"]+\.css' | head -1)
curl -sI "https://blockreq.com$JS" | rg -i 'HTTP/|content-type'
curl -sI "https://blockreq.com$CSS" | rg -i 'HTTP/|content-type'
# Expect: 200 + application/javascript (or text/javascript) / text/css

# SPA client route still returns the shell
curl -sI https://blockreq.com/demos1/anoncoin-rh-launch-listen/en/ | rg -i 'HTTP/|content-type'
# Expect: 200 text/html

# Bare prefix redirect
curl -sI https://blockreq.com/demos1 | rg -i 'HTTP/|location'
# Expect: 308 → /demos1/
```
