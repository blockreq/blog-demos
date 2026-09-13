# CompanyPad RHC company-market listen

Vite + React + TypeScript + Tailwind shell that mounts the demos1 listen UI
(`CompanypadRhcCompanyMarketDemo`) — React + viem + `@blockreq/ui` (shadcn-style).  
Shared logic: `apps/demos1/src/demos/companypad-rhc-company-market-listen.tsx` (no vanilla HTML/JS twin).

PAD factory `Launched` radar (ticker / metricId / creator / curve / market); optional Settled follow on selected market.

## Endpoints (public only)

- Chain: Robinhood Chain `chainId = 0x1237 (4663)`
- WSS: `wss://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`
- HTTPS: `https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public`

No API keys in this repo. Zero Solana / Arc / publicnode.

## StackBlitz (repo root + file)

https://stackblitz.com/github/blockreq/blog-demos/tree/main?file=examples/companypad-rhc-company-market-listen/src/main.tsx&startScript=dev:companypad-rhc-company-market-listen&ctl=1

`:::stackblitz` for 运营 (repo root + file path):

```
https://stackblitz.com/github/blockreq/blog-demos/tree/main
file: examples/companypad-rhc-company-market-listen/src/main.tsx
startScript: dev:companypad-rhc-company-market-listen
```

## Local

From repo root:

```bash
pnpm install
pnpm --filter @blockreq/ex-companypad-rhc-company-market-listen dev
pnpm --filter @blockreq/ex-companypad-rhc-company-market-listen build
pnpm --filter @blockreq/ex-companypad-rhc-company-market-listen typecheck
```
