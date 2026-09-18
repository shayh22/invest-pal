-- invest-pal: realistic execution costs.
--
-- Until now a round trip at an unchanged price cost exactly nothing, which
-- taught the opposite of the truth: that trading is free. Every real fill
-- crosses a spread, and most venues charge commission on top. A beginner who
-- practises without them learns a strategy that dies on contact with a broker.
--
-- Two costs are modelled, both charged by the database so the client cannot
-- talk its way out of them:
--
--   Spread      You buy at the ask and sell at the bid, never at the mid. Half
--               the spread is paid on the way in and half on the way out.
--   Commission  A percentage of notional with a floor, charged per fill, so a
--               round trip pays it twice.
--
-- Crypto carries a wider spread than equities because it genuinely does.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- What a fill costs
-- ---------------------------------------------------------------------------

create or replace function public.trading_costs(p_asset_type text default 'STOCK')
returns table (
  spread_bps      numeric,
  commission_bps  numeric,
  min_commission  numeric
)
language sql
immutable
set search_path = ''
as $$
  -- Basis points: 100 bps = 1%. Deliberately modest — the point is that the
  -- cost is not zero, not to model any particular broker.
  select
    case when p_asset_type = 'CRYPTO' then 20.0 else 5.0 end,
    2.0::numeric,
    0.50::numeric
$$;

comment on function public.trading_costs(text) is
  'Spread and commission applied to a fill, exposed so the UI can quote the '
  'same numbers the trade engine will charge.';

-- ---------------------------------------------------------------------------
-- Record what was asked for and what it cost
-- ---------------------------------------------------------------------------

alter table public.transactions
  add column if not exists entry_mid numeric(18, 8),
  add column if not exists exit_mid  numeric(18, 8),
  add column if not exists open_fee  numeric(18, 2) not null default 0,
  add column if not exists close_fee numeric(18, 2) not null default 0;

comment on column public.transactions.entry_mid is
  'Mid price the trade was requested at. entry_price is the fill after spread.';
comment on column public.transactions.exit_mid is
  'Mid price the close was requested at. exit_price is the fill after spread.';

-- Existing rows predate costs; their fill was the mid.
update public.transactions set entry_mid = entry_price where entry_mid is null;
update public.transactions
   set exit_mid = exit_price
 where exit_mid is null and exit_price is not null;

-- ---------------------------------------------------------------------------
-- open_position
-- ---------------------------------------------------------------------------

create or replace function public.open_position(
  p_asset_id uuid,
  p_direction text,
  p_quantity numeric,
  p_price numeric
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
  v_fill       numeric(18, 8);
  v_notional   numeric(18, 2);
  v_fee        numeric(18, 2);
  v_row        public.transactions;
begin
  if v_user is null then
    raise exception 'You must be signed in to trade.' using errcode = '28000';
  end if;

  if p_direction is null or p_direction not in ('LONG', 'SHORT') then
    raise exception 'Direction must be LONG or SHORT.' using errcode = '22023';
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

  -- A long buys at the ask, a short sells at the bid: half the spread either
  -- way, always against the trader.
  v_fill := case p_direction
              when 'LONG'  then p_price * (1 + v_costs.spread_bps / 20000.0)
              when 'SHORT' then p_price * (1 - v_costs.spread_bps / 20000.0)
            end;

  v_notional := round(p_quantity * v_fill, 2);
  v_fee := greatest(
    round(v_notional * v_costs.commission_bps / 10000.0, 2),
    v_costs.min_commission
  );

  -- FOR UPDATE, not a bare SELECT: two requests arriving together would
  -- otherwise both read the same balance and both pass the funds check, and the
  -- user would spend the same cash twice.
  select * into v_portfolio
    from public.portfolios
   where user_id = v_user
     for update;

  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  -- The commission is cash out of the door at open, so it must be affordable
  -- too, not just the notional.
  if v_notional + v_fee > v_portfolio.cash_balance then
    raise exception
      'Not enough virtual cash: this costs % plus % in fees, and the balance is %.',
      v_notional, v_fee, v_portfolio.cash_balance
      using errcode = '23514';
  end if;

  update public.portfolios
     set cash_balance = cash_balance - v_notional - v_fee
   where id = v_portfolio.id;

  insert into public.transactions
    (portfolio_id, asset_id, direction, quantity, entry_price, entry_mid, open_fee)
  values
    (v_portfolio.id, p_asset_id, p_direction, p_quantity, v_fill, p_price, v_fee)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- close_position
-- ---------------------------------------------------------------------------

create or replace function public.close_position(
  p_transaction_id uuid,
  p_price numeric
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := auth.uid();
  v_txn        public.transactions;
  v_portfolio  public.portfolios;
  v_asset_type text;
  v_costs      record;
  v_fill       numeric(18, 8);
  v_pnl        numeric;
  v_fee        numeric(18, 2);
  v_proceeds   numeric(18, 2);
  v_row        public.transactions;
begin
  if v_user is null then
    raise exception 'You must be signed in to trade.' using errcode = '28000';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'Price must be greater than zero.' using errcode = '22023';
  end if;

  -- Lock the trade before reading its status, so two closes racing on the same
  -- position cannot both settle it and pay out twice.
  select * into v_txn
    from public.transactions
   where id = p_transaction_id
     for update;

  if not found then
    raise exception 'Position not found.' using errcode = '23503';
  end if;

  -- Ownership is checked by locking the portfolio the trade belongs to. The
  -- message is identical to the one above on purpose: a stranger probing ids
  -- should not learn which ones exist.
  select * into v_portfolio
    from public.portfolios
   where id = v_txn.portfolio_id
     and user_id = v_user
     for update;

  if not found then
    raise exception 'Position not found.' using errcode = '23503';
  end if;

  if v_txn.status <> 'OPEN' then
    raise exception 'That position is already closed.' using errcode = '23514';
  end if;

  select type into v_asset_type from public.assets where id = v_txn.asset_id;
  select * into v_costs from public.trading_costs(v_asset_type);

  -- Closing crosses the spread the other way: a long sells at the bid, a short
  -- buys back at the ask.
  v_fill := case v_txn.direction
              when 'LONG'  then p_price * (1 - v_costs.spread_bps / 20000.0)
              when 'SHORT' then p_price * (1 + v_costs.spread_bps / 20000.0)
            end;

  v_pnl := case v_txn.direction
             when 'LONG'  then v_txn.quantity * (v_fill - v_txn.entry_price)
             when 'SHORT' then v_txn.quantity * (v_txn.entry_price - v_fill)
           end;

  v_fee := greatest(
    round(v_txn.quantity * v_fill * v_costs.commission_bps / 10000.0, 2),
    v_costs.min_commission
  );

  -- Closing hands back what opening reserved, plus or minus the result, less
  -- the commission on this fill.
  v_proceeds := round(v_txn.quantity * v_txn.entry_price + v_pnl - v_fee, 2);

  update public.portfolios
     set cash_balance = cash_balance + v_proceeds
   where id = v_portfolio.id;

  update public.transactions
     set exit_price = v_fill,
         exit_mid   = p_price,
         close_fee  = v_fee,
         status     = 'CLOSED',
         closed_at  = now()
   where id = v_txn.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.open_position(uuid, text, numeric, numeric) from public;
revoke all on function public.close_position(uuid, numeric) from public;
revoke all on function public.trading_costs(text) from public;

grant execute on function public.open_position(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.close_position(uuid, numeric) to authenticated;
grant execute on function public.trading_costs(text) to authenticated;
