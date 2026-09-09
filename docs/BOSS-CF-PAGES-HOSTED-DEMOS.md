# Boss steps — Cloudflare Pages for hosted blog demos

Apps are on `main` (merged). CI cannot finish deploy until the API token can manage **Cloudflare Pages**.

## Current blocker

GitHub Actions run failed with Cloudflare `Authentication error [code: 10000]` on
`wrangler pages project create`. The org `CLOUDFLARE_API_TOKEN` visible to
`blockreq/blog-demos` does **not** have Pages Edit (Workers-only tokens are common).

## Exact steps

1. **Create two Pages projects** (Dashboard → Workers & Pages → Create → Pages → Direct Upload), production branch `main`:
   - `anoncoin-rh-launch-listen` → expect `https://anoncoin-rh-launch-listen.pages.dev`
   - `openlaunch-base-eth-subscribe` → expect `https://openlaunch-base-eth-subscribe.pages.dev`

2. **API token** (My Profile → API Tokens → Create Custom Token):
   - Permissions: **Account · Cloudflare Pages · Edit**
   - Also: **Account · Account Settings · Read** (wrangler account check)
   - Account Resources: include BlockReq account `ad9331a749fc4b76fe53d6f14fbc8471`

3. **Secrets**
   - Prefer updating the org secret `CLOUDFLARE_API_TOKEN` (visibility: all) **or**
     set a **repo** secret `CLOUDFLARE_API_TOKEN` on `blockreq/blog-demos` (repo overrides org).
   - Repo secret `CF_ACCOUNT_ID` is already set to `ad9331a749fc4b76fe53d6f14fbc8471`.

4. **Re-run deploy**
   ```bash
   gh workflow run deploy-hosted-demos.yml -R blockreq/blog-demos
   ```

5. **Blog embed env** (already baked as defaults + CI build env):
   - Anoncoin: `NEXT_PUBLIC_BLOG_URL=https://blockreq.com/blog/en/anoncoin-rh-launch-listen`
   - OpenLaunch: `NEXT_PUBLIC_BLOG_URL=https://blockreq.com/blog/en/openlaunch-base-eth-subscribe`
   - CTA signup: `NEXT_PUBLIC_SIGNUP_URL=https://blockreq.com/pricing`

## Local deploy (after token is ready)

```bash
export CLOUDFLARE_API_TOKEN=… CF_ACCOUNT_ID=ad9331a749fc4b76fe53d6f14fbc8471
cd apps/anoncoin-rh-launch-listen && npm ci && npm run pages:deploy
cd ../openlaunch-base-eth-subscribe && npm ci && npm run pages:deploy
```
