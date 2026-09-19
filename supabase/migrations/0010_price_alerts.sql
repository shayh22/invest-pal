-- invest-pal: tell me when, without trading.
--
-- A stop order says "sell if it falls to 80". An alert says "tell me if it
-- falls to 80" and does nothing else. That gap matters: most of the time what
-- someone wants is to be told, and making them place an order to find out
-- means committing to a trade they have not decided on yet.
--
-- Deliberately much smaller than pending_orders. An alert has no side, no
-- quantity, no funds check and no failure mode — it fires once and is done.
-- Reusing the order machinery for it would have meant a row with three null
-- columns and a status that can never be REJECTED.
--
-- Fires on the same opportunistic settlement as orders: whenever a page has a
-- fresh price for an asset, whatever that price has reached is marked. An
-- alert therefore arrives when you look, not the moment the market crosses it,
-- which the UI says out loud rather than implying otherwise.
--
-- reset_portfolio() is deliberately not extended to clear these, for the same
-- reason it leaves the watchlist alone: an alert holds no money and no
-- position. Re-funding the account says nothing about which levels are still
-- worth knowing about.
--
-- Safe to re-run.

create table if not exists public.price_alerts (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  asset_id     uuid not null references public.assets (id) on delete cascade,
  direction    text not null check (direction in ('ABOVE', 'BELOW')),
  price        numeric(18, 8) not null check (price > 0),
  -- Set when it fires. Null means still watching.
  triggered_at timestamptz,
  -- The price that set it off, which is not the same as the level.
  triggered_price numeric(18, 8),
  -- Cleared once the reader has seen it, so the dashboard badge can empty.
  acknowledged boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint price_alerts_trigger_shape check (
    (triggered_at is null and triggered_price is null)
    or
    (triggered_at is not null and triggered_price is not null)
  )
);

create index if not exists price_alerts_portfolio_idx
  on public.price_alerts (portfolio_id, triggered_at);

comment on table public.price_alerts is
  'Watch a level and say so when it is reached. No trade, no funds, no side.';

alter table public.price_alerts enable row level security;

drop policy if exists "alerts are self-readable" on public.price_alerts;
create policy "alerts are self-readable"
  on public.price_alerts for select
  using (
    exists (
      select 1 from public.portfolios p
       where p.id = price_alerts.portfolio_id
         and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Setting one
-- ---------------------------------------------------------------------------

create or replace function public.create_price_alert(
  p_asset_id  uuid,
  p_direction text,
  p_price     numeric
)
returns public.price_alerts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_pf   uuid;
  v_open integer;
  v_row  public.price_alerts;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  if p_direction is null or p_direction not in ('ABOVE', 'BELOW') then
    raise exception 'An alert watches for ABOVE or BELOW.' using errcode = '22023';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'The level must be greater than zero.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.assets where id = p_asset_id) then
    raise exception 'Unknown asset.' using errcode = '23503';
  end if;

  select id into v_pf from public.portfolios where user_id = v_user;
  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  select count(*) into v_open
    from public.price_alerts
   where portfolio_id = v_pf
     and triggered_at is null;

  if v_open >= 50 then
    raise exception 'That is 50 alerts already set. Remove one first.'
      using errcode = '23514';
  end if;

  insert into public.price_alerts (portfolio_id, asset_id, direction, price)
  values (v_pf, p_asset_id, p_direction, p_price)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Removing one, and marking one seen
-- ---------------------------------------------------------------------------

create or replace function public.delete_price_alert(p_alert_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_hit  integer;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  with gone as (
    delete from public.price_alerts a
     using public.portfolios p
     where p.id = a.portfolio_id
       and p.user_id = v_user
       and a.id = p_alert_id
    returning a.id
  )
  select count(*) into v_hit from gone;

  if v_hit = 0 then
    raise exception 'Alert not found.' using errcode = '23503';
  end if;

  return true;
end;
$$;

/*
 * Mark every fired alert as seen.
 *
 * All of them at once rather than one at a time: the badge is a count of what
 * has not been read, and the gesture that clears it is opening the list.
 */
create or replace function public.acknowledge_price_alerts()
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

  with seen as (
    update public.price_alerts a
       set acknowledged = true
      from public.portfolios p
     where p.id = a.portfolio_id
       and p.user_id = v_user
       and a.triggered_at is not null
       and not a.acknowledged
    returning a.id
  )
  select count(*) into v_count from seen;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Firing
-- ---------------------------------------------------------------------------

/*
 * Mark every alert on one asset that this price has reached.
 *
 * Returns how many fired. Already-fired alerts are left alone — an alert is a
 * one-shot, not a recurring condition, so it does not re-fire every time the
 * price is still past the level.
 */
create or replace function public.settle_price_alerts(
  p_asset_id uuid,
  p_price    numeric
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_pf    uuid;
  v_count integer;
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

  with fired as (
    update public.price_alerts
       set triggered_at = now(),
           triggered_price = p_price
     where portfolio_id = v_pf
       and asset_id = p_asset_id
       and triggered_at is null
       and case direction
             when 'ABOVE' then p_price >= price
             else              p_price <= price
           end
    returning id
  )
  select count(*) into v_count from fired;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_price_alert(uuid, text, numeric) from public;
revoke all on function public.delete_price_alert(uuid) from public;
revoke all on function public.acknowledge_price_alerts() from public;
revoke all on function public.settle_price_alerts(uuid, numeric) from public;

grant execute on function public.create_price_alert(uuid, text, numeric) to authenticated;
grant execute on function public.delete_price_alert(uuid) to authenticated;
grant execute on function public.acknowledge_price_alerts() to authenticated;
grant execute on function public.settle_price_alerts(uuid, numeric) to authenticated;
grant select on public.price_alerts to authenticated;
