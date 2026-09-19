-- Tests for price alerts (migration 0010).

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

insert into auth.users (email) values ('alerter@test'), ('bystander@test');

select id::text as u from auth.users where email = 'alerter@test'
\gset
select id::text as other from auth.users where email = 'bystander@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset
select id::text as msft from public.assets where ticker = 'MSFT'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== an alert fires on the level, in the direction it was set =='
-- --------------------------------------------------------------------------
select (public.create_price_alert(:'aapl'::uuid, 'ABOVE', 200)).id::text as above_id
\gset
select (public.create_price_alert(:'aapl'::uuid, 'BELOW', 100)).id::text as below_id
\gset

-- Between the two levels: neither has been reached.
select public.assert_eq(public.settle_price_alerts(:'aapl'::uuid, 150), 0,
  'a price between the levels fires nothing'
);

select public.assert_eq(public.settle_price_alerts(:'aapl'::uuid, 201), 1,
  'rising through the upper level fires one'
);
select public.assert_true(
  (select triggered_at is not null from public.price_alerts where id = :'above_id'::uuid),
  'and it is the ABOVE one'
);
select public.assert_true(
  (select triggered_at is null from public.price_alerts where id = :'below_id'::uuid),
  'while the BELOW one is still watching'
);
-- The price that set it off, which is not the level it was set at.
select public.assert_eq(
  (select triggered_price from public.price_alerts where id = :'above_id'::uuid), 201,
  'the price that set it off is recorded'
);

select public.assert_eq(public.settle_price_alerts(:'aapl'::uuid, 99), 1,
  'falling through the lower level fires the other'
);

-- --------------------------------------------------------------------------
\echo '== an alert is a one-shot =='
-- --------------------------------------------------------------------------
-- Still well past both levels, but they have had their say.
select public.assert_eq(public.settle_price_alerts(:'aapl'::uuid, 99), 0,
  'a fired alert does not fire again'
);
select public.assert_eq(public.settle_price_alerts(:'aapl'::uuid, 500), 0,
  'not even when the price moves further past it'
);

-- --------------------------------------------------------------------------
\echo '== exactly at the level counts =='
-- --------------------------------------------------------------------------
select public.create_price_alert(:'msft'::uuid, 'ABOVE', 300) is not null \g /dev/null
select public.assert_eq(public.settle_price_alerts(:'msft'::uuid, 300), 1,
  'reaching the level exactly is reaching it'
);

-- --------------------------------------------------------------------------
\echo '== seen, and gone =='
-- --------------------------------------------------------------------------
select public.assert_eq(
  (select count(*) from public.price_alerts where triggered_at is not null and not acknowledged), 3,
  'three fired and unread'
);
select public.assert_eq(public.acknowledge_price_alerts(), 3, 'all three marked seen');
select public.assert_eq(
  (select count(*) from public.price_alerts where triggered_at is not null and not acknowledged), 0,
  'and none are unread now'
);
select public.assert_eq(public.acknowledge_price_alerts(), 0, 'acknowledging again does nothing');

select public.assert_true(public.delete_price_alert(:'above_id'::uuid), 'an alert can be removed');
do $$
begin
  perform public.delete_price_alert(gen_random_uuid());
  raise exception 'FAIL: removed an alert that does not exist';
exception when foreign_key_violation then
  raise notice 'ok: removing one that does not exist is refused';
end $$;

-- --------------------------------------------------------------------------
\echo '== rejected input =='
-- --------------------------------------------------------------------------
do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
  v_cases text[] := array['direction', 'price', 'zero', 'asset'];
  v_case text;
begin
  foreach v_case in array v_cases loop
    begin
      case v_case
        when 'direction' then perform public.create_price_alert(v_asset, 'SIDEWAYS', 10);
        when 'price'     then perform public.create_price_alert(v_asset, 'ABOVE', -1);
        when 'zero'      then perform public.create_price_alert(v_asset, 'ABOVE', 0);
        when 'asset'     then perform public.create_price_alert(gen_random_uuid(), 'ABOVE', 10);
      end case;
      raise exception 'FAIL: % was accepted', v_case;
    exception
      when invalid_parameter_value or check_violation or foreign_key_violation then
        raise notice 'ok: % rejected', v_case;
    end;
  end loop;
end $$;

-- The table refuses a half-fired row whatever the function does.
reset role;
do $$
declare
  v_pf uuid := (select id from public.portfolios limit 1);
begin
  insert into public.price_alerts (portfolio_id, asset_id, direction, price, triggered_at)
  values (v_pf, (select id from public.assets limit 1), 'ABOVE', 10, now());
  raise exception 'FAIL: a fired alert with no price was inserted';
exception when check_violation then
  raise notice 'ok: a fired alert must record the price that fired it';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== alerts are private =='
-- --------------------------------------------------------------------------
select set_config('invest_pal.mine', :'below_id', false) \g /dev/null
select set_config('request.jwt.claim.sub', :'other', false) \g /dev/null

select public.assert_eq((select count(*) from public.price_alerts), 0,
  'the other account sees none of them'
);
do $$
declare
  v_id uuid := current_setting('invest_pal.mine', true)::uuid;
begin
  perform public.delete_price_alert(v_id);
  raise exception 'FAIL: removed an alert belonging to someone else';
exception when foreign_key_violation then
  raise notice 'ok: removing across accounts is refused';
end $$;

-- A price on the stranger's account must not fire the first account's alerts.
select public.assert_eq(public.settle_price_alerts(:'msft'::uuid, 1), 0,
  'and its prices do not fire them either'
);

select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null
select public.assert_true(
  (select count(*) > 0 from public.price_alerts), 'the first account still has its own'
);

-- --------------------------------------------------------------------------
\echo '== starting the account over leaves the alerts alone =='
-- --------------------------------------------------------------------------
-- Same reasoning as the watchlist: an alert holds no money and no position.
-- It is a level someone asked to be told about, and re-funding the account is
-- not a statement about which levels still matter.
select set_config(
  'invest_pal.before',
  (select count(*) from public.price_alerts)::text,
  false
) \g /dev/null

select public.reset_portfolio(100000) \g /dev/null

select public.assert_eq(
  (select count(*) from public.price_alerts),
  current_setting('invest_pal.before', true)::numeric,
  'every alert survives a reset'
);

reset role;
drop function public.assert_eq(numeric, numeric, text);
drop function public.assert_true(boolean, text);

\echo '== all price alert checks passed =='
