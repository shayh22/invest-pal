-- invest-pal: choose what trading costs you, and something to trade it on.
--
-- Two changes that belong together, because both are about the paper account
-- resembling a real one.
--
-- 1. Costs were one hardcoded rate for everybody: 5 bps of spread, 2 bps of
--    commission, a $0.50 floor. That is a reasonable default and a poor
--    teacher, because what a trade costs is the single biggest difference
--    between brokers and the thing a beginner is least likely to check. The
--    rates now come from a named profile the account picks.
--
--    The profiles are shaped after pricing that is common in the market, not
--    copied from any particular firm — nobody's published rates are quoted
--    here, and real ones change. They are labelled by what they are:
--
--      commission_free  no commission, a wider spread instead. The spread is
--                       where a "free" broker is actually paid.
--      per_share        a few tenths of a cent per share with a floor, the
--                       usual shape for a US direct-access broker.
--      percentage       a tenth of a percent with a small floor.
--      bank             several tenths of a percent with a high floor, which
--                       is what trading through a retail bank tends to cost.
--      standard         what this app charged before, kept as the default so
--                       existing accounts are unaffected.
--
--    A per-unit charge is genuinely different from a percentage — it is
--    indifferent to price — so the commission gains a per-unit term rather
--    than being approximated in basis points.
--
-- 2. Eight assets was a demo. This adds enough to practise on: large US
--    companies across several sectors, index and sector ETFs, and a wider set
--    of crypto. Everything here is a ticker Yahoo Finance serves, which is the
--    only thing the price proxy needs.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- What a broker charges
-- ---------------------------------------------------------------------------

create table if not exists public.commission_profiles (
  key                 text primary key,
  stock_spread_bps    numeric(10, 4) not null check (stock_spread_bps >= 0),
  crypto_spread_bps   numeric(10, 4) not null check (crypto_spread_bps >= 0),
  commission_bps      numeric(10, 4) not null check (commission_bps >= 0),
  min_commission      numeric(10, 2) not null check (min_commission >= 0),
  commission_per_unit numeric(10, 4) not null default 0 check (commission_per_unit >= 0),
  sort_order          integer not null
);

comment on table public.commission_profiles is
  'Named cost profiles shaped after pricing common in the market. Not the '
  'published rates of any particular broker, and not kept current with any.';

insert into public.commission_profiles
  (key, stock_spread_bps, crypto_spread_bps, commission_bps, min_commission,
   commission_per_unit, sort_order)
values
  -- The house default, unchanged, so nothing that exists starts costing more.
  ('standard',        5,   20,  2,    0.50, 0,      1),
  -- No commission at all; the wider spread is where the money is made.
  ('commission_free', 12,  35,  0,    0,    0,      2),
  -- Half a cent a share, one dollar minimum.
  ('per_share',       5,   20,  0,    1.00, 0.005,  3),
  -- A tenth of a percent, five dollar minimum.
  ('percentage',      5,   20,  10,   5.00, 0,      4),
  -- Four tenths of a percent with a high floor: the retail bank shape, where a
  -- small trade is dominated by the minimum.
  ('bank',            8,   30,  40,   15.00, 0,     5)
on conflict (key) do update set
  stock_spread_bps    = excluded.stock_spread_bps,
  crypto_spread_bps   = excluded.crypto_spread_bps,
  commission_bps      = excluded.commission_bps,
  min_commission      = excluded.min_commission,
  commission_per_unit = excluded.commission_per_unit,
  sort_order          = excluded.sort_order;

alter table public.commission_profiles enable row level security;

drop policy if exists "commission profiles are readable" on public.commission_profiles;
create policy "commission profiles are readable"
  on public.commission_profiles for select
  using (true);

alter table public.portfolios
  add column if not exists commission_profile text not null default 'standard'
    references public.commission_profiles (key);

comment on column public.portfolios.commission_profile is
  'Which cost profile this account trades under. Chosen by its owner; the '
  'engine reads it rather than trusting anything the client sends.';

-- ---------------------------------------------------------------------------
-- Quoting a profile
-- ---------------------------------------------------------------------------

create or replace function public.trading_costs_for(
  p_profile    text,
  p_asset_type text default 'STOCK'
)
returns table (
  spread_bps          numeric,
  commission_bps      numeric,
  min_commission      numeric,
  commission_per_unit numeric
)
language sql
stable
set search_path = ''
as $$
  select
    case when p_asset_type = 'CRYPTO' then p.crypto_spread_bps else p.stock_spread_bps end,
    p.commission_bps,
    p.min_commission,
    p.commission_per_unit
    from public.commission_profiles p
   where p.key = coalesce(p_profile, 'standard')
$$;

-- The caller's own rates. Same name as before so the UI keeps quoting exactly
-- what the engine will charge, but the numbers now depend on the account rather
-- than being the same for everyone.
--
-- Dropped rather than replaced: the result gains a column, and Postgres will
-- not change a function's return type in place.
drop function if exists public.trading_costs(text);

create or replace function public.trading_costs(p_asset_type text default 'STOCK')
returns table (
  spread_bps          numeric,
  commission_bps      numeric,
  min_commission      numeric,
  commission_per_unit numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select *
    from public.trading_costs_for(
      coalesce(
        (select commission_profile from public.portfolios where user_id = auth.uid()),
        'standard'
      ),
      p_asset_type
    )
$$;

comment on function public.trading_costs(text) is
  'Spread and commission this account pays, exposed so the UI can quote the '
  'same numbers the trade engine will charge.';

create or replace function public.set_commission_profile(p_profile text)
returns public.portfolios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.portfolios;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  if not exists (select 1 from public.commission_profiles where key = p_profile) then
    raise exception 'Unknown commission profile.' using errcode = '23503';
  end if;

  -- Open positions keep the entry price and fee they were actually filled at;
  -- only what the next fill costs changes. Anything else would rewrite history.
  update public.portfolios
     set commission_profile = p_profile
   where user_id = v_user
  returning * into v_row;

  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- The engine charges the account's own rates
-- ---------------------------------------------------------------------------

create or replace function public.trade(
  p_asset_id    uuid,
  p_side        text,
  p_quantity    numeric,
  p_price       numeric,
  p_reduce_only boolean default false
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := auth.uid();
  v_portfolio  public.portfolios;
  v_asset_type text;
  v_costs      record;
  v_open       public.transactions;
  v_has_open   boolean;
  v_holding    numeric;        -- signed: positive long, negative short
  v_order      numeric;        -- signed order
  v_direction  text;
  v_fill       numeric(18, 8);
  v_notional   numeric(18, 2);
  v_fee        numeric(18, 2);
  v_share      numeric(18, 2); -- the closed portion's share of the open fee
  v_pnl        numeric;
  v_proceeds   numeric(18, 2);
  v_row        public.transactions;
begin
  if v_user is null then
    raise exception 'You must be signed in to trade.' using errcode = '28000';
  end if;

  if p_side is null or p_side not in ('BUY', 'SELL') then
    raise exception 'Side must be BUY or SELL.' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = '22023';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'Price must be greater than zero.' using errcode = '22023';
  end if;

  select type into v_asset_type from public.assets where id = p_asset_id;
  if not found then
    raise exception 'Unknown asset.' using errcode = '23503';
  end if;

  -- Portfolio first, then the position. Every path takes the two locks in this
  -- order, so two orders racing on one account queue rather than deadlock, and
  -- neither can read a balance the other is about to change.
  select * into v_portfolio
    from public.portfolios
   where user_id = v_user
     for update;

  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  -- Read from the locked row, not from auth.uid() again: the rates charged are
  -- the ones this account held when the order was accepted.
  select * into v_costs
    from public.trading_costs_for(v_portfolio.commission_profile, v_asset_type);

  select * into v_open
    from public.transactions
   where portfolio_id = v_portfolio.id
     and asset_id = p_asset_id
     and status = 'OPEN'
     for update;

  v_has_open := found;
  v_holding := case
                 when not v_has_open then 0
                 when v_open.direction = 'LONG' then v_open.quantity
                 else -v_open.quantity
               end;
  v_order := case p_side when 'BUY' then p_quantity else -p_quantity end;

  -- close_position passes this. Without it, a second close arriving after the
  -- first has already settled the position would find a flat account and open a
  -- fresh short instead of failing.
  if p_reduce_only and (v_holding = 0 or sign(v_holding) = sign(v_order)) then
    raise exception 'That position is already closed.' using errcode = '23514';
  end if;

  if v_holding = 0 or sign(v_holding) = sign(v_order) then
    -- ---- opening, or adding to what is already there ----
    if p_side = 'SELL' and not v_portfolio.short_selling_enabled then
      raise exception
        'You do not hold this asset, so there is nothing to sell. Selling what '
        'you do not own is short selling, and this account does not have it '
        'switched on.'
        using errcode = '23514';
    end if;

    v_direction := case when v_order > 0 then 'LONG' else 'SHORT' end;

    -- A long buys at the ask, a short sells at the bid: half the spread either
    -- way, always against the trader.
    v_fill := case v_direction
                when 'LONG'  then p_price * (1 + v_costs.spread_bps / 20000.0)
                when 'SHORT' then p_price * (1 - v_costs.spread_bps / 20000.0)
              end;

    v_notional := round(p_quantity * v_fill, 2);
    -- Percentage and per-unit are both charged, then floored. A profile sets
    -- one or the other in practice, but nothing here assumes that.
    v_fee := greatest(
      round(
        v_notional * v_costs.commission_bps / 10000.0
        + p_quantity * v_costs.commission_per_unit,
        2
      ),
      v_costs.min_commission
    );

    if v_notional + v_fee > v_portfolio.cash_balance then
      raise exception
        'Not enough virtual cash: this costs % plus % in fees, and the balance is %.',
        v_notional, v_fee, v_portfolio.cash_balance
        using errcode = '23514';
    end if;

    update public.portfolios
       set cash_balance = cash_balance - v_notional - v_fee
     where id = v_portfolio.id;

    if not v_has_open then
      insert into public.transactions
        (portfolio_id, asset_id, direction, quantity, entry_price, entry_mid, open_fee)
      values
        (v_portfolio.id, p_asset_id, v_direction, p_quantity, v_fill, p_price, v_fee)
      returning * into v_row;
    else
      -- Every right-hand side below reads the row as it was before this
      -- statement, so the old quantity is what weights the old entry.
      update public.transactions
         set entry_price = (quantity * entry_price + p_quantity * v_fill)
                           / (quantity + p_quantity),
             entry_mid   = (quantity * coalesce(entry_mid, entry_price)
                            + p_quantity * p_price)
                           / (quantity + p_quantity),
             open_fee    = open_fee + v_fee,
             quantity    = quantity + p_quantity
       where id = v_open.id
      returning * into v_row;
    end if;
  else
    -- ---- reducing, closing, or refusing to flip ----
    if p_quantity > v_open.quantity then
      raise exception
        'You hold % of this asset, so % cannot be sold. Close what you have '
        'first if you want to take the other side.',
        v_open.quantity, p_quantity
        using errcode = '23514';
    end if;

    -- Closing crosses the spread the other way: a long sells at the bid, a
    -- short buys back at the ask.
    v_fill := case v_open.direction
                when 'LONG'  then p_price * (1 - v_costs.spread_bps / 20000.0)
                when 'SHORT' then p_price * (1 + v_costs.spread_bps / 20000.0)
              end;

    v_pnl := case v_open.direction
               when 'LONG'  then p_quantity * (v_fill - v_open.entry_price)
               when 'SHORT' then p_quantity * (v_open.entry_price - v_fill)
             end;

    v_fee := greatest(
      round(
        p_quantity * v_fill * v_costs.commission_bps / 10000.0
        + p_quantity * v_costs.commission_per_unit,
        2
      ),
      v_costs.min_commission
    );

    -- The portion being sold carries its share of what opening it cost, so the
    -- realised figure on the closed row is net of both fills.
    v_share := round(v_open.open_fee * p_quantity / v_open.quantity, 2);

    v_proceeds := round(p_quantity * v_open.entry_price + v_pnl - v_fee, 2);

    update public.portfolios
       set cash_balance = cash_balance + v_proceeds
     where id = v_portfolio.id;

    if p_quantity = v_open.quantity then
      -- Selling the lot settles the row where it stands. Closing in place keeps
      -- the id stable, so anything already holding a reference to this position
      -- still resolves to it afterwards.
      update public.transactions
         set exit_price = v_fill,
             exit_mid   = p_price,
             close_fee  = v_fee,
             status     = 'CLOSED',
             closed_at  = now()
       where id = v_open.id
      returning * into v_row;
    else
      -- A partial sale has to split: the sold portion becomes its own settled
      -- row, so a holding sold in pieces leaves one record per piece rather
      -- than one averaged lump, and the rest stays open.
      insert into public.transactions
        (portfolio_id, asset_id, direction, quantity, entry_price, entry_mid,
         exit_price, exit_mid, open_fee, close_fee, status, opened_at, closed_at)
      values
        (v_portfolio.id, p_asset_id, v_open.direction, p_quantity,
         v_open.entry_price, v_open.entry_mid, v_fill, p_price,
         v_share, v_fee, 'CLOSED', v_open.opened_at, now())
      returning * into v_row;

      update public.transactions
         set quantity = quantity - p_quantity,
             open_fee = open_fee - v_share
       where id = v_open.id;
    end if;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Something to trade
-- ---------------------------------------------------------------------------

insert into public.assets (ticker, name, type) values
  -- Technology
  ('AAPL',     'Apple Inc.',                  'STOCK'),
  ('MSFT',     'Microsoft Corporation',       'STOCK'),
  ('NVDA',     'NVIDIA Corporation',          'STOCK'),
  ('GOOGL',    'Alphabet Inc.',               'STOCK'),
  ('AMZN',     'Amazon.com, Inc.',            'STOCK'),
  ('META',     'Meta Platforms, Inc.',        'STOCK'),
  ('AVGO',     'Broadcom Inc.',               'STOCK'),
  ('AMD',      'Advanced Micro Devices',      'STOCK'),
  ('INTC',     'Intel Corporation',           'STOCK'),
  ('CRM',      'Salesforce, Inc.',            'STOCK'),
  ('ORCL',     'Oracle Corporation',          'STOCK'),
  ('ADBE',     'Adobe Inc.',                  'STOCK'),
  ('NFLX',     'Netflix, Inc.',               'STOCK'),
  ('PLTR',     'Palantir Technologies',       'STOCK'),
  ('UBER',     'Uber Technologies, Inc.',     'STOCK'),
  -- Consumer and industrial
  ('TSLA',     'Tesla, Inc.',                 'STOCK'),
  ('KO',       'The Coca-Cola Company',       'STOCK'),
  ('PEP',      'PepsiCo, Inc.',               'STOCK'),
  ('MCD',      'McDonald''s Corporation',     'STOCK'),
  ('NKE',      'NIKE, Inc.',                  'STOCK'),
  ('WMT',      'Walmart Inc.',                'STOCK'),
  ('COST',     'Costco Wholesale',            'STOCK'),
  ('DIS',      'The Walt Disney Company',     'STOCK'),
  ('BA',       'The Boeing Company',          'STOCK'),
  ('CAT',      'Caterpillar Inc.',            'STOCK'),
  -- Financial and health
  ('JPM',      'JPMorgan Chase & Co.',        'STOCK'),
  ('BAC',      'Bank of America Corporation', 'STOCK'),
  ('V',        'Visa Inc.',                   'STOCK'),
  ('MA',       'Mastercard Incorporated',     'STOCK'),
  ('BRK-B',    'Berkshire Hathaway Inc.',     'STOCK'),
  ('JNJ',      'Johnson & Johnson',           'STOCK'),
  ('UNH',      'UnitedHealth Group',          'STOCK'),
  ('PFE',      'Pfizer Inc.',                 'STOCK'),
  ('LLY',      'Eli Lilly and Company',       'STOCK'),
  -- Energy
  ('XOM',      'Exxon Mobil Corporation',     'STOCK'),
  ('CVX',      'Chevron Corporation',         'STOCK'),
  -- Index and sector funds: a whole market in one line, which is the most
  -- useful thing a beginner can hold and the least likely to be offered.
  ('SPY',      'SPDR S&P 500 ETF',            'STOCK'),
  ('QQQ',      'Invesco QQQ Trust',           'STOCK'),
  ('DIA',      'SPDR Dow Jones Industrial',   'STOCK'),
  ('IWM',      'iShares Russell 2000 ETF',    'STOCK'),
  ('VTI',      'Vanguard Total Stock Market', 'STOCK'),
  ('VOO',      'Vanguard S&P 500 ETF',        'STOCK'),
  ('EEM',      'iShares MSCI Emerging Mkts',  'STOCK'),
  ('GLD',      'SPDR Gold Shares',            'STOCK'),
  ('SLV',      'iShares Silver Trust',        'STOCK'),
  ('USO',      'United States Oil Fund',      'STOCK'),
  ('TLT',      'iShares 20+ Year Treasury',   'STOCK'),
  ('XLF',      'Financial Select Sector SPDR','STOCK'),
  ('XLE',      'Energy Select Sector SPDR',   'STOCK'),
  ('XLK',      'Technology Select Sector SPDR','STOCK'),
  -- Crypto
  ('BTC-USD',  'Bitcoin',                     'CRYPTO'),
  ('ETH-USD',  'Ethereum',                    'CRYPTO'),
  ('SOL-USD',  'Solana',                      'CRYPTO'),
  ('XRP-USD',  'XRP',                         'CRYPTO'),
  ('ADA-USD',  'Cardano',                     'CRYPTO'),
  ('DOGE-USD', 'Dogecoin',                    'CRYPTO'),
  ('AVAX-USD', 'Avalanche',                   'CRYPTO'),
  ('DOT-USD',  'Polkadot',                    'CRYPTO'),
  ('LINK-USD', 'Chainlink',                   'CRYPTO'),
  ('LTC-USD',  'Litecoin',                    'CRYPTO'),
  ('BCH-USD',  'Bitcoin Cash',                'CRYPTO'),
  ('ATOM-USD', 'Cosmos',                      'CRYPTO'),
  ('XLM-USD',  'Stellar',                     'CRYPTO'),
  ('TRX-USD',  'TRON',                        'CRYPTO'),
  ('SHIB-USD', 'Shiba Inu',                   'CRYPTO'),
  ('NEAR-USD', 'NEAR Protocol',               'CRYPTO'),
  ('ETC-USD',  'Ethereum Classic',            'CRYPTO'),
  ('HBAR-USD', 'Hedera',                      'CRYPTO'),
  ('ICP-USD',  'Internet Computer',           'CRYPTO'),
  ('ALGO-USD', 'Algorand',                    'CRYPTO'),
  ('FIL-USD',  'Filecoin',                    'CRYPTO'),
  -- Yahoo disambiguates these with a numeric suffix. The bare symbols resolve
  -- to something else entirely: UNI-USD is a token called UNICORN, trading four
  -- orders of magnitude away from Uniswap. Every ticker in this list was
  -- checked against the price proxy for real bars and a plausible price, which
  -- is how that was caught — along with MATIC-USD, which now returns no history
  -- at all and has been dropped rather than left to fail on selection.
  ('UNI7083-USD',  'Uniswap',                 'CRYPTO'),
  ('APT21794-USD', 'Aptos',                   'CRYPTO'),
  ('ARB11841-USD', 'Arbitrum',                'CRYPTO')
on conflict (ticker) do update set name = excluded.name, type = excluded.type;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.trading_costs_for(text, text) from public;
revoke all on function public.set_commission_profile(text) from public;

grant execute on function public.trading_costs_for(text, text) to authenticated;
grant execute on function public.set_commission_profile(text) to authenticated;
grant select on public.commission_profiles to anon, authenticated;
