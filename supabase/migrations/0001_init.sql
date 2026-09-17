-- invest-pal: core schema, row level security and new-user provisioning.
--
-- Safe to run more than once: every object is created with IF NOT EXISTS or
-- dropped first, so re-pasting this file into the Supabase SQL editor will not
-- error out.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- User profile data that does not belong in auth.users.
-- Supabase owns identity (auth.users); this row hangs off it 1:1.
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text,
  display_name      text,
  experience_level  text not null default 'beginner'
                      check (experience_level in ('beginner', 'intermediate', 'advanced')),
  created_at        timestamptz not null default now()
);

-- One virtual portfolio per user, seeded with $100,000 of play money.
create table if not exists public.portfolios (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  -- Uninvested virtual cash. Positions hold the rest; see transactions.
  cash_balance  numeric(18, 2) not null default 100000.00 check (cash_balance >= 0),
  created_at    timestamptz not null default now()
);

-- Tradable instruments. Shared across all users, so it is read-only to them.
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  ticker      text not null unique,
  name        text not null,
  type        text not null check (type in ('STOCK', 'CRYPTO')),
  created_at  timestamptz not null default now()
);

-- Every virtual trade. An OPEN row is a live position; CLOSED rows are history.
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios (id) on delete cascade,
  asset_id      uuid not null references public.assets (id) on delete restrict,
  direction     text not null check (direction in ('LONG', 'SHORT')),
  quantity      numeric(18, 8) not null check (quantity > 0),
  entry_price   numeric(18, 8) not null check (entry_price > 0),
  exit_price    numeric(18, 8) check (exit_price > 0),
  status        text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  -- An open position has no exit; a closed one must have both exit fields.
  constraint transactions_status_consistent check (
    (status = 'OPEN'   and exit_price is null     and closed_at is null)
    or
    (status = 'CLOSED' and exit_price is not null and closed_at is not null)
  )
);

create index if not exists transactions_portfolio_status_idx
  on public.transactions (portfolio_id, status);

-- Cache of Gann engine output so we do not recompute (or re-pay for) the same
-- analysis on every page view. Written by the server, read by everyone.
create table if not exists public.gann_signals (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references public.assets (id) on delete cascade,
  timeframe      text not null default '1d',
  -- { angles: [...], square_of_nine: {...}, cycles: [...] } — shape is owned by
  -- the Phase 4 Python engine, kept as jsonb so it can evolve without a migration.
  payload        jsonb not null,
  -- Phase 6 fills this with the plain-language mentor explanation.
  ai_summary     text,
  calculated_at  timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '6 hours'),
  unique (asset_id, timeframe, calculated_at)
);

create index if not exists gann_signals_lookup_idx
  on public.gann_signals (asset_id, timeframe, calculated_at desc);

-- ---------------------------------------------------------------------------
-- Provision a profile and a funded portfolio for every new signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_level text;
begin
  -- Signup metadata is user-supplied, so fall back rather than trip the
  -- profiles check constraint and fail the whole signup.
  requested_level := nullif(new.raw_user_meta_data ->> 'experience_level', '');
  if requested_level is null
     or requested_level not in ('beginner', 'intermediate', 'advanced') then
    requested_level := 'beginner';
  end if;

  insert into public.profiles (id, email, display_name, experience_level)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    requested_level
  )
  on conflict (id) do nothing;

  insert into public.portfolios (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.portfolios    enable row level security;
alter table public.assets        enable row level security;
alter table public.transactions  enable row level security;
alter table public.gann_signals  enable row level security;

-- Profiles: a user sees and edits only their own.
drop policy if exists "profiles are self-readable" on public.profiles;
create policy "profiles are self-readable"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles are self-writable" on public.profiles;
create policy "profiles are self-writable"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Portfolios: readable by the owner. Inserts come from the signup trigger and
-- balance changes from the Phase 5 trade engine, so no client INSERT/DELETE.
drop policy if exists "portfolios are self-readable" on public.portfolios;
create policy "portfolios are self-readable"
  on public.portfolios for select
  using (auth.uid() = user_id);

drop policy if exists "portfolios are self-writable" on public.portfolios;
create policy "portfolios are self-writable"
  on public.portfolios for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Assets: shared reference data, readable by any signed-in user. Only the
-- service role may change the list.
drop policy if exists "assets are readable when signed in" on public.assets;
create policy "assets are readable when signed in"
  on public.assets for select
  to authenticated
  using (true);

-- Transactions: scoped to the portfolios the user owns.
drop policy if exists "transactions are self-readable" on public.transactions;
create policy "transactions are self-readable"
  on public.transactions for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = transactions.portfolio_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "transactions are self-insertable" on public.transactions;
create policy "transactions are self-insertable"
  on public.transactions for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = transactions.portfolio_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "transactions are self-updatable" on public.transactions;
create policy "transactions are self-updatable"
  on public.transactions for update
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = transactions.portfolio_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = transactions.portfolio_id
        and p.user_id = auth.uid()
    )
  );

-- Gann signals: shared cache, readable when signed in, written server-side.
drop policy if exists "gann signals are readable when signed in" on public.gann_signals;
create policy "gann signals are readable when signed in"
  on public.gann_signals for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Seed a starter watchlist
-- ---------------------------------------------------------------------------

insert into public.assets (ticker, name, type) values
  ('AAPL',    'Apple Inc.',            'STOCK'),
  ('MSFT',    'Microsoft Corporation', 'STOCK'),
  ('NVDA',    'NVIDIA Corporation',    'STOCK'),
  ('TSLA',    'Tesla, Inc.',           'STOCK'),
  ('SPY',     'SPDR S&P 500 ETF',      'STOCK'),
  ('BTC-USD', 'Bitcoin',               'CRYPTO'),
  ('ETH-USD', 'Ethereum',              'CRYPTO'),
  ('SOL-USD', 'Solana',                'CRYPTO')
on conflict (ticker) do nothing;
