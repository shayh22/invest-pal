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

### Which asset to look at

The engine could always say what Gann made of an asset you had already chosen.
The harder question, and the one people actually start with, is *which* one to
look at. `gann/opportunity.py` scores every analysis on the same four readings
and the dashboard ranks them:

| Reading | Weight | Why |
| --- | --- | --- |
| **Room versus risk** | 0.40 | Distance up to the nearest resistance against distance down to the nearest support. The only reading with a direct trading meaning: a support just underneath is a definable stop, and space above is somewhere to go. |
| **Balance** | 0.25 | Where the close sits against the 1x1 — Gann's own trend test. Scored on *proximity*, because the 1x1 is where the decision is cheap and a price stretched far from it has already made its move. |
| **A turn due** | 0.20 | Gann's central claim is that time turns markets. A projected cycle landing within three weeks scores; one months out does not. |
| **Confidence** | 0.15 | Few pivots, no fan, a tight square. The engine already records these as notes, and a score built on thin data should say so rather than compete with one built on a clean chart. |

The reward-to-risk ratio is **capped at 3.0** before it is scored. A ratio of
forty means the nearest support happens to sit a rounding error away, not that
the trade is forty times better than even.

The weights are round numbers stated in one place. There is no backtest behind
them and inventing one would be dishonest — they express which readings matter
more, not a calibrated edge. Every part is kept alongside the total and shown
in the UI, because a ranking nobody can interrogate is a ranking nobody should
act on.

Scoring runs in the engine rather than the browser so that the ranking and the
panel explaining it cannot drift apart, and the result is written into the
`opportunity` block of `gann_signals.payload` by the nightly refresh. The block
is optional on the frontend: rows cached before the scanner shipped carry no
score and are **skipped rather than ranked last**, because "not yet measured"
and "measured and poor" are different things.

The card sits behind a button. It is one request covering every scored asset,
and a ranked list of things to buy should be something you went looking for
rather than something the app greets you with.

### Tests

```bash
python -m venv .venv && .venv/bin/pip install pytest
.venv/bin/pytest -q
```

100 tests cover the maths directly — the Square of Nine's defining identity, fan
ratios and ordering, pivot edge cases, cycle clustering and projection — plus
the payload contract shared with `src/types/gann.ts`.

The opportunity tests are about **ordering** rather than absolute numbers: that
a roomier chart outranks a cramped one, that a turn due sooner outranks one
further out, that thin data loses to clean data, and that an absurd ratio is
capped rather than allowed to dominate. Asserting the totals would only restate
the weights.

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
trade(asset_id, side, quantity, price)       -> transactions
reset_portfolio(starting_balance)            -> portfolios
set_short_selling(enabled)                   -> portfolios

open_position(asset_id, direction, qty, px)  -> transactions   # wrapper over trade()
close_position(transaction_id, price)        -> transactions   # wrapper over trade()
```

All are `SECURITY DEFINER`, resolve the caller's portfolio from `auth.uid()`,
and take `SELECT ... FOR UPDATE` on the rows they touch. The locking is the
point: without it, two requests arriving together both read the same balance,
both pass the funds check, and the same cash is spent twice.

Migration 0002 also **removes the client's write paths**, which 0001 had left
open. They were holes: a browser that can `INSERT` into `transactions` can open
a position without paying for it, and a browser that can `UPDATE portfolios`
can simply set its own balance. Only `SELECT` remains, so these two functions
are the only way money moves.

### One holding per asset

Until migration `0006` every order wrote a new row, so nothing stopped a
portfolio holding a long *and* a short on the same asset, or five separate AAPL
longs that any broker would have netted into one holding. You could also "sell"
an asset you had never bought — which is not selling, it is shorting, and it
happened by accident because the button said Sell.

A portfolio now has at most one open position per asset, enforced by a partial
unique index rather than by the function's good behaviour, and `trade()` moves
it:

| Holding | Buy | Sell |
| --- | --- | --- |
| flat | open a long | refused unless short selling is on |
| long | add; entry becomes the weighted average | sell, up to the quantity held |
| short | cover, up to the quantity short | add to the short |

An order that would cross **through** zero is refused rather than flipped: being
able to turn a long into a short with one tap is the accident this exists to
prevent. Adding to a holding averages the entry exactly — the cash a fill posts
is `quantity * entry`, so a weighted average preserves the total to the cent,
and `netting_test.sql` asserts that identity rather than the arithmetic.

Selling part of a holding splits it: the sold portion becomes its own settled
row carrying a proportional share of what opening cost, and the rest stays open
at the same entry. Selling the lot settles the row in place, so its id is
stable.

Migration `0006` also nets whatever the old engine left behind. Same-direction
duplicates merge by weighted average, which is exact. A simultaneous long and
short — a state no broker could produce — has its later leg unwound at its own
entry price: the cash it posted comes back exactly, nothing is realised, and
nothing is invented. That path is tested, including that the account is worth
the same before and after.

### Short selling is opt-in

Off by default, switched on per account (`portfolios.short_selling_enabled`).
On a real retail account shorting needs a margin agreement; it is not somewhere
you arrive by mistake. Switching it back off never strands an open short,
because covering is a *buy*, which reduces rather than opens and so does not
consult the flag.

### Starting over

`reset_portfolio(amount)` deletes every trade — open positions and closed
history alike — and re-funds the account at one of the offered balances,
defaulting to whatever it currently has. Unlike signup metadata, which falls
back to the default when it is nonsense, an unoffered amount here is refused
outright: this is a deliberate choice made by someone already signed in.

It is also the way out of a hole. A short that ran away leaves the balance
negative and new positions blocked; without a reset that would be the end of
the account.

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

### A list of what you are following

74 assets means typing tickers into the picker every visit. Migration `0009`
adds a watchlist: star an asset on the chart and it appears on the dashboard
with its price and the day's move, tappable straight back to its chart.

The list is a **preference, not account state**, so `reset_portfolio()` is
deliberately left alone — starting over with the money should not make you
forget what you were following. Those are different decisions, and the button
names the money.

`set_watched(asset, bool)` is one idempotent call rather than an add and a
remove, because the UI has a single star and asking it to know which way round
it currently is invites the two to disagree.

The picker's search became **ranked** rather than merely filtered while testing
this: an exact ticker beats a ticker prefix, beats an exact name, beats a name
prefix, beats a word inside the name, beats a substring. Without the exact-name
band, searching "bitcoin" tied Bitcoin with Bitcoin Cash and the winner was
whichever the query happened to return first.

### Spending an amount instead of counting shares

Quantities were always `numeric(18, 8)`, so fractions worked from the first
migration — what was missing was the way people actually think. Nobody decides
to buy 0.1487 of a share; they decide to put fifty dollars into something.

The trade panel now takes either. Switch to an amount and it divides by the
price on screen, **truncating** to eight places rather than rounding: rounding
up could ask for a hair more than the amount covers, and being refused for a
rounding error you cannot see is the worst kind of refusal.

Offered only for a market order, and the switch falls back to a quantity the
moment a resting type is chosen — converting an amount needs a price, and a
limit order does not have one yet.

One thing worth saying out loud, which the panel does: **fees do not scale all
the way down.** A fifty cent minimum on a five dollar order is ten percent
before the price has moved at all. When costs come to more than 2% of an order
the panel says so, because trying small amounts is exactly what someone
learning will do.

`formatQuantity()` trims to what was actually bought, so a whole share prints
as `3` rather than `3.00000000` and a fraction is not mistaken for a precision
error.

### A stop that follows the price

A stop-loss is set once and then it is wrong. Buy at 100, stop at 90, and if
the price runs to 150 the stop is still sitting at 90 — fifty points of profit
with nothing under it. Moving it by hand means remembering to.

Migration `0011` adds `TRAILING` as a fourth trigger type on `pending_orders`:
name a **distance** rather than a level and the stop rides along behind the
best price seen so far. A sell trails below the high, a buy trails above the
low, and the distance is either an amount or a percentage — both, because
which one is natural depends entirely on the price of the thing.

The property that matters is the **ratchet**, and it is one ordering decision
inside `settle_pending_orders()`: the peak advances *before* anything is
tested. A price that sets a new high moves the stop and therefore cannot have
hit it; a price that does not is left to the ordinary stop test against the
level the high left behind. That single pass is what makes "the stop never
moves against you" true rather than nearly true, and the test suite states it
as its own check.

`trailing_stop_level()` exists so that placement and settlement cannot disagree
about where the stop is. Two copies of that arithmetic drifting apart is
exactly the bug that would fire an order at the wrong level.

The honest caveat, which the order card says out loud: the peak is the best
price this account has **seen**, not the best price that happened. The ratchet
advances on the same opportunistic prices that fire everything else, so a spike
nobody was looking at does not raise the stop.

### Being told, without trading

A stop order says "sell if it falls to 80". Often what someone actually wants
is "*tell me* if it falls to 80" — and making them place an order to find out
means committing to a trade they have not decided on. Migration `0010` adds
`price_alerts`: a level, a direction, and nothing else.

Deliberately much smaller than `pending_orders`. An alert has no side, no
quantity, no funds check and no failure mode, so reusing the order machinery
would have meant a row with three null columns and a status that can never be
`REJECTED`. It fires once — a `triggered_at` that stays set — rather than
re-firing on every price still past the level.

Alerts fire on the same opportunistic settlement as resting orders: whenever a
page holds a fresh price for an asset, it hands that price to both
`settle_pending_orders()` and `settle_price_alerts()`. So an alert arrives when
you next look, not the instant the market crosses it. The panel says that out
loud instead of implying a push notification that does not exist.

Like the watchlist, alerts survive `reset_portfolio()`. They hold no money and
no position, and re-funding the account says nothing about which levels are
still worth knowing about.

### Orders that wait

Everything filled instantly at whatever the screen showed. Real brokers are
mostly *not* that — a market order is the exception, and the orders that matter
are the ones you leave sitting. Migration `0008` adds three (`pending_orders`):

| Type | A buy waits for | A sell waits for |
| --- | --- | --- |
| **Limit** | price to fall to the level | price to rise to the level |
| **Stop** | price to rise to the level | price to fall to the level — a stop-loss |
| **Scheduled** | a moment, then fills at market | a moment, then fills at market |

Plus an optional expiry and a cancel. Getting a limit and a stop the wrong way
round would be silent, so `order_is_triggered()` is asserted directly for all
four price cases rather than inferred from a fill.

**A resting order is not a reservation.** Cash is checked and taken when it
fills, exactly as for an immediate trade, so a triggered order can still be
refused for want of funds. The refusal is written onto the order with the reason
the engine gave, because "why didn't my order fill" is the question this table
exists to answer. Filling goes through `trade()`, so every rule an immediate
order obeys applies: the funds check, the holding check, the refusal to cross
through zero.

**Settlement is opportunistic, and the app says so.** There is no always-on
process watching prices. Whenever a page has just fetched a fresh price, it hands
that price to `settle_pending_orders()`, which resolves whatever that price
reaches. An order therefore fills when someone looks, not the instant the market
crosses it — the orders tab states this plainly rather than implying a precision
the app does not have. `expire_pending_orders()` sweeps deadlines on assets
nobody has opened, so a forgotten order cannot rest past its own expiry for ever.

On trust: `settle_pending_orders()` is handed the price to fill at, the same way
`trade()` always has been. A hostile client could name any price. That is the
trust model the immediate path already had and the money is imaginary, but it is
a deliberate choice rather than an oversight — moving it server-side means giving
a Vercel function the service role key, and the note sits in the migration so the
trade-off is visible.

### What trading costs is a choice

One hardcoded rate for everybody is a reasonable default and a poor teacher.
What a trade costs is the biggest difference between brokers and the thing a
beginner is least likely to check, so migration `0007` puts the rates in a
table and lets the account pick one:

| Profile | Spread (shares) | Commission | Minimum |
| --- | --- | --- | --- |
| House default | 0.05% | 0.02% | $0.50 |
| Commission-free | 0.12% | none | none |
| Per share | 0.05% | $0.005/share | $1.00 |
| Percentage | 0.05% | 0.10% | $5.00 |
| Retail bank | 0.08% | 0.40% | $15.00 |

These are **shapes that are common in the market, not any particular broker's
published rates**, and they are not kept current with anyone's. The app says so
next to the picker.

The shapes teach different things. Commission-free is not free — the money is in
the wider spread, and a round trip can cost more than a commission would have. A
per-share charge is indifferent to price, so a thousand shares cost the same at
$10 or $90. A retail bank's minimum takes 15% of a $100 trade, which is why
small trades through a bank rarely make sense. The tests assert each of those.

Because a per-unit charge is genuinely not a percentage, the commission gained a
per-unit term rather than being approximated in basis points:

```
fee = max(notional * commission_bps / 10000 + quantity * per_unit, minimum)
```

`trading_costs()` keeps its name and now returns the **caller's** rates, so the
panel still quotes exactly what the engine will charge. Switching profile only
affects future fills: a position already open keeps the price and fee it filled
at, and there is a test for that.

### Something to trade

Eight assets was a demo. There are now 74: large US companies across several
sectors, index and sector funds, and two dozen crypto pairs. The asset picker
became a searchable combobox at that size — a plain dropdown longer than the
screen with nothing to type into is not a picker — and it filters on ticker *and*
name, so "gold" finds GLD.

Every ticker was checked against the live price proxy for real bars and a
plausible price before being seeded, which caught two that would have shipped
broken: `MATIC-USD` returns no history at all now, and `UNI-USD` is a token
called UNICORN trading four orders of magnitude away from Uniswap. Uniswap is
`UNI7083-USD`.

### Choosing how much to start with

A new account picks from $100, $1,000, $10,000 or $100,000 (migration `0005`).
Everyone starting with $100,000 was a poor teacher: on that balance the $0.50
minimum commission is invisible, while on $100 it is half a percent of the
account per fill, and a round trip costs over 1%. The tests assert exactly that.

`starting_balance_options()` is the single source of truth, so the signup form
and the provisioning trigger cannot disagree. Signup metadata is whatever the
caller posts, so the trigger validates against that list and quietly falls back
to the default — an account cannot fund itself with an arbitrary number.

The amount is recorded in `portfolios.starting_balance`, because a portfolio
that does not remember what it began with cannot tell you your return.

### Trading is not free

Until migration `0004` a round trip at an unchanged price cost exactly nothing,
which taught the opposite of the truth. Two costs are now charged by the
database, so a client cannot talk its way out of them:

| | |
| --- | --- |
| **Spread** | You buy at the ask and sell at the bid, never at the mid. Half the spread on the way in, half on the way out. 5 bps on equities, 20 bps on crypto — crypto genuinely is wider. |
| **Commission** | 2 bps of notional with a $0.50 floor, charged per fill, so a round trip pays it twice. |

`trading_costs(asset_type)` exposes the rates so the trade panel quotes exactly
what the engine will charge, rather than keeping its own copy that could drift.
`transactions` records `entry_mid` / `exit_mid` alongside the fill prices, so a
learner can see what they asked for and what they got.

Affordability now includes the commission. A trade whose notional fits but
whose commission does not is refused — the old code let it through.

### A short can lose more than it reserved

0001 required `cash_balance >= 0`. That is wrong for shorts: if price more than
doubles, closing costs more than the collateral taken at open, and the
constraint would block the close and **strand the position** — the worst
outcome available. The constraint is dropped; opening is still gated on
available cash, so a negative balance can only result from a trade that ran
against the user. The portfolio page says so plainly when it happens, and new
positions are refused until the balance recovers.

### Tests

Nine suites, 253 checks. `trading_engine_test.sql` covers the accounting
identity, both directions, rejected inputs, double settlement, cross-account
access and every removed write path; `execution_costs_test.sql` owns the exact
arithmetic of spread and commission; `starting_balance_test.sql` covers
provisioning and its validation; `commission_profiles_test.sql` covers the cost
profiles, including that the quote matches the charge and that switching does
not rewrite an open position; `pending_orders_test.sql` covers all four trigger
directions, expiry, rejection with a reason, and that orders are private;
`watchlist_test.sql` covers the idempotent toggle, the cap, privacy, and that a
reset leaves the list alone; `price_alerts_test.sql` covers both directions,
firing exactly once, the shape constraint on a fired row, privacy, and that a
reset leaves the alerts alone; `trailing_stops_test.sql` covers the ratchet in
both directions, that a new peak cannot fire the stop it just moved, the
refusals, and that a stranger's prices move nobody else's stop;
`netting_test.sql` covers the holding rules, the opt-in short switch, resetting,
and the migration that nets legacy rows.

The first asserts relationships rather than literal amounts — a rate change
moves every figure, and a test that hardcodes them fails without anything being
wrong.

```bash
npx supabase start   # or any Postgres
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/harness.sql
for m in supabase/migrations/*.sql; do
  psql "$DB" -v ON_ERROR_STOP=1 -f "$m"
done
for t in trading_engine execution_costs starting_balance \
         commission_profiles pending_orders watchlist price_alerts \
         trailing_stops netting; do
  psql "$DB" -v ON_ERROR_STOP=1 -f "supabase/tests/${t}_test.sql"
done
```

Run `netting_test.sql` last: its final section re-applies migration `0006` to
exercise the netting of legacy rows, so it leaves the schema rebuilt rather than
as the earlier suites found it.

`harness.sql` is a small stand-in for the parts of Supabase the migrations
touch (`auth.users`, `auth.uid()`, the `authenticated` role), so this runs
against a plain Postgres — which is how it runs in CI on every push.

## The AI mentor

Each cached signal carries a two-sentence, plain-language explanation, shown in
its own card directly beneath the chart.

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

About $0.00085 per summary on the default model, so both languages across eight
assets is roughly **$0.014 a run** — about **$0.40 a month** on the daily
schedule in `.github/workflows/refresh-gann-signals.yml`.

Without a key the signals are still computed and cached, just without the
summary, and the panel says how to get one.

### Model

Defaults to `anthropic/claude-haiku-4.5`. Note these are OpenRouter's slugs, not
Anthropic's — `anthropic/claude-haiku-4.5`, not `claude-haiku-4.5`. Override with
`OPENROUTER_MODEL`.

A small model is the right tool here: the engine has already done the reasoning,
and the prompt hands over a handful of numbers to rephrase. Measured across all
eight seeded assets in both languages, the default produced 16 clean summaries
out of 16 for $0.0136 a run, against $0.1124 for the largest model.

Free models were tried and rejected. Across 18 calls to three of OpenRouter's
free-tier models, one usable summary came back; the rest were 429s and empty
completions. The cheapest paid models are cheaper still, but the ones tested
answered a Hebrew prompt in English, which fails half of what this app asks for.
If you only need English, they are worth revisiting.

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
