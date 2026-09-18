-- Tests for the paper trading engine (migration 0002).
--
-- Run with psql -v ON_ERROR_STOP=1: every check raises on failure, so a
-- non-zero exit means something regressed.
--
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/harness.sql
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_trading_engine.sql
--   psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/trading_engine_test.sql

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

-- Fresh state. The signup trigger funds each portfolio with 100,000.
-- psql does not substitute :variables inside dollar-quoted bodies, so
-- comparisons that need one are made in the statement and passed in here.
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

insert into auth.users (email) values ('alice@test'), ('bob@test');

select id::text as alice from auth.users where email = 'alice@test'
\gset
select id::text as bob from auth.users where email = 'bob@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset
select id::text as alice_pf from public.portfolios where user_id = :'alice'::uuid
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'alice', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== provisioning =='
-- --------------------------------------------------------------------------
select public.assert_eq(
  (select cash_balance from public.portfolios), 100000.00,
  'new portfolio starts at 100,000'
);

-- --------------------------------------------------------------------------
\echo '== long round trip =='
-- --------------------------------------------------------------------------
--
-- These assert the accounting identity rather than a literal amount. Execution
-- costs (migration 0004) move every figure, and a test that hardcodes them
-- fails on a rate change without anything being wrong. The exact arithmetic of
-- spread and commission is owned by execution_costs_test.sql.
select (public.open_position(:'aapl'::uuid, 'LONG', 10, 100)).id::text as long_id
\gset
select public.assert_eq(
  (select cash_balance from public.portfolios),
  (select round(100000 - (quantity * entry_price) - open_fee, 2)
     from public.transactions where id = :'long_id'::uuid),
  'opening a long costs exactly its notional plus commission'
);

select public.close_position(:'long_id'::uuid, 120) is not null \g /dev/null
select public.assert_eq(
  (select cash_balance from public.portfolios),
  (select round(
            100000
            - open_fee - close_fee
            + quantity * (exit_price - entry_price), 2)
     from public.transactions where id = :'long_id'::uuid),
  'closing a long returns the move less both commissions'
);
do $$
begin
  if (select cash_balance from public.portfolios) <= 100000 then
    raise exception 'FAIL: a 20%% move should still clear its costs';
  end if;
  raise notice 'ok: a 20%% move nets a profit after costs';
end $$;

-- --------------------------------------------------------------------------
\echo '== short that wins =='
-- --------------------------------------------------------------------------
select (select cash_balance from public.portfolios) as before_short
\gset
select (public.open_position(:'aapl'::uuid, 'SHORT', 10, 100)).id::text as short_id
\gset
select public.assert_eq(
  (select cash_balance from public.portfolios),
  (select round(:before_short - (quantity * entry_price) - open_fee, 2)
     from public.transactions where id = :'short_id'::uuid),
  'opening a short reserves its notional and pays commission'
);

select public.close_position(:'short_id'::uuid, 80) is not null \g /dev/null
-- A 20% fall on a short is far larger than any plausible cost.
select public.assert_true(
  (select cash_balance from public.portfolios) > :before_short,
  'a short gains when price falls, net of costs'
);

-- --------------------------------------------------------------------------
\echo '== short that loses past its collateral =='
-- --------------------------------------------------------------------------
-- The reason migration 0002 drops the cash_balance >= 0 constraint: the close
-- must never be blocked, or the position is stranded forever.
-- A short closing far above its entry loses more than it reserved.
select (public.open_position(:'aapl'::uuid, 'SHORT', 10, 100)).id::text as bad_short
\gset
select public.close_position(:'bad_short'::uuid, 12000) is not null \g /dev/null
do $$
begin
  if (select cash_balance from public.portfolios) >= 0 then
    raise exception 'FAIL: that short should have driven the balance negative';
  end if;
  raise notice 'ok: a short can lose more than it reserved, and still settles';
end $$;
select public.assert_eq(
  (select count(*) from public.transactions where status = 'OPEN'), 0,
  'no position is left stranded'
);

-- Trading is blocked while the balance is negative.
do $$
begin
  perform public.open_position(
    (select id from public.assets where ticker = 'AAPL'), 'LONG', 1, 1
  );
  raise exception 'FAIL: opened a position on a negative balance';
exception when check_violation then
  raise notice 'ok: a negative balance blocks new positions';
end $$;

-- Back to solvent for the remaining checks.
reset role;
update public.portfolios set cash_balance = 100000 where user_id = :'alice'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', :'alice', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== rejected input =='
-- --------------------------------------------------------------------------
do $$
declare
  v_asset uuid := (select id from public.assets where ticker = 'AAPL');
  v_cases text[] := array['direction', 'quantity', 'price', 'funds', 'asset'];
  v_case text;
begin
  foreach v_case in array v_cases loop
    begin
      case v_case
        when 'direction' then perform public.open_position(v_asset, 'SIDEWAYS', 1, 10);
        when 'quantity'  then perform public.open_position(v_asset, 'LONG', 0, 10);
        when 'price'     then perform public.open_position(v_asset, 'LONG', 1, -1);
        when 'funds'     then perform public.open_position(v_asset, 'LONG', 1e9, 1000);
        when 'asset'     then perform public.open_position(gen_random_uuid(), 'LONG', 1, 10);
      end case;
      raise exception 'FAIL: % was accepted', v_case;
    exception
      when invalid_parameter_value or check_violation or foreign_key_violation then
        raise notice 'ok: % rejected', v_case;
    end;
  end loop;
end $$;

-- --------------------------------------------------------------------------
\echo '== a position settles exactly once =='
-- --------------------------------------------------------------------------
select (public.open_position(:'aapl'::uuid, 'LONG', 1, 100)).id::text as once_id
\gset
select public.close_position(:'once_id'::uuid, 150) is not null \g /dev/null

do $$
declare
  v_id uuid := (select id from public.transactions order by closed_at desc nulls last limit 1);
begin
  perform public.close_position(v_id, 150);
  raise exception 'FAIL: a closed position was settled twice';
exception when check_violation then
  raise notice 'ok: double settlement refused';
end $$;

-- --------------------------------------------------------------------------
\echo '== one account cannot touch another =='
-- --------------------------------------------------------------------------
select public.open_position(:'aapl'::uuid, 'LONG', 1, 100) is not null \g /dev/null

-- Bob cannot see Alice's trade through RLS and cannot read auth.users at all,
-- so the id is captured as the owner and handed over in a temp table. Knowing
-- the id is the point: the function must refuse on ownership, not obscurity.
reset role;
create temp table target_position as
  select t.id from public.transactions t
    join public.portfolios p on p.id = t.portfolio_id
   where p.user_id = :'alice'::uuid and t.status = 'OPEN'
   limit 1;
grant select on target_position to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false) \g /dev/null

do $$
declare
  v_id uuid := (select id from target_position);
begin
  perform public.close_position(v_id, 9999);
  raise exception 'FAIL: closed another account''s position';
exception when foreign_key_violation then
  raise notice 'ok: cross-account close refused';
end $$;

select public.assert_eq(
  (select cash_balance from public.portfolios), 100000.00,
  'the other account''s balance is untouched'
);

-- --------------------------------------------------------------------------
\echo '== the client has no direct write path =='
-- --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'alice', false) \g /dev/null

-- Minting money by editing the balance. The UPDATE is allowed to run; RLS
-- simply matches no rows, so nothing changes.
update public.portfolios set cash_balance = 9999999;
do $$
begin
  if exists (select 1 from public.portfolios where cash_balance = 9999999) then
    raise exception 'FAIL: a client edited its own balance';
  end if;
  raise notice 'ok: balance is not client-writable';
end $$;

-- Opening a position without paying for it.
do $$
begin
  insert into public.transactions
    (portfolio_id, asset_id, direction, quantity, entry_price)
  values (
    (select id from public.portfolios where user_id = auth.uid()),
    (select id from public.assets where ticker = 'AAPL'),
    'LONG', 1000, 1
  );
  raise exception 'FAIL: a client inserted a trade directly';
exception when insufficient_privilege then
  raise notice 'ok: trades are not client-insertable';
end $$;

-- Faking an exit price on settled history.
update public.transactions set exit_price = 99999 where status = 'CLOSED';
do $$
begin
  if exists (select 1 from public.transactions where exit_price = 99999) then
    raise exception 'FAIL: a client rewrote a settled trade';
  end if;
  raise notice 'ok: settled trades are not client-updatable';
end $$;

reset role;
drop function public.assert_eq(numeric, numeric, text);
drop function public.assert_true(boolean, text);
\echo '== all trading engine checks passed =='
