-- Tests for per-account commission profiles (migration 0007).
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

delete from public.transactions;
delete from public.portfolios;
delete from public.profiles;
delete from auth.users;

insert into auth.users (email) values ('broker@test');

select id::text as u from auth.users where email = 'broker@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset
select id::text as btc from public.assets where ticker = 'BTC-USD'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== an account starts on the house rates =='
-- --------------------------------------------------------------------------
select public.assert_true(
  (select commission_profile = 'standard' from public.portfolios),
  'a new account is on the standard profile'
);
-- Unchanged from before this migration, so nothing already open got dearer.
select public.assert_eq(
  (select spread_bps from public.trading_costs('STOCK')), 5, 'standard stock spread'
);
select public.assert_eq(
  (select commission_bps from public.trading_costs('STOCK')), 2, 'standard commission'
);
select public.assert_eq(
  (select min_commission from public.trading_costs('STOCK')), 0.50, 'standard floor'
);
select public.assert_eq(
  (select spread_bps from public.trading_costs('CRYPTO')), 20, 'crypto is wider'
);

-- --------------------------------------------------------------------------
\echo '== the quote follows the account, not the app =='
-- --------------------------------------------------------------------------
select public.set_commission_profile('bank') is not null \g /dev/null
select public.assert_eq(
  (select commission_bps from public.trading_costs('STOCK')), 40,
  'switching profile changes what the UI is quoted'
);
select public.assert_eq(
  (select min_commission from public.trading_costs('STOCK')), 15.00,
  'including the floor'
);

do $$
begin
  perform public.set_commission_profile('a broker that does not exist');
  raise exception 'FAIL: an unknown profile was accepted';
exception when foreign_key_violation then
  raise notice 'ok: an unknown profile is refused';
end $$;

-- --------------------------------------------------------------------------
\echo '== a high minimum eats a small trade =='
-- --------------------------------------------------------------------------
-- Still on the bank profile. One share at 100: 8 bps of spread makes the fill
-- 100.04, and 40 bps of that is 0.40 — far under the 15.00 floor, so the floor
-- is what is charged. That is 15% of the trade, which is the whole lesson.
select (public.trade(:'aapl'::uuid, 'BUY', 1, 100)).id::text as bank_id
\gset
select public.assert_eq(
  (select round(entry_price, 4) from public.transactions where id = :'bank_id'::uuid),
  100.0400, 'the bank profile has a wider spread'
);
select public.assert_eq(
  (select open_fee from public.transactions where id = :'bank_id'::uuid),
  15.00, 'and its minimum swallows a one-share trade'
);
select public.assert_eq(
  (select cash_balance from public.portfolios), 99884.96,
  'which comes straight out of the balance'
);
select public.trade(:'aapl'::uuid, 'SELL', 1, 100) is not null \g /dev/null

-- --------------------------------------------------------------------------
\echo '== commission-free is not free, it is in the spread =='
-- --------------------------------------------------------------------------
reset role;
update public.portfolios set cash_balance = 100000 where user_id = :'u'::uuid;
delete from public.transactions;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select public.set_commission_profile('commission_free') is not null \g /dev/null
select (public.trade(:'aapl'::uuid, 'BUY', 100, 100)).id::text as free_id
\gset
select public.assert_eq(
  (select open_fee from public.transactions where id = :'free_id'::uuid),
  0, 'no commission is charged'
);
-- 12 bps of spread: half of it on the way in makes the fill 100.06, so the
-- hundred shares cost 6.00 more than the mid. The cost did not go away.
select public.assert_eq(
  (select round(entry_price, 4) from public.transactions where id = :'free_id'::uuid),
  100.0600, 'the spread is where it went'
);
select public.assert_eq(
  (select round(quantity * (entry_price - entry_mid), 2)
     from public.transactions where id = :'free_id'::uuid),
  6.00, 'and it costs more than the standard profile total would have'
);

-- --------------------------------------------------------------------------
\echo '== a per-share charge does not care what the price is =='
-- --------------------------------------------------------------------------
reset role;
update public.portfolios set cash_balance = 100000 where user_id = :'u'::uuid;
delete from public.transactions;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select public.set_commission_profile('per_share') is not null \g /dev/null
select public.assert_eq(
  (select commission_per_unit from public.trading_costs('STOCK')), 0.0050,
  'the profile charges half a cent a share'
);

-- 1,000 shares at half a cent is 5.00, over the 1.00 floor.
select (public.trade(:'aapl'::uuid, 'BUY', 1000, 10)).id::text as ps_id
\gset
select public.assert_eq(
  (select open_fee from public.transactions where id = :'ps_id'::uuid),
  5.00, 'a thousand shares pay five dollars'
);
select public.trade(:'aapl'::uuid, 'SELL', 1000, 10) is not null \g /dev/null

-- The same thousand shares at nine times the price pay exactly the same, which
-- is what makes a per-unit charge different from a percentage.
select (public.trade(:'aapl'::uuid, 'BUY', 1000, 90)).id::text as ps2_id
\gset
select public.assert_eq(
  (select open_fee from public.transactions where id = :'ps2_id'::uuid),
  5.00, 'and so do a thousand shares that cost nine times as much'
);
select public.trade(:'aapl'::uuid, 'SELL', 1000, 90) is not null \g /dev/null

-- Ten shares is five cents, so the floor is what is charged.
select (public.trade(:'aapl'::uuid, 'BUY', 10, 100)).id::text as ps3_id
\gset
select public.assert_eq(
  (select open_fee from public.transactions where id = :'ps3_id'::uuid),
  1.00, 'a small order pays the floor instead'
);
select public.trade(:'aapl'::uuid, 'SELL', 10, 100) is not null \g /dev/null

-- --------------------------------------------------------------------------
\echo '== the engine charges what the UI was quoted =='
-- --------------------------------------------------------------------------
reset role;
update public.portfolios set cash_balance = 100000 where user_id = :'u'::uuid;
delete from public.transactions;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select public.set_commission_profile('percentage') is not null \g /dev/null

-- Quote first, exactly as the trade panel does, then trade and compare. A quote
-- that disagrees with the charge is worse than no quote at all.
create temp table quoted as select * from public.trading_costs('STOCK');

select (public.trade(:'aapl'::uuid, 'BUY', 50, 200)).id::text as q_id
\gset
select public.assert_eq(
  (select round(entry_price, 6) from public.transactions where id = :'q_id'::uuid),
  (select round(200 * (1 + spread_bps / 20000.0), 6) from quoted),
  'the fill matches the quoted spread'
);
select public.assert_eq(
  (select open_fee from public.transactions where id = :'q_id'::uuid),
  (select greatest(
            round(t.quantity * t.entry_price * q.commission_bps / 10000.0
                  + t.quantity * q.commission_per_unit, 2),
            q.min_commission)
     from public.transactions t, quoted q where t.id = :'q_id'::uuid),
  'and the commission matches the quoted rates'
);

-- --------------------------------------------------------------------------
\echo '== switching profile does not rewrite a position already open =='
-- --------------------------------------------------------------------------
select (select open_fee from public.transactions where id = :'q_id'::uuid) as fee_before
\gset
select (select round(entry_price, 6) from public.transactions where id = :'q_id'::uuid)
  as entry_before
\gset

select public.set_commission_profile('bank') is not null \g /dev/null

select public.assert_eq(
  (select open_fee from public.transactions where id = :'q_id'::uuid), :fee_before,
  'the fee already paid is untouched'
);
select public.assert_eq(
  (select round(entry_price, 6) from public.transactions where id = :'q_id'::uuid),
  :entry_before, 'and so is the price it filled at'
);

-- --------------------------------------------------------------------------
\echo '== crypto carries the wider spread on every profile =='
-- --------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select key from public.commission_profiles loop
    if (select crypto_spread_bps <= stock_spread_bps
          from public.commission_profiles where key = r.key) then
      raise exception 'FAIL: % does not widen the spread for crypto', r.key;
    end if;
  end loop;
  raise notice 'ok: every profile widens the spread for crypto';
end $$;

select public.assert_true(
  (select spread_bps from public.trading_costs_for('bank', 'CRYPTO'))
  > (select spread_bps from public.trading_costs_for('bank', 'STOCK')),
  'and trading_costs_for reports it'
);

-- --------------------------------------------------------------------------
\echo '== profiles are readable, and not writable =='
-- --------------------------------------------------------------------------
select public.assert_true(
  (select count(*) >= 5 from public.commission_profiles), 'the profiles are readable'
);

do $$
begin
  update public.commission_profiles set min_commission = 0 where key = 'bank';
  if found then
    raise exception 'FAIL: a client rewrote the broker rates';
  end if;
  raise notice 'ok: rates are not client-writable';
exception when insufficient_privilege then
  raise notice 'ok: rates are not client-writable';
end $$;

reset role;
drop table if exists quoted;
drop function public.assert_eq(numeric, numeric, text);
drop function public.assert_true(boolean, text);

\echo '== all commission profile checks passed =='
