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
| AI mentor | OpenRouter (Claude models) |

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
| `pytest -q` | Run the Gann engine's test suite |
| `npm run sanity` | End-to-end checks against a running deployment |

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
  migrations/    SQL schema, RLS policies, trigger, trading functions
  tests/         SQL suite for the trading engine
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
- [x] **Phase 5** — Paper trading engine (long/short, PnL, portfolio dashboard)
- [x] **Phase 6** — AI mentor that explains signals in two sentences

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
  mentor.py           turns an analysis into two plain sentences
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

## Languages

English and Hebrew, switched with the flag button in the header. The choice is
remembered per browser; a first visit follows the browser's own preference.

Hebrew flips the whole page to RTL by setting `dir` on `<html>`, which is what
Tailwind's logical properties (`ms-`, `ps-`, `text-end`) resolve against — so
the layout mirrors rather than being re-specified. The price chart is the one
exception: time runs left-to-right on a candlestick chart in every locale, so
its canvas is pinned `dir="ltr"` inside the mirrored page.

```
src/i18n/
  en.ts     source of truth; its keys are the contract
  he.ts     typed Record<TranslationKey, string> — a missing key fails the build
  index.ts  translate(), plural selection, per-language flag/dir/locale
```

Dates and times use the active locale. **Money does not**: `he-IL` renders USD
as `\u200f100,000.00 \u200f$`, and those invisible RTL marks reorder the
surrounding text when a price is interpolated into a sentence. The dollar is a
foreign currency in both locales and `$100,000.00` reads correctly in Hebrew,
so the marks buy nothing.

`npm run lint` also runs `scripts/check-i18n.mjs`, which catches what types
cannot: duplicate keys, and a translation using a `{placeholder}` English has no
value for. A translation may *drop* a placeholder — Hebrew says
"פוזיציה פתוחה אחת" rather than repeating the number — so the rule is
one-directional.

The AI mentor writes in either language: `python -m gann.refresh --lang he`.
Summaries are cached per signal, not per user, so the language of the panel note
is whichever the refresh job last ran in.

## Sanity checks

The unit suites prove the pieces work; `scripts/sanity.mjs` proves a deployment
is wired together — the site serves every route, the market data proxy reaches
Yahoo and rejects a traversal attempt, signup provisions $100,000, a position
opens and settles for the right amount, a second settlement is refused, and row
level security still blocks a client editing its own balance. It also checks the
browser bundle carries no server-side key.

```bash
BASE_URL=https://invest-pal.vercel.app \
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=sb_publishable_... \
npm run sanity
```

The database section is skipped when the Supabase variables are absent, so the
site and proxy checks still run against any deployment. Exits non-zero on the
first failure.

## Deploying

`vercel.json` and `api/market/chart.ts` make a Vercel import work with only two
environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — the
Edge Function answers on the same `/api/market` path the client already
defaults to, so market data needs no configuration. Step by step, including
the Supabase redirect URLs, in [SETUP.md](SETUP.md#deploying-to-vercel).

## The trading engine

Opening and closing a position each move cash **and** write a row. Those two
effects have to commit together, so they are Postgres functions
(`supabase/migrations/0002_trading_engine.sql`) rather than client-side writes:

```
open_position(asset_id, direction, quantity, price) -> transactions
close_position(transaction_id, price)               -> transactions
```

Both are `SECURITY DEFINER`, resolve the caller's portfolio from `auth.uid()`,
and take `SELECT ... FOR UPDATE` on the rows they touch. The locking is the
point: without it, two requests arriving together both read the same balance,
both pass the funds check, and the same cash is spent twice.

Migration 0002 also **removes the client's write paths**, which 0001 had left
open. They were holes: a browser that can `INSERT` into `transactions` can open
a position without paying for it, and a browser that can `UPDATE portfolios`
can simply set its own balance. Only `SELECT` remains, so these two functions
are the only way money moves.

### How a position is priced

Both directions reserve the notional (`quantity * price`) when opened. Closing
returns that collateral plus the result:

| | Profit | Cash returned on close |
| --- | --- | --- |
| Long | `qty * (exit - entry)` | `qty * exit` |
| Short | `qty * (entry - exit)` | `qty * (2*entry - exit)` |

`src/lib/trading.ts` mirrors this so the UI can show unrealised profit before a
position is closed. The database remains the authority — it settles every trade
— but if one changes, so must the other.

### A short can lose more than it reserved

0001 required `cash_balance >= 0`. That is wrong for shorts: if price more than
doubles, closing costs more than the collateral taken at open, and the
constraint would block the close and **strand the position** — the worst
outcome available. The constraint is dropped; opening is still gated on
available cash, so a negative balance can only result from a trade that ran
against the user. The portfolio page says so plainly when it happens, and new
positions are refused until the balance recovers.

### Tests

19 checks covering the accounting, both directions, the rejected-input paths,
double settlement, cross-account access and every removed write path:

```bash
npx supabase start   # or any Postgres
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/harness.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_trading_engine.sql
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/trading_engine_test.sql
```

`harness.sql` is a small stand-in for the parts of Supabase the migrations
touch (`auth.users`, `auth.uid()`, the `authenticated` role), so this runs
against a plain Postgres — which is how it runs in CI on every push.

## The AI mentor

Each cached signal carries a two-sentence, plain-language explanation, shown
directly above the Buy and Sell buttons.

It runs **inside the refresh job**, not in the browser and not in an edge
function. The analysis is already in hand at that point, the API key sits
alongside the service role key rather than in a second place, and the result is
cached in `gann_signals.ai_summary` — so it costs one model call per asset per
refresh instead of one per page view. At eight assets on a daily schedule that
is a few cents a month.

```bash
export OPENROUTER_API_KEY=sk-or-...
python -m gann.refresh                  # English summaries
python -m gann.refresh --lang en,he     # both languages
python -m gann.refresh --no-ai          # skip them
```

Summaries live in `gann_signals.ai_summaries`, a jsonb map keyed by language
code (migration `0003`), and the panel picks the active language with an English
fallback. The older single-language `ai_summary` column is kept holding English.

About $0.007 per summary on `anthropic/claude-opus-5`, so both languages across
eight assets is roughly **$0.11 a run**.

Without a key the signals are still computed and cached, just without the
summary, and the panel says how to get one.

### Model

Defaults to `anthropic/claude-opus-5`. Note these are OpenRouter's slugs, not
Anthropic's — `anthropic/claude-opus-5`, not `claude-opus-5`. Override with
`OPENROUTER_MODEL`; a smaller model is a reasonable trade here, since the task
is rephrasing numbers rather than reasoning about them.

If you would rather call Anthropic directly and skip OpenRouter's margin,
`_request` in `gann/mentor.py` is the only function that needs replacing.

### What the model is and is not asked to do

The prompt hands over a deliberately narrow set of numbers — the balance line
and which side price is on, the nearest level each way, the next cycle date,
and any caveat the engine flagged. Giving it all sixteen levels and seven rays
produces a summary that lists them rather than one that explains them.

The system prompt forbids predictions and advice outright, including the words
"should", "will", "recommend", "expect" and "predict". The rendered note says
it is an explanation and not a recommendation, because an AI paragraph beside a
Buy button will otherwise be read as a tip.

A failed summary never costs the signal, and it drops the previous one rather
than keeping it: the prices that note described have just been replaced, and a
note contradicting the levels on screen is worse than no note. One language
failing does not cost the others.

An empty completion — `finish_reason: "stop"` with no content — happens
occasionally and is retried, because the same prompt returns a good answer on
the next attempt. It was treated as terminal until a real run hit it.
