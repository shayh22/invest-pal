# invest-pal

An educational paper-trading platform. It pairs a virtual portfolio with
predictive analysis based on W.D. Gann's methods (Gann angles, Square of Nine,
time cycles) and translates the output into plain language for beginners.

Everything here is virtual money and educational content — not financial advice.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4, shadcn/ui (radix / nova preset) |
| Routing | React Router |
| Backend & data | Supabase (Postgres, Auth, Row Level Security) |
| Charts | Lightweight Charts (TradingView) |
| Market data | Yahoo Finance (no key), behind a proxy |
| Gann engine | Python — *Phase 4* |
| AI mentor | OpenRouter — *Phase 6* |

## Getting started

You need a free [Supabase](https://supabase.com/dashboard) project — see
[SETUP.md](SETUP.md) for the walkthrough, including the one SQL file to paste
in. Nothing else needs an account yet.

```bash
npm install
cp .env.example .env   # add your Supabase URL + anon key
npm run dev
```

Without `.env` the app still boots and shows setup instructions in place of
the sign-in form.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run lint` | Run oxlint |
| `npm run preview` | Preview the production build |
| `npx supabase start` | Run the whole backend locally (needs Docker) |

## Project structure

```
src/
  components/
    layout/      App shell, shared page scaffolding
    market/      Candlestick chart
    ui/          shadcn/ui primitives (generated — edit with care)
  pages/         Route-level screens
  services/      API clients (Supabase, market data, Gann, OpenRouter)
    marketData/  Provider interface + Yahoo implementation
  hooks/         Reusable React hooks
  contexts/      React context providers (auth)
  lib/           Framework-agnostic helpers (env, formatting, cn)
  types/         Shared domain types

supabase/
  functions/     Edge Functions (market-data price proxy)
  migrations/    SQL schema, RLS policies, new-user trigger
  config.toml    Local-stack config for `npx supabase start`
```

The `@/` import alias maps to `src/` (configured in `vite.config.ts` and
`tsconfig.app.json`).

## Roadmap

- [x] **Phase 1** — Project setup: Vite + React + TypeScript, Tailwind, shadcn/ui
- [x] **Phase 2** — Supabase schema, auth, $100,000 starting virtual balance
- [x] **Phase 3** — Market data integration and candlestick charting
- [ ] **Phase 4** — Gann engine (angles, Square of Nine, cycle analysis)
- [ ] **Phase 5** — Paper trading engine (long/short, PnL, portfolio dashboard)
- [ ] **Phase 6** — AI mentor that explains signals in two sentences

## Market data

Prices come from Yahoo Finance, which needs no API key. It sends no CORS
headers, so the browser never calls it directly — requests go through a proxy
that both environments serve at the same URL shape
(`/chart?symbol=&range=&interval=`):

- **Development** — the Vite dev server proxies it (see `vite.config.ts`). No
  setup, no key.
- **Production** — deploy the Edge Function and point the app at it:

  ```bash
  npx supabase functions deploy market-data --no-verify-jwt
  # then set VITE_MARKET_PROXY_URL to the function's URL
  ```

Both sides validate the ticker before forwarding, since the symbol is
interpolated into the upstream URL.

Yahoo is unofficial and rate-limited, and is here because it gets real candles
on screen with zero signup friction. Swapping to a supported provider means
adding one file that satisfies `MarketDataProvider`
(`src/services/marketData/types.ts`) and changing the single export in
`src/services/marketData/index.ts` — no UI changes.
