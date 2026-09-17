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
| Gann engine | Python 3 (standard library only) |
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
| `python -m gann.refresh` | Compute Gann signals and cache them |
| `pytest -q` | Run the engine's test suite |

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

gann/            Python Gann engine (see "The Gann engine" below)
tests/           pytest suite for the engine
```

The `@/` import alias maps to `src/` (configured in `vite.config.ts` and
`tsconfig.app.json`).

## Roadmap

- [x] **Phase 1** — Project setup: Vite + React + TypeScript, Tailwind, shadcn/ui
- [x] **Phase 2** — Supabase schema, auth, $100,000 starting virtual balance
- [x] **Phase 3** — Market data integration and candlestick charting
- [x] **Phase 4** — Gann engine (angles, Square of Nine, cycle analysis)
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

## The Gann engine

The engine lives in `gann/` and is plain Python 3 with **no dependencies** —
not even numpy — so it runs anywhere without an install step.

```
gann/
  swings.py           pivot detection and the price-per-bar scale
  angles.py           the fan (1x1, 2x1, 1x2, ...)
  square_of_nine.py   support and resistance from the spiral
  cycles.py           repeating pivot spacings, projected forward
  engine.py           orchestrates the above into one payload
  yahoo.py            OHLCV fetch (no CORS problem server-side)
  refresh.py          CLI that caches results in Supabase
```

### The browser never calls it

`gann_signals` is a cache with an `expires_at`, so the engine writes rows and
the frontend reads them. That means **no second service to host**: run the
refresh job on a schedule, from CI, or by hand.

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>   # bypasses RLS — server only

python -m gann.refresh                 # every asset in the database
python -m gann.refresh --symbol AAPL   # just one
python -m gann.refresh --dry-run       # compute and print, write nothing
```

`.github/workflows/refresh-gann-signals.yml` runs this daily once you add those
two values as repository secrets. Without them it skips rather than failing.

If a signal is missing the Markets page says so and tells you the command; if
one is past its `expires_at` it is shown with a *Stale* badge rather than
hidden.

### Choices worth knowing about

Gann's methods depend on chart scale, which paper charts fixed implicitly and
software has to decide. Where a judgement was needed it is documented in the
module and surfaced in the UI:

- **Price per bar** is the window's full high-to-low range divided by its bar
  count — Gann sized the sheet so the range fitted the page. Deriving it from
  per-bar volatility instead (a median bar range) is the obvious-looking choice
  and is badly wrong: on daily AAPL it makes the 1x1 project ~60% away from the
  market within 30 bars, which turns the balance line into noise.
- **The fan is anchored** on the more recent of the window's highest high and
  lowest low, not on the latest pivot. The latest pivot gives a ray a few bars
  long that describes nothing. The anchor is named in the UI.
- **The Square of Nine is anchored on the latest close**, not the fan's pivot.
  Anchoring it on a distant pivot can put every level on one side of the market
  — a pivot 7% above price yields no support at all.
- **Cycles have a length floor** tied to the swing strength. Counting raw pivot
  spacings is biased towards the shortest ones, so without a floor the
  "dominant cycle" is just the detector's resolution limit.
- At four-figure prices a full turn of the spiral is a fraction of a percent.
  The engine adds a note saying so instead of implying false precision.

None of this predicts anything, and the UI says so plainly. It reports where
price has turned before and what the geometry from those turns looks like now.

### Tests

```bash
python -m venv .venv && .venv/bin/pip install pytest
.venv/bin/pytest -q
```

68 tests cover the maths directly — the Square of Nine's defining identity, fan
ratios and ordering, pivot edge cases, cycle clustering and projection — plus
the payload contract shared with `src/types/gann.ts`.
