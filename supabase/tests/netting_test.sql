-- Tests for netted positions and starting over (migration 0006).
--
-- Run with psql -v ON_ERROR_STOP=1: every check raises on failure, so a
-- non-zero exit means something regressed.
--
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/harness.sql
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
--   ... through 0006 ...
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/netting_test.sql

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

insert into auth.users (email) values ('nettie@test'), ('other@test');

select id::text as u from auth.users where email = 'nettie@test'
\gset
select id::text as other from auth.users where email = 'other@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset
select id::text as msft from public.assets where ticker = 'MSFT'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== you cannot sell what you do not hold =='
-- --------------------------------------------------------------------------
select public.assert_true(
  (select not short_selling_enabled from public.portfolios), 'short selling is off by default'
);

do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
begin
  perform public.trade(v_asset, 'SELL', 1, 100);
  raise exception 'FAIL: sold an asset the account does not hold';
exception when check_violation then
  raise notice 'ok: selling nothing is refused';
end $$;

-- The refusal is about holdings, not about the asset being unknown: buying the
-- very same asset in the very same state works.
select public.trade(:'aapl'::uuid, 'BUY', 10, 100) is not null \g /dev/null
select public.assert_eq(
  (select quantity from public.transactions where status = 'OPEN'), 10,
  'buying from flat opens a long'
);

-- --------------------------------------------------------------------------
\echo '== buying twice adds to one holding, it does not open a second =='
-- --------------------------------------------------------------------------
select public.trade(:'aapl'::uuid, 'BUY', 10, 200) is not null \g /dev/null

select public.assert_eq(
  (select count(*) from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid), 1,
  'still one open position'
);
select public.assert_eq(
  (select quantity from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid), 20,
  'the quantities are summed'
);
-- 10 @ 100.025 and 10 @ 200.05 -> (1000.25 + 2000.50) / 20 = 150.0375
select public.assert_eq(
  (select round(entry_price, 4) from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid),
  150.0375, 'the entry is the weighted average of the two fills'
);

-- The averaging has to be exact, not merely close. Stated as an identity rather
-- than as arithmetic: every cent that left the account is either posted against
-- the netted position or recorded as commission on it. A rounded average would
-- quietly lose or invent money on every top-up, and this is what would catch it.
select public.assert_eq(
  (select round(100000 - cash_balance, 2) from public.portfolios),
  (select round(quantity * entry_price, 2) + open_fee
     from public.transactions where status = 'OPEN' and asset_id = :'aapl'::uuid),
  'every cent gone is either posted against the holding or was commission'
);

-- --------------------------------------------------------------------------
\echo '== netting is per asset, not per account =='
-- --------------------------------------------------------------------------
select public.trade(:'msft'::uuid, 'BUY', 5, 50) is not null \g /dev/null
select public.assert_eq(
  (select count(*) from public.transactions where status = 'OPEN'), 2,
  'a second asset is a second holding'
);

-- --------------------------------------------------------------------------
\echo '== selling sells what you hold, and no more =='
-- --------------------------------------------------------------------------
do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
begin
  perform public.trade(v_asset, 'SELL', 21, 150);
  raise exception 'FAIL: sold more than the account holds';
exception when check_violation then
  raise notice 'ok: selling more than you hold is refused';
end $$;

-- A partial sale leaves the rest open at the same entry.
select public.trade(:'aapl'::uuid, 'SELL', 8, 150) is not null \g /dev/null
select public.assert_eq(
  (select quantity from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid), 12,
  'a partial sale leaves the remainder open'
);
select public.assert_eq(
  (select round(entry_price, 4) from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid),
  150.0375, 'the remainder keeps its entry price'
);
select public.assert_eq(
  (select count(*) from public.transactions
    where status = 'CLOSED' and asset_id = :'aapl'::uuid), 1,
  'the sold portion is settled as its own row'
);
select public.assert_eq(
  (select quantity from public.transactions
    where status = 'CLOSED' and asset_id = :'aapl'::uuid), 8,
  'the settled row carries the quantity sold'
);

-- The opening commission follows the shares. Both fills were small enough to
-- pay the 0.50 minimum, so the position carried 1.00; 8 of 20 sold takes 0.40
-- of it with them and leaves 0.60 behind.
select public.assert_eq(
  (select open_fee from public.transactions
    where status = 'CLOSED' and asset_id = :'aapl'::uuid),
  0.40, 'the sold portion carries its share of what opening cost'
);
select public.assert_eq(
  (select open_fee from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid),
  0.60, 'the remainder keeps the rest of it'
);

-- Selling the lot closes the position where it stands, keeping its id.
select (select id::text from public.transactions
         where status = 'OPEN' and asset_id = :'aapl'::uuid) as rest_id
\gset
select public.trade(:'aapl'::uuid, 'SELL', 12, 150) is not null \g /dev/null
select public.assert_eq(
  (select count(*) from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid), 0,
  'selling the lot closes the holding'
);
select public.assert_true(
  (select status = 'CLOSED' from public.transactions where id = :'rest_id'::uuid),
  'the position is settled in place, keeping its id'
);

-- --------------------------------------------------------------------------
\echo '== an order that would cross through zero is refused, not flipped =='
-- --------------------------------------------------------------------------
select public.set_short_selling(true) is not null \g /dev/null
select public.trade(:'aapl'::uuid, 'BUY', 5, 100) is not null \g /dev/null

do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
begin
  -- Long 5, selling 9 would leave the account short 4. One tap should not be
  -- able to turn a long into a short, even with short selling switched on.
  perform public.trade(v_asset, 'SELL', 9, 100);
  raise exception 'FAIL: an order flipped a long into a short';
exception when check_violation then
  raise notice 'ok: crossing through zero is refused even with shorting on';
end $$;

select public.assert_eq(
  (select quantity from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid), 5,
  'the refused order left the holding untouched'
);
select public.trade(:'aapl'::uuid, 'SELL', 5, 100) is not null \g /dev/null

-- --------------------------------------------------------------------------
\echo '== shorting, once it is switched on =='
-- --------------------------------------------------------------------------
select public.trade(:'aapl'::uuid, 'SELL', 10, 100) is not null \g /dev/null
select public.assert_true(
  (select direction = 'SHORT' from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid),
  'selling from flat opens a short'
);

-- Selling again deepens the short rather than opening a second one.
select public.trade(:'aapl'::uuid, 'SELL', 10, 100) is not null \g /dev/null
select public.assert_eq(
  (select quantity from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid), 20,
  'selling again deepens the short'
);

do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
begin
  perform public.trade(v_asset, 'BUY', 21, 100);
  raise exception 'FAIL: bought past the size of the short';
exception when check_violation then
  raise notice 'ok: covering more than you are short is refused';
end $$;

select public.trade(:'aapl'::uuid, 'BUY', 5, 100) is not null \g /dev/null
select public.assert_eq(
  (select quantity from public.transactions
    where status = 'OPEN' and asset_id = :'aapl'::uuid), 15,
  'a partial cover reduces the short'
);

-- --------------------------------------------------------------------------
\echo '== switching shorting off never strands an open short =='
-- --------------------------------------------------------------------------
select public.set_short_selling(false) is not null \g /dev/null

do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
begin
  perform public.trade(v_asset, 'SELL', 1, 100);
  raise exception 'FAIL: deepened a short with short selling switched off';
exception when check_violation then
  raise notice 'ok: with shorting off, the short cannot be deepened';
end $$;

-- Covering is a buy, which reduces rather than opens, so the flag does not
-- apply to it. Anything else would lock the account out of its own position.
select public.trade(:'aapl'::uuid, 'BUY', 15, 100) is not null \g /dev/null
select public.assert_eq(
  (select count(*) from public.transactions where status = 'OPEN'
     and asset_id = :'aapl'::uuid), 0,
  'the short can still be covered in full'
);

-- --------------------------------------------------------------------------
\echo '== the index enforces one open position, not just the function =='
-- --------------------------------------------------------------------------
reset role;
do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'MSFT');
  -- The portfolio that actually holds MSFT, not whichever row comes first:
  -- there are two accounts in this suite.
  v_pf    uuid := (select portfolio_id from public.transactions
                    where status = 'OPEN' and asset_id = v_asset);
begin
  -- MSFT is already held. A second open row for it must be impossible even for
  -- a writer that goes around the trade function entirely.
  insert into public.transactions (portfolio_id, asset_id, direction, quantity, entry_price)
  values (v_pf, v_asset, 'LONG', 1, 10);
  raise exception 'FAIL: a second open position was inserted';
exception when unique_violation then
  raise notice 'ok: a second open position on one asset is rejected by the index';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== starting over =='
-- --------------------------------------------------------------------------
select public.assert_true(
  (select count(*) > 0 from public.transactions), 'there is history to clear'
);
select public.assert_true(
  (select count(*) > 0 from public.transactions where status = 'OPEN'),
  'and an open position to clear'
);

select public.reset_portfolio(1000) is not null \g /dev/null

select public.assert_eq(
  (select count(*) from public.transactions), 0,
  'reset clears every trade, open and closed'
);
select public.assert_eq(
  (select cash_balance from public.portfolios), 1000.00,
  'reset funds the account with the chosen amount'
);
select public.assert_eq(
  (select starting_balance from public.portfolios), 1000.00,
  'reset records what it was funded with, so return is measured against it'
);

-- Omitting the amount keeps whatever the account is currently set to.
select public.trade(:'aapl'::uuid, 'BUY', 1, 100) is not null \g /dev/null
select public.reset_portfolio() is not null \g /dev/null
select public.assert_eq(
  (select cash_balance from public.portfolios), 1000.00,
  'reset with no amount keeps the current starting balance'
);

-- Unlike signup metadata, this comes from someone already signed in making a
-- deliberate choice, so an amount nobody offered is refused rather than
-- quietly swapped for the default.
do $$
begin
  perform public.reset_portfolio(999999999);
  raise exception 'FAIL: funded an account with an amount nobody offered';
exception when invalid_parameter_value then
  raise notice 'ok: an unoffered starting balance is refused outright';
end $$;
select public.assert_eq(
  (select cash_balance from public.portfolios), 1000.00,
  'the refused reset changed nothing'
);

-- --------------------------------------------------------------------------
\echo '== reset digs an account out of a hole =='
-- --------------------------------------------------------------------------
-- A short that ran away leaves the balance negative and no way to trade. Being
-- able to start over is what stops that being the end of the account.
reset role;
update public.portfolios set cash_balance = -500 where user_id = :'u'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select public.reset_portfolio(10000) is not null \g /dev/null
select public.assert_eq(
  (select cash_balance from public.portfolios), 10000.00,
  'reset recovers an account that went negative'
);

-- --------------------------------------------------------------------------
\echo '== reset touches only your own account =='
-- --------------------------------------------------------------------------
-- Read as the owner role: RLS quite rightly hides the other account from the
-- signed-in one, which is why the before-and-after reads step outside it.
reset role;
select public.assert_eq(
  (select cash_balance from public.portfolios where user_id = :'other'::uuid),
  100000.00, 'the other account starts funded'
);
set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

select public.reset_portfolio(100) is not null \g /dev/null

reset role;
select public.assert_eq(
  (select cash_balance from public.portfolios where user_id = :'other'::uuid),
  100000.00, 'the other account is untouched by the reset'
);
select public.assert_eq(
  (select cash_balance from public.portfolios where user_id = :'u'::uuid),
  100.00, 'and the caller was reset'
);
select public.assert_eq(
  (select count(*) from public.transactions
    where portfolio_id in (select id from public.portfolios where user_id = :'other'::uuid)),
  0, 'the other account kept its own trades'
);

-- --------------------------------------------------------------------------
\echo '== the migration nets whatever the old engine left behind =='
-- --------------------------------------------------------------------------
-- This is the part that runs against real accounts, so it is worth exercising
-- rather than trusting. The index has to come off first: with it in place the
-- duplicate rows this is meant to clean up cannot be created at all.
delete from public.transactions;
drop index if exists public.transactions_one_open_per_asset_idx;

update public.portfolios set cash_balance = 50000 where user_id = :'other'::uuid;

insert into public.transactions
  (portfolio_id, asset_id, direction, quantity, entry_price, entry_mid, open_fee, opened_at)
select p.id, a.id, v.direction, v.qty, v.entry, v.entry, v.fee, now() - v.ago
  from public.portfolios p
  cross join lateral (values
    ('AAPL', 'LONG',  10::numeric, 100::numeric, 0.50::numeric, interval '3 hours'),
    ('AAPL', 'LONG',  30::numeric, 200::numeric, 2.00::numeric, interval '2 hours'),
    ('MSFT', 'LONG',   5::numeric,  50::numeric, 0.50::numeric, interval '2 hours'),
    -- The one that cannot survive: a short on an asset already held long.
    ('MSFT', 'SHORT',  2::numeric,  60::numeric, 0.50::numeric, interval '1 hour')
  ) as v(ticker, direction, qty, entry, fee, ago)
  join public.assets a on a.ticker = v.ticker
 where p.user_id = :'other'::uuid;

-- Cash plus the collateral posted against open positions. Netting must not
-- move this by a cent: 50,000 + 1,000 + 6,000 + 250 + 120.
select public.assert_eq(
  (select round(cash_balance, 2) from public.portfolios where user_id = :'other'::uuid)
  + (select round(sum(quantity * entry_price), 2) from public.transactions where status = 'OPEN'),
  57370.00, 'the account is worth 57,370 at entry prices before netting'
);

\i supabase/migrations/0006_netting_and_reset.sql

select public.assert_eq(
  (select count(*) from public.transactions where status = 'OPEN'), 2,
  'four open rows on two assets become two'
);
select public.assert_eq(
  (select quantity from public.transactions t
     join public.assets a on a.id = t.asset_id
    where t.status = 'OPEN' and a.ticker = 'AAPL'), 40,
  'the two AAPL longs merge into one holding'
);
-- (10 * 100 + 30 * 200) / 40 = 175, so the collateral posted is unchanged.
select public.assert_eq(
  (select round(entry_price, 4) from public.transactions t
     join public.assets a on a.id = t.asset_id
    where t.status = 'OPEN' and a.ticker = 'AAPL'), 175.0000,
  'at the weighted average of the two entries'
);
select public.assert_eq(
  (select open_fee from public.transactions t
     join public.assets a on a.id = t.asset_id
    where t.status = 'OPEN' and a.ticker = 'AAPL'), 2.50,
  'carrying both commissions'
);
-- The short was opened last, so it is the leg that gets unwound.
select public.assert_true(
  (select direction = 'LONG' from public.transactions t
     join public.assets a on a.id = t.asset_id
    where t.status = 'OPEN' and a.ticker = 'MSFT'),
  'the hedged pair leaves the older leg standing'
);
select public.assert_true(
  (select exit_price = entry_price from public.transactions t
     join public.assets a on a.id = t.asset_id
    where t.status = 'CLOSED' and a.ticker = 'MSFT'),
  'and unwinds the other at its own entry, realising nothing'
);

select public.assert_eq(
  (select round(cash_balance, 2) from public.portfolios where user_id = :'other'::uuid)
  + (select round(sum(quantity * entry_price), 2) from public.transactions where status = 'OPEN'),
  57370.00, 'and the account is worth exactly the same afterwards'
);

drop function public.assert_eq(numeric, numeric, text);
drop function public.assert_true(boolean, text);

\echo '== all netting and reset checks passed =='
