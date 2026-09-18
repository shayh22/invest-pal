-- Tests for the chosen starting balance (migration 0005).
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

-- --------------------------------------------------------------------------
\echo '== each offered amount funds the account =='
-- --------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('small@test',  '{"starting_balance":"100"}'),
  ('medium@test', '{"starting_balance":"1000"}'),
  ('large@test',  '{"starting_balance":"10000"}'),
  ('huge@test',   '{"starting_balance":"100000"}');

select public.assert_eq(
  (select cash_balance from public.portfolios p
     join auth.users u on u.id = p.user_id where u.email = 'small@test'),
  100.00, 'a 100 account is funded with 100'
);
select public.assert_eq(
  (select cash_balance from public.portfolios p
     join auth.users u on u.id = p.user_id where u.email = 'medium@test'),
  1000.00, 'a 1,000 account is funded with 1,000'
);
select public.assert_eq(
  (select cash_balance from public.portfolios p
     join auth.users u on u.id = p.user_id where u.email = 'large@test'),
  10000.00, 'a 10,000 account is funded with 10,000'
);

-- --------------------------------------------------------------------------
\echo '== the amount is remembered, not just spent =='
-- --------------------------------------------------------------------------
select public.assert_eq(
  (select starting_balance from public.portfolios p
     join auth.users u on u.id = p.user_id where u.email = 'medium@test'),
  1000.00, 'starting_balance records what the account began with'
);

-- --------------------------------------------------------------------------
\echo '== omitting the choice still gets the default =='
-- --------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values ('default@test', '{}');
select public.assert_eq(
  (select cash_balance from public.portfolios p
     join auth.users u on u.id = p.user_id where u.email = 'default@test'),
  100000.00, 'no choice means the default 100,000'
);

-- --------------------------------------------------------------------------
\echo '== a value nobody offered is refused, not honoured =='
-- --------------------------------------------------------------------------
-- Signup metadata is whatever the caller posts. An account must not be able to
-- fund itself with an arbitrary number.
insert into auth.users (email, raw_user_meta_data) values
  ('greedy@test',  '{"starting_balance":"999999999"}'),
  ('sneaky@test',  '{"starting_balance":"100.01"}'),
  ('negative@test','{"starting_balance":"-5000"}'),
  ('junk@test',    '{"starting_balance":"; drop table portfolios"}'),
  ('empty@test',   '{"starting_balance":""}');

select public.assert_eq(
  (select count(*) from public.portfolios p
     join auth.users u on u.id = p.user_id
    where u.email in ('greedy@test','sneaky@test','negative@test','junk@test','empty@test')
      and p.cash_balance = 100000.00),
  5, 'every unoffered amount falls back to the default'
);

-- The junk value must not have executed as anything.
select public.assert_eq(
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'portfolios'),
  1, 'the portfolios table is still there'
);

-- --------------------------------------------------------------------------
\echo '== the offered set is the single source of truth =='
-- --------------------------------------------------------------------------
select public.assert_eq(
  array_length(public.starting_balance_options(), 1), 4,
  'four amounts are offered'
);
select public.assert_eq(
  (select count(*) from unnest(public.starting_balance_options()) o
    where o = any (array[100, 1000, 10000, 100000]::numeric[])),
  4, 'the offered amounts are the expected ones'
);

-- --------------------------------------------------------------------------
\echo '== a small account really is eaten by fixed costs =='
-- --------------------------------------------------------------------------
-- The reason this feature exists: on $100 the minimum commission is half a
-- percent of the account per fill, and a round trip costs over 1%.
select id::text as small_u from auth.users where email = 'small@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'small_u', false) \g /dev/null

select (public.open_position(:'aapl'::uuid, 'LONG', 1, 50)).id::text as tiny
\gset
select public.close_position(:'tiny'::uuid, 50) is not null \g /dev/null

do $$
declare
  v_start numeric := 100.00;
  v_end   numeric := (select cash_balance from public.portfolios);
  v_pct   numeric := round((v_start - v_end) / v_start * 100, 2);
begin
  if v_end >= v_start then
    raise exception 'FAIL: a flat round trip should have cost this account money';
  end if;
  raise notice 'ok: a flat round trip cost a $100 account %%% of its value', v_pct;
end $$;

reset role;
drop function public.assert_eq(numeric, numeric, text);
\echo '== all starting balance checks passed =='
