-- Tests for the watchlist (migration 0009).

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

delete from public.watchlist;
delete from public.pending_orders;
delete from public.transactions;
delete from public.portfolios;
delete from public.profiles;
delete from auth.users;

insert into auth.users (email) values ('watcher@test'), ('stranger@test');

select id::text as u from auth.users where email = 'watcher@test'
\gset
select id::text as other from auth.users where email = 'stranger@test'
\gset
select id::text as aapl from public.assets where ticker = 'AAPL'
\gset
select id::text as btc from public.assets where ticker = 'BTC-USD'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null

-- --------------------------------------------------------------------------
\echo '== following and unfollowing =='
-- --------------------------------------------------------------------------
select public.assert_eq((select count(*) from public.watchlist), 0, 'nothing followed yet');
select public.assert_true(public.set_watched(:'aapl'::uuid, true), 'following returns true');
select public.assert_eq((select count(*) from public.watchlist), 1, 'one asset followed');

-- The toggle is idempotent on purpose: the UI has one button and must never
-- have to know which way round it currently is.
select public.assert_true(public.set_watched(:'aapl'::uuid, true), 'following twice still returns true');
select public.assert_eq((select count(*) from public.watchlist), 1, 'and does not duplicate the row');

select public.assert_true(not public.set_watched(:'aapl'::uuid, false), 'unfollowing returns false');
select public.assert_eq((select count(*) from public.watchlist), 0, 'and removes it');
select public.assert_true(not public.set_watched(:'aapl'::uuid, false), 'unfollowing again is harmless');

-- --------------------------------------------------------------------------
\echo '== rejected input =='
-- --------------------------------------------------------------------------
do $$
begin
  perform public.set_watched(gen_random_uuid(), true);
  raise exception 'FAIL: followed an asset that does not exist';
exception when foreign_key_violation then
  raise notice 'ok: an unknown asset is refused';
end $$;

-- --------------------------------------------------------------------------
\echo '== the cap =='
-- --------------------------------------------------------------------------
do $$
declare
  a record;
  n integer := 0;
begin
  for a in select id from public.assets order by ticker loop
    exit when n >= 50;
    perform public.set_watched(a.id, true);
    n := n + 1;
  end loop;
end $$;
select public.assert_eq((select count(*) from public.watchlist), 50, 'fifty can be followed');

do $$
declare
  v_spare uuid := (select a.id from public.assets a
                    where not exists (select 1 from public.watchlist w where w.asset_id = a.id)
                    limit 1);
begin
  perform public.set_watched(v_spare, true);
  raise exception 'FAIL: followed a fifty-first asset';
exception when check_violation then
  raise notice 'ok: the fifty-first is refused';
end $$;

-- Re-starring one already followed must not trip the cap, which is the bug a
-- naive count-then-insert would have.
select public.assert_true(
  public.set_watched((select asset_id from public.watchlist limit 1), true),
  'but re-following something already followed still works at the cap'
);

-- --------------------------------------------------------------------------
\echo '== one account cannot see another list =='
-- --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'other', false) \g /dev/null
select public.assert_eq((select count(*) from public.watchlist), 0,
  'the other account sees an empty list'
);
select public.assert_true(public.set_watched(:'btc'::uuid, true), 'and can follow its own');
select public.assert_eq((select count(*) from public.watchlist), 1, 'seeing only that one');

select set_config('request.jwt.claim.sub', :'u', false) \g /dev/null
select public.assert_eq((select count(*) from public.watchlist), 50,
  'while the first account still sees its fifty'
);

-- --------------------------------------------------------------------------
\echo '== starting over keeps the list =='
-- --------------------------------------------------------------------------
-- The button says it clears the money, and that is all it should clear. What
-- you were following is a preference, not a position.
select public.reset_portfolio(1000) is not null \g /dev/null
select public.assert_eq((select count(*) from public.watchlist), 50,
  'reset leaves the watchlist alone'
);

-- The list is not client-writable.
reset role;
do $$
declare
  v_pf uuid := (select id from public.portfolios limit 1);
begin
  set local role authenticated;
  insert into public.watchlist (portfolio_id, asset_id)
  values (v_pf, (select id from public.assets limit 1));
  raise exception 'FAIL: a client inserted into the watchlist';
exception when insufficient_privilege then
  raise notice 'ok: the list is not client-writable';
end $$;

reset role;
drop function public.assert_eq(numeric, numeric, text);
drop function public.assert_true(boolean, text);

\echo '== all watchlist checks passed =='
