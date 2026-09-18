-- invest-pal: net positions, so an account behaves like an account.
--
-- Until now every order wrote a new row. Nothing stopped a portfolio holding a
-- LONG and a SHORT on the same asset at once, or five separate AAPL longs that
-- any broker would have netted into one holding. Worse, you could "sell" an
-- asset you had never bought — which is not selling, it is shorting, and it
-- happened by accident because the button said Sell.
--
-- From here a portfolio has at most one open position per asset, and Buy and
-- Sell move it:
--
--   flat,  buy    open a long
--   flat,  sell   refused, unless the account has short selling switched on
--   long,  buy    add; the entry becomes the weighted average
--   long,  sell   sell what you hold, up to the quantity you hold
--   short, sell   add to the short
--   short, buy    cover, up to the quantity you are short
--
-- An order that would cross through zero is refused rather than flipped. Being
-- able to turn a long into a short with one tap is exactly the accident this
-- migration exists to prevent.
--
-- Short selling is off by default and switched on per account, because on a
-- real retail account it needs a margin agreement — it is not somewhere you
-- arrive by mistake.
--
-- Also here: reset_portfolio(), so a practice account can be started over.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Selling what you do not own is a decision, not a default
-- ---------------------------------------------------------------------------

alter table public.portfolios
  add column if not exists short_selling_enabled boolean not null default false;

comment on column public.portfolios.short_selling_enabled is
  'Whether this account may sell an asset it does not hold. Off by default: a '
  'real retail account needs a margin agreement to short.';

-- ---------------------------------------------------------------------------
-- Net whatever the old engine left behind
-- ---------------------------------------------------------------------------

-- Same-direction duplicates merge exactly. The cash a fill posted is
-- quantity * entry_price, so a weighted-average entry preserves the total to
-- the cent — no money is created or destroyed by this step.
do $$
declare
  r record;
begin
  for r in
    select portfolio_id,
           asset_id,
           direction,
           sum(quantity)                                   as qty,
           sum(quantity * entry_price)                     as notional,
           sum(quantity * coalesce(entry_mid, entry_price)) as mid_notional,
           sum(open_fee)                                   as fees,
           min(opened_at)                                  as opened,
           (array_agg(id order by opened_at, id))[1]       as keep
      from public.transactions
     where status = 'OPEN'
     group by portfolio_id, asset_id, direction
    having count(*) > 1
  loop
    update public.transactions
       set quantity    = r.qty,
           entry_price = r.notional / r.qty,
           entry_mid   = r.mid_notional / r.qty,
           open_fee    = r.fees,
           opened_at   = r.opened
     where id = r.keep;

    delete from public.transactions
     where status = 'OPEN'
       and portfolio_id = r.portfolio_id
       and asset_id = r.asset_id
       and direction = r.direction
       and id <> r.keep;
  end loop;
end $$;

-- A simultaneous long and short on one asset was never a state a broker could
-- produce. Unwind the later leg at its own entry price: the cash it posted
-- comes back exactly, no result is realised, and nothing is invented. After the
-- merge above there is at most one leg per direction, so this leaves one.
do $$
declare
  r      record;
  v_late public.transactions;
begin
  for r in
    select portfolio_id, asset_id
      from public.transactions
     where status = 'OPEN'
     group by portfolio_id, asset_id
    having count(distinct direction) > 1
  loop
    select * into v_late
      from public.transactions
     where status = 'OPEN'
       and portfolio_id = r.portfolio_id
       and asset_id = r.asset_id
     order by opened_at desc, id desc
     limit 1;

    update public.portfolios
       set cash_balance = cash_balance + round(v_late.quantity * v_late.entry_price, 2)
     where id = v_late.portfolio_id;

    update public.transactions
       set exit_price = entry_price,
           exit_mid   = coalesce(entry_mid, entry_price),
           close_fee  = 0,
           status     = 'CLOSED',
           closed_at  = now()
     where id = v_late.id;
  end loop;
end $$;

-- The invariant, enforced by the database rather than by the functions' good
-- behaviour: one open position per asset, per portfolio.
create unique index if not exists transactions_one_open_per_asset_idx
  on public.transactions (portfolio_id, asset_id)
  where status = 'OPEN';

-- ---------------------------------------------------------------------------
-- One entry point for every order
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

  select * into v_costs from public.trading_costs(v_asset_type);

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
    v_fee := greatest(
      round(v_notional * v_costs.commission_bps / 10000.0, 2),
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
      round(p_quantity * v_fill * v_costs.commission_bps / 10000.0, 2),
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

comment on function public.trade(uuid, text, numeric, numeric, boolean) is
  'Buy or sell an asset. Adjusts the single open position for that asset '
  'rather than opening a second one, and refuses an order that would cross '
  'through zero.';

-- ---------------------------------------------------------------------------
-- The old entry points, kept as thin wrappers
-- ---------------------------------------------------------------------------

create or replace function public.open_position(
  p_asset_id  uuid,
  p_direction text,
  p_quantity  numeric,
  p_price     numeric
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_direction is null or p_direction not in ('LONG', 'SHORT') then
    raise exception 'Direction must be LONG or SHORT.' using errcode = '22023';
  end if;

  -- Opening a LONG is buying and opening a SHORT is selling. If the asset is
  -- already held, this adds to that holding rather than opening a second one.
  return public.trade(
    p_asset_id,
    case p_direction when 'LONG' then 'BUY' else 'SELL' end,
    p_quantity,
    p_price
  );
end;
$$;

create or replace function public.close_position(
  p_transaction_id uuid,
  p_price          numeric
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_txn  public.transactions;
begin
  if v_user is null then
    raise exception 'You must be signed in to trade.' using errcode = '28000';
  end if;

  -- Joined to the owner's portfolio, so a stranger probing ids gets the same
  -- message as someone naming one that does not exist.
  select t.* into v_txn
    from public.transactions t
    join public.portfolios p on p.id = t.portfolio_id
   where t.id = p_transaction_id
     and p.user_id = v_user;

  if not found then
    raise exception 'Position not found.' using errcode = '23503';
  end if;

  if v_txn.status <> 'OPEN' then
    raise exception 'That position is already closed.' using errcode = '23514';
  end if;

  -- Reduce-only: this read is not under the portfolio lock, so a second close
  -- arriving at the same moment must be refused inside trade() rather than
  -- here, where it would still look open.
  return public.trade(
    v_txn.asset_id,
    case v_txn.direction when 'LONG' then 'SELL' else 'BUY' end,
    v_txn.quantity,
    p_price,
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Switching short selling on
-- ---------------------------------------------------------------------------

create or replace function public.set_short_selling(p_enabled boolean)
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

  -- Switching it off never strands an open short: covering is a BUY, which
  -- reduces the position and does not consult this flag.
  update public.portfolios
     set short_selling_enabled = coalesce(p_enabled, false)
   where user_id = v_user
  returning * into v_row;

  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  return v_row;
end;
$$;

comment on function public.set_short_selling(boolean) is
  'Allow or forbid selling an asset this account does not hold.';

-- ---------------------------------------------------------------------------
-- Starting over
-- ---------------------------------------------------------------------------

create or replace function public.reset_portfolio(p_starting_balance numeric default null)
returns public.portfolios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_portfolio public.portfolios;
  v_balance   numeric(18, 2);
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  select * into v_portfolio
    from public.portfolios
   where user_id = v_user
     for update;

  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  -- Omitting the amount keeps whatever the account was last funded with.
  v_balance := coalesce(p_starting_balance, v_portfolio.starting_balance);

  -- Unlike signup metadata, this is a deliberate choice made by someone who is
  -- already signed in, so an amount nobody offered is refused outright rather
  -- than quietly swapped for the default.
  if not (v_balance = any (public.starting_balance_options())) then
    raise exception 'That starting balance is not one of the amounts on offer.'
      using errcode = '22023';
  end if;

  -- Open positions included: there is nothing to settle, because the account
  -- they belonged to is being replaced rather than wound down.
  delete from public.transactions where portfolio_id = v_portfolio.id;

  update public.portfolios
     set cash_balance     = v_balance,
         starting_balance = v_balance
   where id = v_portfolio.id
  returning * into v_portfolio;

  return v_portfolio;
end;
$$;

comment on function public.reset_portfolio(numeric) is
  'Delete every trade and re-fund the account, optionally at a different one of '
  'the offered starting balances.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.trade(uuid, text, numeric, numeric, boolean) from public;
revoke all on function public.set_short_selling(boolean) from public;
revoke all on function public.reset_portfolio(numeric) from public;

grant execute on function public.trade(uuid, text, numeric, numeric, boolean) to authenticated;
grant execute on function public.set_short_selling(boolean) to authenticated;
grant execute on function public.reset_portfolio(numeric) to authenticated;
