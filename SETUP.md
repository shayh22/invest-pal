# Setup

## What you need an account for

| Service | Needed for | Cost | When |
| --- | --- | --- | --- |
| [Supabase](https://supabase.com/dashboard) | Accounts, portfolios, trades | Free tier is plenty | **Now (Phase 2)** |
| A market data API | Not needed — Yahoo Finance requires no key | free | — |
| [OpenRouter](https://openrouter.ai) | AI mentor explanations | Free (free-model router; 50 requests a day) | Optional |

Right now you only need **Supabase**. The app runs without it — it just shows
setup instructions instead of the sign-in form.

The Gann engine needs no account either: it is plain Python, and it writes to
the same Supabase project. See "Populating Gann signals" below.

## Option A — hosted Supabase (recommended, no Docker)

1. **Create the project.** Sign up at
   [supabase.com/dashboard](https://supabase.com/dashboard) and create a new
   project. Any region and the free plan are fine. Save the database password
   it asks you to set, though the app itself does not use it.

2. **Create the tables.** In the project sidebar open **SQL Editor** → **New
   query**. Paste the entire contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and
   press **Run**. It creates the five tables, row level security policies, the
   new-user trigger and a starter list of eight tickers. Re-running it is
   harmless.

3. **Turn off email confirmation** (optional, but easiest while developing).
   **Authentication** → **Sign In / Providers** → **Email** → switch off
   *Confirm email*. With it on, new accounts have to click a link in their
   inbox before they can sign in; the app handles both cases and will tell you
   which one applies.

4. **Copy your keys.** **Project Settings** → **API**. You need:
   - *Project URL*
   - *anon* / *public* key — safe to ship in a browser bundle; row level
     security is what protects the data. Never put the `service_role` key in
     any `VITE_*` variable.

5. **Wire them up.**

   ```bash
   cp .env.example .env
   ```

   ```ini
   VITE_SUPABASE_URL=https://<your-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon key>
   ```

6. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   Open the dev server URL, click **Sign in** → **Create account**. You should
   land on a dashboard showing **$100,000.00** in virtual cash.

## Option B — local Supabase (needs Docker)

Everything runs on your machine, no account required.

```bash
npx supabase start     # first run pulls several GB of images
```

It prints an `API_URL` and `ANON_KEY` — put those in `.env` as above.
Migrations in `supabase/migrations/` are applied automatically on start, and
email confirmation is already off in `supabase/config.toml`.

```bash
npx supabase status    # show the URLs and keys again
npx supabase stop      # shut it down
```

## Verifying it worked

In the SQL editor (or `psql` against a local stack):

```sql
select u.email, p.experience_level, pf.cash_balance
from auth.users u
join public.profiles p   on p.id = u.id
join public.portfolios pf on pf.user_id = u.id;
```

One row per signup, each with a `cash_balance` of `100000.00`.

## Troubleshooting

**"Connect Supabase to continue"** — `.env` is missing, has a typo, or the dev
server was not restarted. Vite only reads `.env` at startup.

**"Invalid login credentials" right after signing up** — email confirmation is
on and the address is not confirmed yet. Confirm via the emailed link, or turn
the setting off (step 3).

**Signed in but the balance never appears** — the trigger did not run, usually
because step 2 was only partly applied. Re-run the whole migration, then check:

```sql
select tgname from pg_trigger where tgname = 'on_auth_user_created';
```

**"Database error saving new user" on signup** — same cause. The trigger
inserts into `public.profiles` and `public.portfolios`, so both tables must
exist before the first signup.

## How the pieces fit

- Supabase owns identity in `auth.users`. `public.profiles` hangs off it 1:1
  for app-specific fields (display name, experience level).
- The `on_auth_user_created` trigger runs inside the signup transaction, so a
  new user always gets both a profile and a portfolio funded with $100,000.
- Row level security means every table is deny-by-default, and each policy
  narrows access to `auth.uid()`. A user cannot read or write another user's
  portfolio or trades even though the browser talks to the database directly.
- `assets` and `gann_signals` are shared read-only reference data; only the
  server (service role) writes them.

## Trading

Nothing extra to configure — the trade buttons appear on the Markets page once
you are signed in, and the migration in step 2 installs the two Postgres
functions that settle trades.

If you created your project before Phase 5, run
`supabase/migrations/0002_trading_engine.sql` in the SQL editor as well. It is
idempotent, and it also closes two write paths that the first migration left
open (a client could otherwise edit its own balance).

## Populating Gann signals

The Markets page reads Gann analysis from the `gann_signals` table. Nothing
computes it in the browser, so the table starts empty and the panel tells you
how to fill it.

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>
python -m gann.refresh
```

To include the AI mentor's plain-language summaries, add an OpenRouter key:

```bash
export OPENROUTER_API_KEY=sk-or-...
python -m gann.refresh
```

Get one at [openrouter.ai/keys](https://openrouter.ai/keys). It is optional —
without it everything works except the summary, and the app tells you so. The
default model is OpenRouter's free router, so no credits are needed; a free
account allows 50 requests a day (1,000 with $10 of credits bought). For
stronger Hebrew, `OPENROUTER_MODEL=openai/gpt-5-mini` costs about $2 a month.

Like the service role key, this is server-side only. Never give it a `VITE_`
prefix: anything `VITE_*` is compiled into the JavaScript your users download.

Find the service role key under **Project Settings -> API**. It bypasses row
level security, so keep it out of `.env` and out of anything named `VITE_*` —
it belongs only in the environment of whatever runs the job.

No dependencies to install: the engine is standard-library Python 3.10+.

To keep it fresh automatically, add `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` as GitHub repository secrets (**Settings -> Secrets
and variables -> Actions**) and the included daily workflow takes over.

### Troubleshooting

**"No signal cached for this asset yet"** — the job has not run for that ticker.
Run it, then reload.

**A *Stale* badge on the panel** — the row is past its `expires_at`. It is still
shown, just flagged. Re-run the job.

**`SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set`** — the
environment variables are missing from the shell running the job.

## Deploying to Vercel

The repo carries everything Vercel needs: `vercel.json` and
`api/market/chart.ts`, an Edge Function that proxies market data.

`vercel.json` does three things, and since its schema rejects unknown keys
(including `comment`), the reasoning is here instead:

- **Rewrites** `/((?!api/).*)` to `/index.html`. React Router owns every path,
  so without this a refresh on `/markets` returns 404. Rewrites run after the
  filesystem check, so hashed assets and `/api` routes are unaffected.
- **Caches `/assets/*` forever** — Vite fingerprints those filenames.
- **Never caches `index.html`**, or a deploy would keep serving stale asset
  links. Because that function answers on `/api/market/chart` —
the path the client already defaults to — **a Vercel deploy needs no market
data configuration at all**. Do not set `VITE_MARKET_PROXY_URL`.

### 1. A hosted Supabase project

A deployed frontend cannot reach a local `npx supabase start`. Follow **Option
A** above to create a hosted project and run both migrations, if you have not
already.

### 2. Import the repo

At [vercel.com/new](https://vercel.com/new), import `shayh22/invest-pal`.
Framework, build command and output directory are read from `vercel.json`;
leave them as detected.

### 3. Environment variables

Add these two under **Settings → Environment Variables**, for Production,
Preview and Development:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's anon / publishable key |

Vite inlines `VITE_*` at **build** time, so changing either one needs a
redeploy, not just a restart.

`.vercelignore` keeps local `.env` files off the builder. Without it, deploying
from a machine that has one bakes those values into the production bundle — a
local `http://127.0.0.1:54321` ends up pointing every visitor's browser at
their own machine. Never add `SUPABASE_SERVICE_ROLE_KEY` or
`OPENROUTER_API_KEY` here — anything `VITE_*` ships to the browser, and Vercel
env vars are available to the build regardless. Those two belong only in
whatever runs `python -m gann.refresh`.

If the variables are missing the site still builds and deploys; it just shows
the setup screen instead of the sign-in form.

### 4. Redirect URLs

In Supabase, **Authentication → URL Configuration**, set the Site URL to your
Vercel domain and add `https://<your-app>.vercel.app/**` to the redirect
allow-list. Without this, email confirmation links point at localhost.

### 5. Gann signals

The refresh job is not part of the deployment — it writes to Supabase, which
the site reads. Run it locally once after deploying, or add
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and optionally
`OPENROUTER_API_KEY` as **GitHub** repository secrets and let the included
daily workflow do it.

### Checking the deploy

```bash
curl -s "https://<your-app>.vercel.app/api/market/chart?symbol=AAPL&range=1mo&interval=1d" | head -c 120
```

That should return Yahoo's JSON. Then load `/markets` directly in a browser —
it must render the app, not a 404. If it 404s, `vercel.json` was not picked up.

### Other hosts

Any static host works. Two things have to be arranged that Vercel does for
free here: rewrite unmatched paths to `index.html`, and provide the market data
proxy — deploy `supabase/functions/market-data` and point
`VITE_MARKET_PROXY_URL` at it.
