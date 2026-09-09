# Boss steps — demos1 Worker (`blockreq-demos1`)

Cancels the Cloudflare Pages pilot. Hosted demos live on one Worker with static assets.

## What lands in this repo

- App: `apps/demos1` (Vite + TanStack Router, base `/demos1/`)
- Worker name: `blockreq-demos1` (`apps/demos1/wrangler.toml`)
- CI build on PR; deploy only via `workflow_dispatch`

## Follow-up (zone / gitops)

1. Ensure Worker `blockreq-demos1` exists in the BlockReq Cloudflare account (first `wrangler deploy` or Dashboard create).
2. Route: `blockreq.com/demos1*` → `blockreq-demos1` (Workers Routes or gitops). Prefer this over `*.pages.dev`.
3. Secrets for optional GitHub deploy (repo or org):
   - `CLOUDFLARE_API_TOKEN` — Account · Workers Scripts · Edit (+ Account Settings · Read)
   - `CF_ACCOUNT_ID` (or `CLOUDFLARE_ACCOUNT_ID`) — BlockReq account id
4. Dispatch: `gh workflow run demos1.yml -R blockreq/blog-demos -f deploy=true`

## CSP / embed

Worker sets `Content-Security-Policy` with `frame-ancestors` allowing `https://blockreq.com` and `https://*.blockreq.com` (plus localhost for preview). Blog iframes should point at `https://blockreq.com/demos1/<slug>/<locale>/`.

## Browser-only RPC

Visitors connect from the browser to public WSS/HTTPS (`*.blockreq.com`). The Worker must never open BlockReq RPC subscriptions on behalf of users.

## Pages pilot cleanup

Removed: `apps/anoncoin-rh-launch-listen`, `apps/openlaunch-base-eth-subscribe`, `.github/workflows/deploy-hosted-demos.yml`. StackBlitz examples under `examples/` remain.

## Asset path strip (Worker)

`dist/` is flat; public URLs are under `/demos1/`. `src/worker.ts` strips `/demos1` before `ASSETS.fetch`. After merging Worker changes, re-deploy:

```bash
gh workflow run demos1.yml -R blockreq/blog-demos -f deploy=true
```
