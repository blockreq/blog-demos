# @blockreq/demos1

Vite + TanStack Router SPA under base path `/demos1/`, served by Cloudflare Worker `blockreq-demos1` (static assets + CSP).

## Feel

Shell matches the locked cyberpunk baseline (`demos1-feel-baseline`): near-black `#050508`, panels `#0D0D14`, neon cyan/magenta, hard edges / clipped CTA, four loud states (idle → connecting → listening → hit). ETH/Sol/BNB are secondary accents only. Solana public RPC is not marketed.


## First paint / cache

`index.html` embeds critical inline styles (`html,body,#root` → `#050508` / `#F2F4FF`) so the first paint is cyber-black, not a white FOUC flash before CSS/JS. Vite keeps those inline styles in the built HTML; hashed assets bump on each build.

Cloudflare may briefly serve a cached older `index.html` after deploy — hard-refresh or wait for edge TTL if you still see a white flash.

## Catalog

`DEMO_CATALOG` in `@blockreq/i18n` (also re-exported from `src/catalog.ts`) drives `/demos1/` with slug, en+zh titles/blurbs, and entry paths for the three live demos.

## Routes

- `/demos1/`
- `/demos1/<slug>/en/`
- `/demos1/<slug>/zh/`

Slugs: `anoncoin-rh-launch-listen`, `openlaunch-base-eth-subscribe`, `equifold-multi-market-listen`.

## Demo / fixture hits (美工)

Default **off**. Enable with `?demoHits=1` on any slug URL, Advanced → “Demo / fixture hits”, or catalog `demoHits: true`. When active, a **DEMO · SIMULATED** banner + Inject button push fixture rows (flash / large hit card / multi-market columns). Live browser listen remains the default path.

## Browser-only RPC

All subscribe / WSS traffic originates in the visitor browser to BlockReq public endpoints. This Worker never proxies RPC.

## Worker path mapping

Vite `base: "/demos1/"` emits `/demos1/assets/...` URLs, but build output lives at `dist/assets/...` (no nested `demos1/` folder). The Worker strips the `/demos1` prefix before `ASSETS.fetch` so zone route `blockreq.com/demos1*` matches `dist/`. `/demos1` still 308-redirects to `/demos1/`. CSP headers are applied after the asset response.

## Scripts

```bash
pnpm --filter @blockreq/demos1 dev
pnpm --filter @blockreq/demos1 build
pnpm --filter @blockreq/demos1 wrangler:dev
```

## Deploy

Boss must run:

```bash
gh workflow run demos1.yml -R blockreq/blog-demos -f deploy=true
```
