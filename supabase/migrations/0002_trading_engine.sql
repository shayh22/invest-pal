-- invest-pal: the paper trading engine.
--
-- Opening and closing a position each move money and write a row. Those two
-- effects must land together or not at all, so they live in SECURITY DEFINER
-- functions rather than in the client. The client's direct write paths are
-- removed with them: a browser that can INSERT into transactions can open a
-- position without paying for it, and a browser that can UPDATE portfolios can
-- simply set its own balance.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Close the client write paths from 0001
-- ---------------------------------------------------------------------------

-- Balance changes now come only from open_position / close_position.
drop policy if exists "portfolios are self-writable" on public.portfolios;

-- Trades are created and settled by the functions below. SELECT stays, so the
-- client can still read its own history.
drop policy if exists "transactions are self-insertable" on public.transactions;
drop policy if exists "transactions are self-updatable" on public.transactions;

-- ---------------------------------------------------------------------------
-- A short position can lose more than it reserved
-- ---------------------------------------------------------------------------
--
-- 0001 required cash_balance >= 0. That is wrong for shorts: if price more than
-- doubles, closing costs more than the collateral taken at open, and the
-- constraint would block the close and strand the position — the worst possible
-- outcome. Opening is still gated on available cash (see open_position), so a
-- negative balance can only be the result of a trade that ran against the user,
-- which is exactly the lesson shorting is meant to teach.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
    from pg_constraint
   where conrelid = 'public.portfolios'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%cash_balance%';

  if constraint_name is not null then
    execute format(
      'alter table public.portfolios drop constraint %I', constraint_name
    );
  end if;
end $$;

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
  v_user      uuid := auth.uid();
  v_portfolio public.portfolios;
  v_cost      numeric(18, 2);
  v_row       public.transactions;
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

  if not exists (select 1 from public.assets where id = p_asset_id) then
    raise exception 'Unknown asset.' using errcode = '23503';
  end if;

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

  -- Both directions reserve the notional. For a long that is the purchase; for
  -- a short it is collateral, returned at close along with the result.
  v_cost := round(p_quantity * p_price, 2);

  if v_cost > v_portfolio.cash_balance then
    raise exception
      'Not enough virtual cash: this costs %, and the balance is %.',
      v_cost, v_portfolio.cash_balance
      using errcode = '23514';
  end if;

  update public.portfolios
     set cash_balance = cash_balance - v_cost
   where id = v_portfolio.id;

  insert into public.transactions
    (portfolio_id, asset_id, direction, quantity, entry_price)
  values
    (v_portfolio.id, p_asset_id, p_direction, p_quantity, p_price)
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
  v_user      uuid := auth.uid();
  v_txn       public.transactions;
  v_portfolio public.portfolios;
  v_pnl       numeric;
  v_proceeds  numeric(18, 2);
  v_row       public.transactions;
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

  v_pnl := case v_txn.direction
             when 'LONG'  then v_txn.quantity * (p_price - v_txn.entry_price)
             when 'SHORT' then v_txn.quantity * (v_txn.entry_price - p_price)
           end;

  -- Closing hands back what opening reserved, plus or minus the result. For a
  -- long that reduces to quantity * exit_price; for a short it is the
  -- collateral plus the fall in price.
  v_proceeds := round(v_txn.quantity * v_txn.entry_price + v_pnl, 2);

  update public.portfolios
     set cash_balance = cash_balance + v_proceeds
   where id = v_portfolio.id;

  update public.transactions
     set exit_price = p_price,
         status     = 'CLOSED',
         closed_at  = now()
   where id = v_txn.id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only signed-in users may trade, and only through these functions
-- ---------------------------------------------------------------------------

revoke all on function public.open_position(uuid, text, numeric, numeric) from public;
revoke all on function public.close_position(uuid, numeric) from public;

grant execute on function public.open_position(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.close_position(uuid, numeric) to authenticated;
