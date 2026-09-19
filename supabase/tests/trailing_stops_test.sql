-- Tests for trailing stops (migration 0011).
--
-- The property under test is the ratchet: the stop follows the price in one
-- direction and never comes back. Everything else here is in service of that.
--
-- Run with psql -v ON_ERROR_STOP=1: every check raises on failure, so a
-- non-zero exit means something regressed.

\set ON_ERROR_STOP on

create or replace function public.assert_eq(
  actual numeric, expected numeric, label text
) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok: % = %', label, expected;
end $$;

create or replace function public.assert_true(
  condition boolean, label text
) returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok: %', label;
end $$;

delete from public.price_alerts;
delete from public.watchlist;
delete from public.pending_orders;
delete from public.transactions;
delete from public.portfolios;
delete from public.profiles;
delete from auth.users;

insert into auth.users (email) values ('trailer@test'), ('onlooker@test');

select id::text as u from auth.users where email = 'trailer@test'
\gset
select id::text as other from auth.users where email = 'onlooker@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset
select id::text as msft from public.assets where ticker = 'MSFT'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== the arithmetic, on its own =='
-- --------------------------------------------------------------------------
-- Tested directly as well as through an order, because everything below
-- depends on these four cases and a failure here should say so plainly.
select public.assert_eq(
  public.trailing_stop_level('SELL', 100, 5, 'AMOUNT'), 95,
  'a sell trails five dollars below the high'
);
select public.assert_eq(
  public.trailing_stop_level('SELL', 100, 10, 'PERCENT'), 90,
  'or ten percent below it'
);
select public.assert_eq(
  public.trailing_stop_level('BUY', 100, 5, 'AMOUNT'), 105,
  'a buy trails five dollars above the low'
);
select public.assert_eq(
  public.trailing_stop_level('BUY', 100, 10, 'PERCENT'), 110,
  'or ten percent above it'
);

-- --------------------------------------------------------------------------
\echo '== a trailing sell is born a fixed distance behind the price =='
-- --------------------------------------------------------------------------
select public.trade(:'aapl'::uuid, 'BUY', 10, 100) \g /dev/null

select (public.place_pending_order(
  :'aapl'::uuid, 'SELL', 10, 'TRAILING', null, null, null, 5, 'AMOUNT', 100
)).id::text as trail_id
\gset

select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'trail_id'::uuid),
  95, 'the stop starts one distance below the price it was given'
);
select public.assert_eq(
  (select trail_peak from public.pending_orders where id = :'trail_id'::uuid),
  100, 'and the peak starts at that price'
);

-- --------------------------------------------------------------------------
\echo '== it follows the price up =='
-- --------------------------------------------------------------------------
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 120)), 0,
  'a price well above the stop fills nothing'
);
select public.assert_eq(
  (select trail_peak from public.pending_orders where id = :'trail_id'::uuid),
  120, 'the peak moves up to it'
);
select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'trail_id'::uuid),
  115, 'and the stop moves up with it, still one distance behind'
);

-- --------------------------------------------------------------------------
\echo '== and never back down =='
-- --------------------------------------------------------------------------
-- This is the whole feature. A fall that stays above the stop must leave the
-- stop exactly where the high put it.
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 116)), 0,
  'a fall that does not reach the stop fills nothing'
);
select public.assert_eq(
  (select trail_peak from public.pending_orders where id = :'trail_id'::uuid),
  120, 'the peak does not retreat'
);
select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'trail_id'::uuid),
  115, 'so neither does the stop'
);

-- --------------------------------------------------------------------------
\echo '== it fills at the level the high left behind, not the one it started at =='
-- --------------------------------------------------------------------------
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 115)), 1,
  'reaching the moved stop fills it'
);
select public.assert_true(
  (select status = 'FILLED' from public.pending_orders where id = :'trail_id'::uuid),
  'the order is marked filled'
);
-- Had the stop stayed where it was placed, this would have filled at 95 and
-- the account would be fifteen dollars a share worse off.
select public.assert_eq(
  (select exit_mid from public.transactions
    where id = (select transaction_id from public.pending_orders
                 where id = :'trail_id'::uuid)),
  115, 'and it filled at the moved level, twenty above where it was set'
);
select public.assert_eq(
  (select count(*) from public.transactions where status = 'OPEN'), 0,
  'the holding is closed'
);

-- --------------------------------------------------------------------------
\echo '== a jump straight past the stop cannot fire it =='
-- --------------------------------------------------------------------------
-- The ratchet runs before the test, in one pass. A price that sets a new peak
-- has by definition not reached the stop that peak implies.
select public.trade(:'aapl'::uuid, 'BUY', 5, 100) \g /dev/null
select (public.place_pending_order(
  :'aapl'::uuid, 'SELL', 5, 'TRAILING', null, null, null, 10, 'PERCENT', 100
)).id::text as pct_id
\gset
select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'pct_id'::uuid),
  90, 'a ten percent trail starts ten percent below'
);
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 1000)), 0,
  'a tenfold jump fills nothing'
);
select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'pct_id'::uuid),
  900, 'it just takes the stop with it'
);

-- A percentage keeps its distance proportional, which is the point of it.
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 899)), 1,
  'and one percent past the new stop fills'
);

-- --------------------------------------------------------------------------
\echo '== a trailing buy trails a low instead =='
-- --------------------------------------------------------------------------
select (public.place_pending_order(
  :'msft'::uuid, 'BUY', 1, 'TRAILING', null, null, null, 4, 'AMOUNT', 200
)).id::text as buy_id
\gset
select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'buy_id'::uuid),
  204, 'a buy stop sits above the price, not below'
);
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'msft'::uuid, 150)), 0,
  'a fall fills nothing'
);
select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'buy_id'::uuid),
  154, 'and drags the stop down after it'
);
-- Above the low but still under the stop: no fill, and no new low either, so
-- the stop has nothing to follow.
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'msft'::uuid, 152)), 0,
  'a bounce that falls short of the stop does nothing'
);
select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'buy_id'::uuid),
  154, 'and leaves it where the low put it'
);
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'msft'::uuid, 154)), 1,
  'reaching it buys'
);

-- --------------------------------------------------------------------------
\echo '== what a trailing stop refuses to be =='
-- --------------------------------------------------------------------------
do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'TRAILING', 90, null, null, 5, 'AMOUNT', 100);
  raise exception 'FAIL: a trailing stop accepted a level';
exception when invalid_parameter_value then
  raise notice 'ok: a trailing stop is given a distance, not a level';
end $$;

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'TRAILING', null, null, null, null, 'AMOUNT', 100);
  raise exception 'FAIL: a trailing stop was placed with no distance';
exception when invalid_parameter_value then
  raise notice 'ok: it needs a distance';
end $$;

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'TRAILING', null, null, null, 0, 'AMOUNT', 100);
  raise exception 'FAIL: a trailing distance of zero was accepted';
exception when invalid_parameter_value then
  raise notice 'ok: a distance of zero is not a distance';
end $$;

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'TRAILING', null, null, null, 100, 'PERCENT', 100);
  raise exception 'FAIL: a hundred percent trail was accepted';
exception when invalid_parameter_value then
  raise notice 'ok: a hundred percent behind leaves no stop to hit';
end $$;

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'TRAILING', null, null, null, 5, 'FURLONGS', 100);
  raise exception 'FAIL: an unknown unit was accepted';
exception when invalid_parameter_value then
  raise notice 'ok: it trails by an amount or a percent, nothing else';
end $$;

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'TRAILING', null, null, null, 5, 'AMOUNT', null);
  raise exception 'FAIL: a trailing stop was placed with nothing to trail from';
exception when invalid_parameter_value then
  raise notice 'ok: it needs the price it is starting from';
end $$;

-- A sell trailing further than the price itself would put the stop below
-- zero. Short selling is switched on only to get a sell past the holding
-- check, so that the distance is what refuses it.
select public.set_short_selling(true) \g /dev/null
do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'SELL', 1, 'TRAILING', null, null, null, 150, 'AMOUNT', 100);
  raise exception 'FAIL: a distance larger than the price was accepted';
exception when invalid_parameter_value then
  raise notice 'ok: a sell cannot trail further than the price itself';
end $$;
select public.set_short_selling(false) \g /dev/null

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'LIMIT', 90, null, null, 5, 'AMOUNT', 100);
  raise exception 'FAIL: a limit order was given a trailing distance';
exception when invalid_parameter_value then
  raise notice 'ok: only a trailing stop trails';
end $$;

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'TRAILING', null, now() + interval '1 hour', null, 5, 'AMOUNT', 100);
  raise exception 'FAIL: a trailing stop was given a time';
exception when invalid_parameter_value then
  raise notice 'ok: it triggers on price, not on time';
end $$;

-- --------------------------------------------------------------------------
\echo '== the shape is enforced by the table, not only by the function =='
-- --------------------------------------------------------------------------
reset role;
do $$
declare
  v_pf uuid := (select id from public.portfolios limit 1);
begin
  insert into public.pending_orders
    (portfolio_id, asset_id, side, quantity, trigger_type, trigger_price,
     trail_amount, trail_unit, trail_peak)
  values
    (v_pf, (select id from public.assets limit 1), 'SELL', 1, 'TRAILING', 90,
     5, 'AMOUNT', null);
  raise exception 'FAIL: a trailing order was stored with no peak';
exception when check_violation then
  raise notice 'ok: a trailing order without a peak is not a row';
end $$;

do $$
declare
  v_pf uuid := (select id from public.portfolios limit 1);
begin
  insert into public.pending_orders
    (portfolio_id, asset_id, side, quantity, trigger_type, trigger_price,
     trail_amount, trail_unit, trail_peak)
  values
    (v_pf, (select id from public.assets limit 1), 'SELL', 1, 'STOP', 90,
     5, 'AMOUNT', 100);
  raise exception 'FAIL: a plain stop was stored with trailing columns';
exception when check_violation then
  raise notice 'ok: a plain stop carries no trailing columns';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== everything an order already does, it still does =='
-- --------------------------------------------------------------------------
select (public.place_pending_order(
  :'msft'::uuid, 'BUY', 1, 'TRAILING', null, null, null, 2, 'PERCENT', 100
)).id::text as cancel_id
\gset
select public.assert_true(
  (select status = 'CANCELLED'
     from public.cancel_pending_order(:'cancel_id'::uuid)),
  'a trailing stop can be cancelled'
);

-- Expiry, on an order that would otherwise sit for ever. Backdated past its
-- own expiry, which place_pending_order would not accept — the point is what
-- the sweep does with an order that has run out of time.
select (public.place_pending_order(
  :'msft'::uuid, 'BUY', 1, 'TRAILING', null, null,
  now() + interval '1 hour', 2, 'PERCENT', 100
)).id::text as expiry_id
\gset
reset role;
update public.pending_orders
   set good_til = now() - interval '1 second'
 where id = :'expiry_id'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null
select public.assert_eq(public.expire_pending_orders(), 1,
  'and it expires like any other'
);

-- A rejection at fill time, recorded rather than thrown away.
select public.trade(:'aapl'::uuid, 'BUY', 1, 100) \g /dev/null
select (public.place_pending_order(
  :'aapl'::uuid, 'SELL', 1, 'TRAILING', null, null, null, 5, 'AMOUNT', 100
)).id::text as reject_id
\gset
-- Sold by hand before the stop got there, so there is nothing left to sell.
select public.trade(:'aapl'::uuid, 'SELL', 1, 100) \g /dev/null
select public.assert_eq(
  (select rejected from public.settle_pending_orders(:'aapl'::uuid, 90)), 1,
  'a trailing stop with nothing left to sell is rejected'
);
select public.assert_true(
  (select reject_reason is not null and status = 'REJECTED'
     from public.pending_orders where id = :'reject_id'::uuid),
  'and the reason is kept, which is what you want to read afterwards'
);

-- --------------------------------------------------------------------------
\echo '== one account cannot move another account stop =='
-- --------------------------------------------------------------------------
select public.trade(:'msft'::uuid, 'BUY', 1, 300) \g /dev/null
select (public.place_pending_order(
  :'msft'::uuid, 'SELL', 1, 'TRAILING', null, null, null, 10, 'AMOUNT', 300
)).id::text as mine_id
\gset

select set_config('request.jwt.claim.sub', :'other', false) \g /dev/null
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'msft'::uuid, 1)), 0,
  'a stranger price fills none of my orders'
);

select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null
select public.assert_eq(
  (select trigger_price from public.pending_orders where id = :'mine_id'::uuid),
  290, 'and did not move my stop either'
);
select public.assert_true(
  (select status = 'PENDING' from public.pending_orders where id = :'mine_id'::uuid),
  'my order is exactly where I left it'
);

reset role;
drop function public.assert_eq(numeric, numeric, text);
drop function public.assert_true(boolean, text);

\echo '== all trailing stop checks passed =='
