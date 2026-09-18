-- invest-pal: orders that wait for a price or a time.
--
-- Everything so far filled instantly at whatever the screen showed. Real
-- brokers are mostly *not* that: a market order is the exception, and the
-- orders that matter are the ones you leave sitting.
--
--   LIMIT   fill when the price gets better than the level you named.
--           A buy waits for price to fall to it; a sell waits for it to rise.
--   STOP    fill when the price gets worse than the level you named.
--           A sell waits for price to fall to it — this is a stop-loss, the
--           single most useful order a beginner never places.
--   TIME    fill at market, at or after a moment you choose.
--
-- Plus an optional expiry, so an order can be good for a day rather than for
-- ever, and a cancel.
--
-- A resting order is not a reservation. Cash is only checked and taken when it
-- actually fills, exactly as it is for an immediate trade, which means a
-- triggered order can still be refused for want of funds. That refusal is
-- recorded on the order rather than thrown away, because "why didn't my order
-- fill" is the question this table exists to answer.
--
-- On trust: settle_pending_orders() is handed the price to fill at, the same
-- way trade() already is. The client is what calls it, after fetching that
-- price from the market proxy. This is not a defensible design against a
-- hostile client — it could name any price — but it is exactly the trust model
-- the immediate path has always had, and the money here is imaginary. Moving
-- it server-side means giving a Vercel function the service role key; the
-- endpoint would be small, and the note is here so the choice is visible
-- rather than assumed.
--
-- Safe to re-run.

create table if not exists public.pending_orders (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios (id) on delete cascade,
  asset_id      uuid not null references public.assets (id) on delete restrict,
  side          text not null check (side in ('BUY', 'SELL')),
  quantity      numeric(18, 8) not null check (quantity > 0),
  trigger_type  text not null check (trigger_type in ('LIMIT', 'STOP', 'TIME')),
  -- The level for LIMIT and STOP; null for TIME.
  trigger_price numeric(18, 8) check (trigger_price > 0),
  -- The moment for TIME; null for LIMIT and STOP.
  trigger_at    timestamptz,
  -- Optional. Past this, the order expires unfilled.
  good_til      timestamptz,
  status        text not null default 'PENDING'
                  check (status in ('PENDING', 'FILLED', 'CANCELLED', 'EXPIRED', 'REJECTED')),
  -- Why a triggered order did not become a trade. Kept, not discarded.
  reject_reason text,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,

  constraint pending_orders_trigger_shape check (
    (trigger_type in ('LIMIT', 'STOP') and trigger_price is not null and trigger_at is null)
    or
    (trigger_type = 'TIME' and trigger_at is not null and trigger_price is null)
  ),
  constraint pending_orders_resolution check (
    (status = 'PENDING' and resolved_at is null)
    or
    (status <> 'PENDING' and resolved_at is not null)
  )
);

create index if not exists pending_orders_portfolio_status_idx
  on public.pending_orders (portfolio_id, status);

comment on table public.pending_orders is
  'Orders resting until a price or a time reaches them. Cash is checked when '
  'they fill, not when they are placed.';

-- ---------------------------------------------------------------------------
-- Row level security: your own orders, and only through the functions
-- ---------------------------------------------------------------------------

alter table public.pending_orders enable row level security;

drop policy if exists "pending orders are self-readable" on public.pending_orders;
create policy "pending orders are self-readable"
  on public.pending_orders for select
  using (
    exists (
      select 1 from public.portfolios p
       where p.id = pending_orders.portfolio_id
         and p.user_id = auth.uid()
    )
  );

-- No insert, update or delete policy on purpose. Placing and cancelling go
-- through the functions below, so an order can never be written with a shape
-- or a quantity the engine would refuse.

-- ---------------------------------------------------------------------------
-- Placing one
-- ---------------------------------------------------------------------------

create or replace function public.place_pending_order(
  p_asset_id      uuid,
  p_side          text,
  p_quantity      numeric,
  p_trigger_type  text,
  p_trigger_price numeric default null,
  p_trigger_at    timestamptz default null,
  p_good_til      timestamptz default null
)
returns public.pending_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_portfolio public.portfolios;
  v_open      integer;
  v_row       public.pending_orders;
begin
  if v_user is null then
    raise exception 'You must be signed in to place an order.' using errcode = '28000';
  end if;

  if p_side is null or p_side not in ('BUY', 'SELL') then
    raise exception 'Side must be BUY or SELL.' using errcode = '22023';
  end if;

  if p_trigger_type is null or p_trigger_type not in ('LIMIT', 'STOP', 'TIME') then
    raise exception 'Order type must be LIMIT, STOP or TIME.' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = '22023';
  end if;

  if p_trigger_type in ('LIMIT', 'STOP') then
    if p_trigger_price is null or p_trigger_price <= 0 then
      raise exception 'A % order needs a price to wait for.', p_trigger_type
        using errcode = '22023';
    end if;
    if p_trigger_at is not null then
      raise exception 'A % order triggers on price, not on time.', p_trigger_type
        using errcode = '22023';
    end if;
  else
    if p_trigger_at is null then
      raise exception 'A scheduled order needs a time to wait for.'
        using errcode = '22023';
    end if;
    if p_trigger_price is not null then
      raise exception 'A scheduled order triggers on time, not on price.'
        using errcode = '22023';
    end if;
  end if;

  -- An expiry before the trigger would never fill, which is a mistake rather
  -- than an intention.
  if p_good_til is not null then
    if p_good_til <= now() then
      raise exception 'That expiry is already in the past.' using errcode = '22023';
    end if;
    if p_trigger_at is not null and p_good_til <= p_trigger_at then
      raise exception 'The order would expire before it is due to run.'
        using errcode = '22023';
    end if;
  end if;

  if not exists (select 1 from public.assets where id = p_asset_id) then
    raise exception 'Unknown asset.' using errcode = '23503';
  end if;

  select * into v_portfolio
    from public.portfolios
   where user_id = v_user;

  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  -- Selling short is a decision made once, on the account, and a resting sell
  -- on an asset you do not hold is a short waiting to happen. Checking here as
  -- well as at fill time means the refusal arrives while you are still looking
  -- at the form.
  if p_side = 'SELL' and not v_portfolio.short_selling_enabled then
    if not exists (
      select 1 from public.transactions
       where portfolio_id = v_portfolio.id
         and asset_id = p_asset_id
         and status = 'OPEN'
         and direction = 'LONG'
    ) then
      raise exception
        'You do not hold this asset, so there is nothing to sell. Selling what '
        'you do not own is short selling, and this account does not have it '
        'switched on.'
        using errcode = '23514';
    end if;
  end if;

  select count(*) into v_open
    from public.pending_orders
   where portfolio_id = v_portfolio.id
     and status = 'PENDING';

  if v_open >= 50 then
    raise exception 'That is 50 orders already waiting. Cancel one first.'
      using errcode = '23514';
  end if;

  insert into public.pending_orders
    (portfolio_id, asset_id, side, quantity, trigger_type, trigger_price,
     trigger_at, good_til)
  values
    (v_portfolio.id, p_asset_id, p_side, p_quantity, p_trigger_type,
     p_trigger_price, p_trigger_at, p_good_til)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelling one
-- ---------------------------------------------------------------------------

create or replace function public.cancel_pending_order(p_order_id uuid)
returns public.pending_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.pending_orders;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  -- Locked before its status is read, so two cancels racing cannot both think
  -- they were the one that did it.
  select o.* into v_row
    from public.pending_orders o
    join public.portfolios p on p.id = o.portfolio_id
   where o.id = p_order_id
     and p.user_id = v_user
     for update of o;

  if not found then
    raise exception 'Order not found.' using errcode = '23503';
  end if;

  if v_row.status <> 'PENDING' then
    raise exception 'That order is no longer waiting.' using errcode = '23514';
  end if;

  update public.pending_orders
     set status = 'CANCELLED', resolved_at = now()
   where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settling whatever is due
-- ---------------------------------------------------------------------------

/*
 * Has the market reached this order?
 *
 *   LIMIT buy   price fell to the level or below   (a better price than asked)
 *   LIMIT sell  price rose to the level or above
 *   STOP  buy   price rose to the level or above   (a worse price than now)
 *   STOP  sell  price fell to the level or below   — the stop-loss
 *   TIME        the moment has arrived
 */
create or replace function public.order_is_triggered(
  p_order public.pending_orders,
  p_price numeric
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_order.trigger_type
           when 'TIME' then now() >= p_order.trigger_at
           when 'LIMIT' then
             case p_order.side
               when 'BUY'  then p_price <= p_order.trigger_price
               else             p_price >= p_order.trigger_price
             end
           when 'STOP' then
             case p_order.side
               when 'BUY'  then p_price >= p_order.trigger_price
               else             p_price <= p_order.trigger_price
             end
         end
$$;

/*
 * Resolve every order on one asset against a price.
 *
 * Expiry is checked first, so an order whose moment has passed expires rather
 * than filling late. A triggered order is then handed to trade(), which applies
 * every rule an immediate order obeys — the funds check, the holding check, the
 * refusal to cross through zero. If trade() refuses, the order is marked
 * REJECTED with the reason it gave, which is the thing a trader actually wants
 * to read afterwards.
 *
 * Returns how many orders it filled, rejected and expired.
 */
create or replace function public.settle_pending_orders(
  p_asset_id uuid,
  p_price    numeric
)
returns table (filled integer, rejected integer, expired integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_pf       uuid;
  v_order    public.pending_orders;
  v_txn      public.transactions;
  v_filled   integer := 0;
  v_rejected integer := 0;
  v_expired  integer := 0;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'Price must be greater than zero.' using errcode = '22023';
  end if;

  select id into v_pf from public.portfolios where user_id = v_user;
  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  for v_order in
    select *
      from public.pending_orders
     where portfolio_id = v_pf
       and asset_id = p_asset_id
       and status = 'PENDING'
     order by created_at
     for update
  loop
    if v_order.good_til is not null and now() > v_order.good_til then
      update public.pending_orders
         set status = 'EXPIRED', resolved_at = now()
       where id = v_order.id;
      v_expired := v_expired + 1;
      continue;
    end if;

    if not public.order_is_triggered(v_order, p_price) then
      continue;
    end if;

    begin
      v_txn := public.trade(v_order.asset_id, v_order.side, v_order.quantity, p_price);
      update public.pending_orders
         set status = 'FILLED',
             transaction_id = v_txn.id,
             resolved_at = now()
       where id = v_order.id;
      v_filled := v_filled + 1;
    exception when others then
      -- Not enough cash, nothing left to sell, an order that would flip the
      -- holding through zero: all reasons a real order gets rejected at the
      -- moment it tries to fill rather than when it was placed.
      update public.pending_orders
         set status = 'REJECTED',
             reject_reason = left(sqlerrm, 300),
             resolved_at = now()
       where id = v_order.id;
      v_rejected := v_rejected + 1;
    end;
  end loop;

  return query select v_filled, v_rejected, v_expired;
end;
$$;

/*
 * Expire whatever has run out of time, without needing a price.
 *
 * A price-triggered order on an asset nobody is looking at would otherwise sit
 * as PENDING for ever, because settlement only runs for the asset on screen.
 */
create or replace function public.expire_pending_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  with expired as (
    update public.pending_orders o
       set status = 'EXPIRED', resolved_at = now()
      from public.portfolios p
     where p.id = o.portfolio_id
       and p.user_id = v_user
       and o.status = 'PENDING'
       and o.good_til is not null
       and now() > o.good_til
    returning o.id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Starting over clears the order book too
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

  -- Resting orders go with everything else: leaving them to fire against a
  -- fresh balance would be the opposite of starting over.
  delete from public.pending_orders where portfolio_id = v_portfolio.id;
  delete from public.transactions where portfolio_id = v_portfolio.id;

  update public.portfolios
     set cash_balance     = v_balance,
         starting_balance = v_balance
   where id = v_portfolio.id
  returning * into v_portfolio;

  return v_portfolio;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.place_pending_order(uuid, text, numeric, text, numeric, timestamptz, timestamptz) from public;
revoke all on function public.cancel_pending_order(uuid) from public;
revoke all on function public.settle_pending_orders(uuid, numeric) from public;
revoke all on function public.expire_pending_orders() from public;
revoke all on function public.order_is_triggered(public.pending_orders, numeric) from public;

grant execute on function public.place_pending_order(uuid, text, numeric, text, numeric, timestamptz, timestamptz) to authenticated;
grant execute on function public.cancel_pending_order(uuid) to authenticated;
grant execute on function public.settle_pending_orders(uuid, numeric) to authenticated;
grant execute on function public.expire_pending_orders() to authenticated;
grant execute on function public.order_is_triggered(public.pending_orders, numeric) to authenticated;
grant select on public.pending_orders to authenticated;
