-- Tests for resting orders (migration 0008).
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

delete from public.pending_orders;
delete from public.transactions;
delete from public.portfolios;
delete from public.profiles;
delete from auth.users;

insert into auth.users (email) values ('resting@test'), ('nosy@test');

select id::text as u from auth.users where email = 'resting@test'
\gset
select id::text as other from auth.users where email = 'nosy@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset
select id::text as msft from public.assets where ticker = 'MSFT'
\gset
select id::text as nvda from public.assets where ticker = 'NVDA'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== a limit buy waits for the price to come down =='
-- --------------------------------------------------------------------------
select (public.place_pending_order(:'aapl'::uuid, 'BUY', 2, 'LIMIT', 90)).id::text as buy_id
\gset
select public.assert_true(
  (select status = 'PENDING' from public.pending_orders where id = :'buy_id'::uuid),
  'the order rests'
);

-- Above the limit: nothing happens. A limit buy is a promise not to pay more.
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 100)), 0,
  'a price above the limit does not fill a buy'
);
select public.assert_eq(
  (select count(*) from public.transactions), 0, 'and no trade was made'
);

-- At the limit it fills, at the price the market actually reached.
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 89)), 1,
  'the price reaching the limit fills it'
);
select public.assert_true(
  (select status = 'FILLED' from public.pending_orders where id = :'buy_id'::uuid),
  'the order is marked filled'
);
select public.assert_eq(
  (select entry_mid from public.transactions t
     join public.pending_orders o on o.transaction_id = t.id
    where o.id = :'buy_id'::uuid),
  89, 'and filled at the price the market reached, not at the limit'
);
select public.assert_eq(
  (select quantity from public.transactions where status = 'OPEN'), 2,
  'the holding is the size that was ordered'
);

-- --------------------------------------------------------------------------
\echo '== a stop sell is the one that protects you =='
-- --------------------------------------------------------------------------
-- Holding 2 AAPL bought near 89. A stop at 80 sells if it falls that far.
select (public.place_pending_order(:'aapl'::uuid, 'SELL', 2, 'STOP', 80)).id::text as stop_id
\gset
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 85)), 0,
  'a price above the stop leaves it alone'
);
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 79)), 1,
  'falling through the stop sells'
);
select public.assert_eq(
  (select count(*) from public.transactions where status = 'OPEN'), 0,
  'the position is closed'
);

-- The two price orders are mirror images, and getting either backwards would
-- be silent. Stated directly rather than inferred from the fills above.
select public.assert_true(
  public.order_is_triggered(
    row(null, null, null, 'BUY', 1, 'LIMIT', 100, null, null, 'PENDING', null, null, now(), null)::public.pending_orders,
    99),
  'a limit buy triggers below its level'
);
select public.assert_true(
  not public.order_is_triggered(
    row(null, null, null, 'BUY', 1, 'LIMIT', 100, null, null, 'PENDING', null, null, now(), null)::public.pending_orders,
    101),
  'and not above it'
);
select public.assert_true(
  public.order_is_triggered(
    row(null, null, null, 'BUY', 1, 'STOP', 100, null, null, 'PENDING', null, null, now(), null)::public.pending_orders,
    101),
  'a stop buy triggers above its level'
);
select public.assert_true(
  public.order_is_triggered(
    row(null, null, null, 'SELL', 1, 'LIMIT', 100, null, null, 'PENDING', null, null, now(), null)::public.pending_orders,
    101),
  'a limit sell triggers above its level'
);
select public.assert_true(
  public.order_is_triggered(
    row(null, null, null, 'SELL', 1, 'STOP', 100, null, null, 'PENDING', null, null, now(), null)::public.pending_orders,
    99),
  'a stop sell triggers below its level'
);

-- --------------------------------------------------------------------------
\echo '== a scheduled order waits for the clock =='
-- --------------------------------------------------------------------------
select (public.place_pending_order(
          :'msft'::uuid, 'BUY', 1, 'TIME', null, now() + interval '1 hour')).id::text as later_id
\gset
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'msft'::uuid, 400)), 0,
  'an order due later does not fill now'
);

select (public.place_pending_order(
          :'msft'::uuid, 'BUY', 1, 'TIME', null, now() - interval '1 minute')).id::text as due_id
\gset
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'msft'::uuid, 400)), 1,
  'one whose moment has passed fills at market'
);
select public.assert_true(
  (select status = 'PENDING' from public.pending_orders where id = :'later_id'::uuid),
  'and the one still due keeps waiting'
);
select public.assert_true(
  (select status = 'FILLED' from public.pending_orders where id = :'due_id'::uuid),
  'while the due one is filled'
);

-- --------------------------------------------------------------------------
\echo '== an order can be given a deadline =='
-- --------------------------------------------------------------------------
reset role;
-- Backdated past its own expiry, which place_pending_order would not accept —
-- the point is what settlement does with an order that has run out of time.
update public.pending_orders
   set good_til = now() - interval '1 second'
 where id = :'later_id'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select public.assert_eq(
  (select expired from public.settle_pending_orders(:'msft'::uuid, 400)), 1,
  'an order past its deadline expires'
);
select public.assert_true(
  (select status = 'EXPIRED' from public.pending_orders where id = :'later_id'::uuid),
  'and is marked expired, not filled'
);

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'LIMIT', 50, null, now() - interval '1 day');
  raise exception 'FAIL: accepted an expiry in the past';
exception when invalid_parameter_value then
  raise notice 'ok: an expiry already past is refused';
end $$;

do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'AAPL'),
    'BUY', 1, 'TIME', null, now() + interval '2 hours', now() + interval '1 hour');
  raise exception 'FAIL: accepted an order that expires before it runs';
exception when invalid_parameter_value then
  raise notice 'ok: an order that would expire before it runs is refused';
end $$;

-- Expiry also has to work for an asset nobody is watching, or a price order on
-- a forgotten ticker rests for ever.
select (public.place_pending_order(
          :'nvda'::uuid, 'BUY', 1, 'LIMIT', 1, null, now() + interval '1 hour')).id::text as forgotten
\gset
reset role;
update public.pending_orders
   set good_til = now() - interval '1 second'
 where id = :'forgotten'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select public.assert_eq(public.expire_pending_orders(), 1,
  'expiry sweeps assets nobody is looking at'
);

-- --------------------------------------------------------------------------
\echo '== a rejected fill says why =='
-- --------------------------------------------------------------------------
-- Cash is not reserved when the order is placed, so an order can be affordable
-- on Monday and not on Tuesday. That is a real broker's behaviour, and the
-- reason belongs on the order.
select (public.place_pending_order(:'aapl'::uuid, 'BUY', 1e9, 'LIMIT', 1000)).id::text as broke_id
\gset
select public.assert_eq(
  (select rejected from public.settle_pending_orders(:'aapl'::uuid, 900)), 1,
  'a fill it cannot afford is rejected'
);
select public.assert_true(
  (select status = 'REJECTED' from public.pending_orders where id = :'broke_id'::uuid),
  'the order is marked rejected'
);
select public.assert_true(
  (select reject_reason like '%Not enough virtual cash%'
     from public.pending_orders where id = :'broke_id'::uuid),
  'and carries the reason it was refused'
);
select public.assert_true(
  (select transaction_id is null from public.pending_orders where id = :'broke_id'::uuid),
  'with no trade attached to it'
);

-- --------------------------------------------------------------------------
\echo '== you cannot rest a sell on something you do not hold =='
-- --------------------------------------------------------------------------
select public.assert_true(
  (select not short_selling_enabled from public.portfolios), 'shorting is off'
);
do $$
begin
  perform public.place_pending_order(
    (select id from public.assets where ticker = 'NVDA'), 'SELL', 1, 'LIMIT', 500);
  raise exception 'FAIL: rested a sell on an asset the account does not hold';
exception when check_violation then
  raise notice 'ok: a resting sell with nothing to sell is refused up front';
end $$;

-- With shorting on it is allowed, because now it is a short the account asked
-- for rather than one it stumbled into.
select public.set_short_selling(true) is not null \g /dev/null
select (public.place_pending_order(:'nvda'::uuid, 'SELL', 1, 'LIMIT', 500)).id::text as short_id
\gset
select public.assert_true(
  (select status = 'PENDING' from public.pending_orders where id = :'short_id'::uuid),
  'with shorting on, the same order rests'
);
select public.cancel_pending_order(:'short_id'::uuid) is not null \g /dev/null
select public.set_short_selling(false) is not null \g /dev/null

-- --------------------------------------------------------------------------
\echo '== cancelling =='
-- --------------------------------------------------------------------------
select (public.place_pending_order(:'aapl'::uuid, 'BUY', 1, 'LIMIT', 10)).id::text as cancel_id
\gset
select public.cancel_pending_order(:'cancel_id'::uuid) is not null \g /dev/null
select public.assert_true(
  (select status = 'CANCELLED' from public.pending_orders where id = :'cancel_id'::uuid),
  'a cancelled order is cancelled'
);

do $$
declare
  v_id uuid := (select id from public.pending_orders where status = 'CANCELLED' limit 1);
begin
  perform public.cancel_pending_order(v_id);
  raise exception 'FAIL: cancelled the same order twice';
exception when check_violation then
  raise notice 'ok: cancelling twice is refused';
end $$;

-- A cancelled order must never fire.
select public.assert_eq(
  (select filled from public.settle_pending_orders(:'aapl'::uuid, 5)), 0,
  'a cancelled order does not fill when its price arrives'
);

-- --------------------------------------------------------------------------
\echo '== rejected input =='
-- --------------------------------------------------------------------------
do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
  v_cases text[] := array['side', 'type', 'quantity', 'noprice', 'notime', 'pricefortime', 'timeforprice', 'asset'];
  v_case text;
begin
  foreach v_case in array v_cases loop
    begin
      case v_case
        when 'side'         then perform public.place_pending_order(v_asset, 'SIDEWAYS', 1, 'LIMIT', 10);
        when 'type'         then perform public.place_pending_order(v_asset, 'BUY', 1, 'WISHFUL', 10);
        when 'quantity'     then perform public.place_pending_order(v_asset, 'BUY', 0, 'LIMIT', 10);
        when 'noprice'      then perform public.place_pending_order(v_asset, 'BUY', 1, 'LIMIT', null);
        when 'notime'       then perform public.place_pending_order(v_asset, 'BUY', 1, 'TIME', null, null);
        when 'pricefortime' then perform public.place_pending_order(v_asset, 'BUY', 1, 'TIME', 10, now() + interval '1 hour');
        when 'timeforprice' then perform public.place_pending_order(v_asset, 'BUY', 1, 'LIMIT', 10, now() + interval '1 hour');
        when 'asset'        then perform public.place_pending_order(gen_random_uuid(), 'BUY', 1, 'LIMIT', 10);
      end case;
      raise exception 'FAIL: % was accepted', v_case;
    exception
      when invalid_parameter_value or check_violation or foreign_key_violation then
        raise notice 'ok: % rejected', v_case;
    end;
  end loop;
end $$;

-- The shape constraint is the database's, not the function's.
reset role;
do $$
declare
  v_pf    uuid := (select id from public.portfolios limit 1);
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
begin
  insert into public.pending_orders
    (portfolio_id, asset_id, side, quantity, trigger_type, trigger_price, trigger_at)
  values (v_pf, v_asset, 'BUY', 1, 'LIMIT', 10, now());
  raise exception 'FAIL: a limit order with a time was inserted';
exception when check_violation then
  raise notice 'ok: the trigger shape is enforced by the table';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== orders are private to the account that placed them =='
-- --------------------------------------------------------------------------
select (public.place_pending_order(:'aapl'::uuid, 'BUY', 1, 'LIMIT', 1)).id::text as mine
\gset

-- psql does not substitute :variables inside a dollar-quoted body, so the id
-- travels in a setting the block can read.
select set_config('invest_pal.mine', :'mine', false) \g /dev/null
select set_config('request.jwt.claim.sub', :'other', false) \g /dev/null

select public.assert_eq(
  (select count(*) from public.pending_orders), 0,
  'the other account sees none of them'
);
do $$
declare
  v_id uuid := current_setting('invest_pal.mine', true)::uuid;
begin
  perform public.cancel_pending_order(v_id);
  raise exception 'FAIL: cancelled another account%s order', '''';
exception when foreign_key_violation then
  raise notice 'ok: cancelling across accounts is refused';
end $$;

-- And the order the stranger could not touch is still waiting.
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null
select public.assert_true(
  (select status = 'PENDING' from public.pending_orders where id = :'mine'::uuid),
  'and it is still resting afterwards'
);

-- --------------------------------------------------------------------------
\echo '== starting over clears the order book =='
-- --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select public.assert_true(
  (select count(*) > 0 from public.pending_orders), 'there are orders to clear'
);
select public.reset_portfolio(1000) is not null \g /dev/null
select public.assert_eq(
  (select count(*) from public.pending_orders), 0,
  'reset removes every order, not just the trades'
);

reset role;
drop function public.assert_eq(numeric, numeric, text);
drop function public.assert_true(boolean, text);

\echo '== all pending order checks passed =='
