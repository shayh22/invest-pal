-- Tests for execution costs (migration 0004).
--
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/harness.sql
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
--   ... 0002, 0003, 0004 ...
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/execution_costs_test.sql

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

delete from public.transactions;
delete from public.portfolios;
delete from public.profiles;
delete from auth.users;

insert into auth.users (email) values ('costs@test');
select id::text as u from auth.users where email = 'costs@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset
select id::text as btc from public.assets where ticker = 'BTC-USD'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== the spread always works against the trader =='
-- --------------------------------------------------------------------------
-- AAPL is a STOCK: 5 bps spread, so half a spread is 2.5 bps = 0.025%.
-- A long at a mid of 100 fills at 100.025; a short fills at 99.975.
select (public.open_position(:'aapl'::uuid, 'LONG', 10, 100)).id::text as long_id
\gset
select public.assert_eq(
  (select round(entry_price, 4) from public.transactions where id = :'long_id'::uuid),
  100.0250, 'a long fills above the mid'
);
select public.assert_eq(
  (select entry_mid from public.transactions where id = :'long_id'::uuid),
  100, 'the requested mid is recorded'
);

select (public.open_position(:'aapl'::uuid, 'SHORT', 10, 100)).id::text as short_id
\gset
select public.assert_eq(
  (select round(entry_price, 4) from public.transactions where id = :'short_id'::uuid),
  99.9750, 'a short fills below the mid'
);

-- --------------------------------------------------------------------------
\echo '== crypto carries a wider spread than equities =='
-- --------------------------------------------------------------------------
select public.assert_eq(
  (select spread_bps from public.trading_costs('CRYPTO')), 20,
  'crypto spread is 20 bps'
);
select public.assert_eq(
  (select spread_bps from public.trading_costs('STOCK')), 5,
  'equity spread is 5 bps'
);

select (public.open_position(:'btc'::uuid, 'LONG', 1, 1000)).id::text as btc_id
\gset
-- 20 bps spread -> half is 10 bps -> a fill 0.1% above the mid.
select public.assert_eq(
  (select round(entry_price, 4) from public.transactions where id = :'btc_id'::uuid),
  1001.0000, 'a crypto long pays the wider half-spread'
);

-- --------------------------------------------------------------------------
\echo '== commission is charged on every fill =='
-- --------------------------------------------------------------------------
-- 2 bps of a 1,000.25 notional is 0.20, below the 0.50 floor.
select public.assert_eq(
  (select open_fee from public.transactions where id = :'long_id'::uuid),
  0.50, 'a small trade pays the minimum commission'
);
-- 2 bps of 10,010 is 2.00, above the floor.
select (public.open_position(:'aapl'::uuid, 'LONG', 100, 100)).id::text as big_id
\gset
select public.assert_eq(
  (select open_fee from public.transactions where id = :'big_id'::uuid),
  2.00, 'a larger trade pays the percentage'
);

-- --------------------------------------------------------------------------
\echo '== the headline lesson: a flat round trip loses money =='
-- --------------------------------------------------------------------------
reset role;
update public.portfolios set cash_balance = 100000
 where user_id = :'u'::uuid;
delete from public.transactions;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select (public.open_position(:'aapl'::uuid, 'LONG', 100, 100)).id::text as flat_id
\gset
-- Open: fill 100.025, notional 10,002.50, fee 2.00 -> balance 89,995.50
select public.assert_eq(
  (select cash_balance from public.portfolios), 89995.50,
  'opening costs the notional plus commission'
);

-- Close at the same mid: fill 99.975, so the spread is paid again.
-- pnl = 100 * (99.975 - 100.025) = -5.00
-- fee = max(2 bps of 9,997.50, 0.50) = 2.00
-- proceeds = 10,002.50 - 5.00 - 2.00 = 9,995.50
select public.close_position(:'flat_id'::uuid, 100) is not null \g /dev/null
select public.assert_eq(
  (select cash_balance from public.portfolios), 99991.00,
  'a round trip at an unchanged price loses the spread and both commissions'
);
-- 100,000 - 99,991 = 9.00: 5.00 of spread and 4.00 of commission.
select public.assert_eq(
  (select round(open_fee + close_fee, 2) from public.transactions where id = :'flat_id'::uuid),
  4.00, 'both commissions are recorded on the trade'
);

-- --------------------------------------------------------------------------
\echo '== a winning trade still pays its costs =='
-- --------------------------------------------------------------------------
reset role;
update public.portfolios set cash_balance = 100000 where user_id = :'u'::uuid;
delete from public.transactions;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select (public.open_position(:'aapl'::uuid, 'LONG', 100, 100)).id::text as win_id
\gset
select public.close_position(:'win_id'::uuid, 110) is not null \g /dev/null
-- Open fill 100.025; close fill 109.9725. pnl = 100 * 9.9475 = 994.75
-- fees = 2.00 + max(2 bps of 10,997.25, 0.50) = 2.00 + 2.20 = 4.20
-- Net = 994.75 - 4.20 = 990.55
select public.assert_eq(
  (select cash_balance from public.portfolios), 100990.55,
  'a 10% move nets the gain less spread and commission'
);

-- --------------------------------------------------------------------------
\echo '== a short pays the spread in both directions too =='
-- --------------------------------------------------------------------------
reset role;
update public.portfolios set cash_balance = 100000 where user_id = :'u'::uuid;
delete from public.transactions;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select (public.open_position(:'aapl'::uuid, 'SHORT', 100, 100)).id::text as sh_id
\gset
-- Entry fill 99.975 (sold at the bid): notional 9,997.50, fee 2.00.
-- 100,000 - 9,997.50 - 2.00 = 90,000.50
select public.assert_eq(
  (select cash_balance from public.portfolios), 90000.50,
  'a short reserves its notional and pays commission'
);
select public.close_position(:'sh_id'::uuid, 100) is not null \g /dev/null
-- Close fill 100.025 (bought back at the ask). pnl = 100 * (99.975 - 100.025) = -5.00
-- fee = max(2 bps of 10,002.50, 0.50) = 2.00
-- proceeds = 9,997.50 - 5.00 - 2.00 = 9,990.50
-- 90,000.50 + 9,990.50 = 99,991.00 — the same 9.00 a flat long round trip
-- loses, which is the point: the cost is symmetric.
select public.assert_eq(
  (select cash_balance from public.portfolios), 99991.00,
  'a flat short round trip loses the spread and both commissions'
);

-- --------------------------------------------------------------------------
\echo '== affordability accounts for the commission, not just the notional =='
-- --------------------------------------------------------------------------
reset role;
update public.portfolios set cash_balance = 1000.30 where user_id = :'u'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

do $$
begin
  -- Notional is 1,000.25 and affordable on its own; with the 0.50 minimum
  -- commission it is not, and the old code would have let it through.
  perform public.open_position(
    (select id from public.assets where ticker = 'AAPL'), 'LONG', 10, 100
  );
  raise exception 'FAIL: a trade was allowed that could not pay its commission';
exception when check_violation then
  raise notice 'ok: a trade that cannot pay its commission is refused';
end $$;

reset role;
drop function public.assert_eq(numeric, numeric, text);
\echo '== all execution cost checks passed =='
