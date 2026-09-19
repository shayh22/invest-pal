-- invest-pal: a stop that follows the price up and never comes back down.
--
-- A stop-loss is set once and then it is wrong. Buy at 100, set the stop at
-- 90, and if the price runs to 150 the stop is still sitting at 90 — fifty
-- points of profit with no protection under it. Moving it by hand means
-- remembering to, which is the thing nobody does.
--
-- A trailing stop is the fix every broker offers: name a distance rather than
-- a level, and the stop rides along behind the best price seen so far. It
-- ratchets — it moves in your favour and never against you — which is the
-- whole point and the one property a test must pin down.
--
--   SELL trailing   stop sits BELOW the highest price since it was placed.
--                   Protects a long. The common case.
--   BUY  trailing   stop sits ABOVE the lowest price since it was placed.
--                   Covers a short, or times an entry on a falling market.
--
-- The distance is either an amount ("five dollars behind") or a percentage
-- ("three percent behind"). Both are offered because both are how people
-- actually think, and which one is natural depends entirely on the price of
-- the thing: three percent of Bitcoin is a different conversation from three
-- percent of a four dollar stock.
--
-- Implemented as a fourth trigger_type on pending_orders rather than a table
-- of its own. Unlike an alert, a trailing stop really is an order — a side, a
-- quantity, a funds check at fill time, a rejection that needs recording — so
-- it belongs with the orders, and everything from cancellation to expiry to
-- the order list works on it unchanged.
--
-- On when the stop moves: the ratchet advances inside settle_pending_orders(),
-- on the same opportunistic prices that fire everything else. So the peak is
-- the best price this account has *seen*, not the best price that happened. A
-- spike nobody was looking at does not raise the stop. That is the same trust
-- and timing model the resting orders already have, and the UI says it rather
-- than implying a server that watches the tape.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- The columns
-- ---------------------------------------------------------------------------

alter table public.pending_orders
  add column if not exists trail_amount numeric(18, 8),
  -- 'AMOUNT' is a distance in dollars; 'PERCENT' a distance in percent.
  add column if not exists trail_unit   text,
  -- The best price seen since the order was placed: the high for a SELL, the
  -- low for a BUY. Seeded with the price at placement, so an order is never
  -- born with a stop further away than its own distance.
  add column if not exists trail_peak   numeric(18, 8);

comment on column public.pending_orders.trail_peak is
  'Best price seen since placement — the high for a SELL, the low for a BUY. '
  'The stop is derived from this, so it ratchets and never retreats.';

comment on column public.pending_orders.trigger_price is
  'The level for LIMIT and STOP. For TRAILING it is the current stop, '
  'recomputed whenever the peak advances, so one column answers "where is my '
  'stop right now" for every order that has one.';

-- Four types now. Dropped and re-added rather than edited in place, because a
-- check constraint has no ALTER.
alter table public.pending_orders drop constraint if exists pending_orders_trigger_type_check;
alter table public.pending_orders
  add constraint pending_orders_trigger_type_check
  check (trigger_type in ('LIMIT', 'STOP', 'TIME', 'TRAILING'));

alter table public.pending_orders drop constraint if exists pending_orders_trigger_shape;
alter table public.pending_orders
  add constraint pending_orders_trigger_shape check (
    (trigger_type in ('LIMIT', 'STOP')
      and trigger_price is not null and trigger_at is null
      and trail_amount is null and trail_unit is null and trail_peak is null)
    or
    (trigger_type = 'TIME'
      and trigger_at is not null and trigger_price is null
      and trail_amount is null and trail_unit is null and trail_peak is null)
    or
    -- A trailing stop carries both: the distance it keeps, and the level that
    -- distance currently works out to.
    (trigger_type = 'TRAILING'
      and trigger_at is null
      and trigger_price is not null and trigger_price > 0
      and trail_amount is not null and trail_amount > 0
      and trail_unit in ('AMOUNT', 'PERCENT')
      and trail_peak is not null and trail_peak > 0)
  );

-- ---------------------------------------------------------------------------
-- Where the stop sits
-- ---------------------------------------------------------------------------

/*
 * The stop a given peak implies.
 *
 * One function so that placement and settlement can never disagree about where
 * the stop is — the bug that would make a trailing stop fire at the wrong
 * level is two copies of this arithmetic drifting apart.
 *
 * Returns null if the distance would put the stop at or below zero, which the
 * caller treats as a refusal rather than clamping: a stop at zero is not a
 * stop, and silently moving someone's level is worse than telling them.
 */
create or replace function public.trailing_stop_level(
  p_side   text,
  p_peak   numeric,
  p_amount numeric,
  p_unit   text
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
           when p_side = 'SELL' and p_unit = 'AMOUNT'  then p_peak - p_amount
           when p_side = 'SELL' and p_unit = 'PERCENT' then p_peak * (1 - p_amount / 100.0)
           when p_side = 'BUY'  and p_unit = 'AMOUNT'  then p_peak + p_amount
           when p_side = 'BUY'  and p_unit = 'PERCENT' then p_peak * (1 + p_amount / 100.0)
         end
$$;

comment on function public.trailing_stop_level(text, numeric, numeric, text) is
  'The stop implied by a peak and a distance. The single source of that '
  'arithmetic, so placement and settlement cannot disagree.';

-- ---------------------------------------------------------------------------
-- Placing one
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced: the new parameters have defaults, and an
-- overload would make every existing seven-argument call ambiguous.
drop function if exists public.place_pending_order(uuid, text, numeric, text, numeric, timestamptz, timestamptz);

create or replace function public.place_pending_order(
  p_asset_id      uuid,
  p_side          text,
  p_quantity      numeric,
  p_trigger_type  text,
  p_trigger_price numeric default null,
  p_trigger_at    timestamptz default null,
  p_good_til      timestamptz default null,
  -- TRAILING only: how far behind the peak to sit, and in what units.
  p_trail_amount  numeric default null,
  p_trail_unit    text default null,
  -- TRAILING only: the price to start trailing from, which the client has on
  -- screen. Same hand-me-the-price trust model as trade() and settlement.
  p_reference_price numeric default null
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
  v_stop      numeric;
  v_row       public.pending_orders;
begin
  if v_user is null then
    raise exception 'You must be signed in to place an order.' using errcode = '28000';
  end if;

  if p_side is null or p_side not in ('BUY', 'SELL') then
    raise exception 'Side must be BUY or SELL.' using errcode = '22023';
  end if;

  if p_trigger_type is null
     or p_trigger_type not in ('LIMIT', 'STOP', 'TIME', 'TRAILING') then
    raise exception 'Order type must be LIMIT, STOP, TIME or TRAILING.'
      using errcode = '22023';
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
  elsif p_trigger_type = 'TIME' then
    if p_trigger_at is null then
      raise exception 'A scheduled order needs a time to wait for.'
        using errcode = '22023';
    end if;
    if p_trigger_price is not null then
      raise exception 'A scheduled order triggers on time, not on price.'
        using errcode = '22023';
    end if;
  else
    if p_trigger_at is not null then
      raise exception 'A trailing stop triggers on price, not on time.'
        using errcode = '22023';
    end if;
    if p_trigger_price is not null then
      raise exception
        'A trailing stop is given a distance, not a level — the level is '
        'worked out from the price and then follows it.'
        using errcode = '22023';
    end if;
    if p_trail_unit is null or p_trail_unit not in ('AMOUNT', 'PERCENT') then
      raise exception 'A trailing stop trails by an AMOUNT or a PERCENT.'
        using errcode = '22023';
    end if;
    if p_trail_amount is null or p_trail_amount <= 0 then
      raise exception 'The trailing distance must be greater than zero.'
        using errcode = '22023';
    end if;
    -- A hundred percent behind the peak is a stop at zero, and more than that
    -- is a stop below it. Neither is an order.
    if p_trail_unit = 'PERCENT' and p_trail_amount >= 100 then
      raise exception 'A trailing distance of 100%% or more leaves no stop to hit.'
        using errcode = '22023';
    end if;
    if p_reference_price is null or p_reference_price <= 0 then
      raise exception 'A trailing stop needs the current price to start from.'
        using errcode = '22023';
    end if;

    v_stop := public.trailing_stop_level(
      p_side, p_reference_price, p_trail_amount, p_trail_unit);

    if v_stop is null or v_stop <= 0 then
      raise exception
        'That distance puts the stop at or below zero. Trail by less than the '
        'price itself.'
        using errcode = '22023';
    end if;
  end if;

  if p_trigger_type <> 'TRAILING'
     and (p_trail_amount is not null or p_trail_unit is not null) then
    raise exception 'Only a trailing stop trails.' using errcode = '22023';
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
     trigger_at, good_til, trail_amount, trail_unit, trail_peak)
  values
    (v_portfolio.id, p_asset_id, p_side, p_quantity, p_trigger_type,
     case when p_trigger_type = 'TRAILING' then v_stop else p_trigger_price end,
     p_trigger_at, p_good_til, p_trail_amount, p_trail_unit,
     case when p_trigger_type = 'TRAILING' then p_reference_price end)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Firing one
-- ---------------------------------------------------------------------------

/*
 * Has the market reached this order?
 *
 *   LIMIT buy      price fell to the level or below   (a better price than asked)
 *   LIMIT sell     price rose to the level or above
 *   STOP  buy      price rose to the level or above   (a worse price than now)
 *   STOP  sell     price fell to the level or below   — the stop-loss
 *   TRAILING       the same test as STOP, against a level that has been moving
 *   TIME           the moment has arrived
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
           else
             case p_order.side
               when 'BUY'  then p_price >= p_order.trigger_price
               else             p_price <= p_order.trigger_price
             end
         end
$$;

/*
 * Resolve every order on one asset against a price.
 *
 * Trailing stops ratchet first, before anything is tested: a price that sets a
 * new peak moves the stop and then cannot possibly have hit it, and a price
 * that does not is left to the ordinary stop test against the level the peak
 * left behind. Doing it in that order, in one pass, is what makes "the stop
 * never moves against you" true rather than nearly true.
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
  v_stop     numeric;
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

    -- The ratchet. A SELL trails a high, a BUY trails a low, and the stop only
    -- ever follows in that one direction.
    if v_order.trigger_type = 'TRAILING'
       and ((v_order.side = 'SELL' and p_price > v_order.trail_peak)
            or (v_order.side = 'BUY' and p_price < v_order.trail_peak)) then
      v_stop := public.trailing_stop_level(
        v_order.side, p_price, v_order.trail_amount, v_order.trail_unit);

      -- Guarded rather than assumed. Placement proved the first level was
      -- positive and the peak only ever moves in the favourable direction, so
      -- this should hold for every later one too — but a stop of zero would
      -- fire on nothing, and that argument is not worth betting an order on.
      if v_stop is not null and v_stop > 0 then
        update public.pending_orders
           set trail_peak = p_price, trigger_price = v_stop
         where id = v_order.id;
        v_order.trail_peak := p_price;
        v_order.trigger_price := v_stop;
      end if;
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.trailing_stop_level(text, numeric, numeric, text) from public;
revoke all on function public.place_pending_order(
  uuid, text, numeric, text, numeric, timestamptz, timestamptz, numeric, text, numeric
) from public;

grant execute on function public.trailing_stop_level(text, numeric, numeric, text) to authenticated;
grant execute on function public.place_pending_order(
  uuid, text, numeric, text, numeric, timestamptz, timestamptz, numeric, text, numeric
) to authenticated;
