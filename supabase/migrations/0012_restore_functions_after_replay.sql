-- 0012: put back three functions a deploy replayed over.
--
-- Safe to re-run: each statement is `create or replace` of a function with an
-- unchanged signature, and on a database that is already correct it restates
-- what is there.
--
-- What happened. The deploy workflow's first run through the Management API
-- replayed every migration from 0001, on the assumption that each one was
-- safe to re-run. Each is, on the schema it was written for — not on every
-- schema after it. The run applied 0001, 0002 and 0003 on top of a database
-- already at 0011, then stopped at 0004. In those three files:
--
--   0001 handle_new_user()   went back to before 0005's starting balance
--   0002 open_position()     went back to before execution costs (0004)
--   0002 close_position()      and netting (0006)
--
-- Same names, same signatures, so each replay replaced the newer function
-- rather than adding an overload beside it. Grants were identical in both
-- versions and are unaffected. Nothing else in 0001-0003 is redefined by a
-- later migration, so nothing else regressed.
--
-- The production sanity check caught it — fills with no commission, closes
-- with no mid price — and the workflow now applies only migrations it has
-- not recorded, so it cannot happen again the same way.
--
-- Each definition below is copied verbatim from the latest migration that
-- defines it: 0006 for the two trading functions, 0005 for the signup
-- trigger function.

-- From 0006_netting_and_reset.sql.
create or replace function public.open_position(
  p_asset_id  uuid,
  p_direction text,
  p_quantity  numeric,
  p_price     numeric
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_direction is null or p_direction not in ('LONG', 'SHORT') then
    raise exception 'Direction must be LONG or SHORT.' using errcode = '22023';
  end if;

  -- Opening a LONG is buying and opening a SHORT is selling. If the asset is
  -- already held, this adds to that holding rather than opening a second one.
  return public.trade(
    p_asset_id,
    case p_direction when 'LONG' then 'BUY' else 'SELL' end,
    p_quantity,
    p_price
  );
end;
$$;

-- From 0006_netting_and_reset.sql.
create or replace function public.close_position(
  p_transaction_id uuid,
  p_price          numeric
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_txn  public.transactions;
begin
  if v_user is null then
    raise exception 'You must be signed in to trade.' using errcode = '28000';
  end if;

  -- Joined to the owner's portfolio, so a stranger probing ids gets the same
  -- message as someone naming one that does not exist.
  select t.* into v_txn
    from public.transactions t
    join public.portfolios p on p.id = t.portfolio_id
   where t.id = p_transaction_id
     and p.user_id = v_user;

  if not found then
    raise exception 'Position not found.' using errcode = '23503';
  end if;

  if v_txn.status <> 'OPEN' then
    raise exception 'That position is already closed.' using errcode = '23514';
  end if;

  -- Reduce-only: this read is not under the portfolio lock, so a second close
  -- arriving at the same moment must be refused inside trade() rather than
  -- here, where it would still look open.
  return public.trade(
    v_txn.asset_id,
    case v_txn.direction when 'LONG' then 'SELL' else 'BUY' end,
    v_txn.quantity,
    p_price,
    true
  );
end;
$$;

-- From 0005_starting_balance.sql.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_level   text;
  requested_balance numeric;
  v_balance         numeric(18, 2);
begin
  -- Signup metadata is user-supplied, so fall back rather than trip the
  -- profiles check constraint and fail the whole signup.
  requested_level := nullif(new.raw_user_meta_data ->> 'experience_level', '');
  if requested_level is null
     or requested_level not in ('beginner', 'intermediate', 'advanced') then
    requested_level := 'beginner';
  end if;

  -- Same distrust for the amount: anyone can post whatever they like to the
  -- signup endpoint, so an unknown value quietly becomes the default rather
  -- than funding an account with a number nobody offered.
  begin
    requested_balance :=
      nullif(new.raw_user_meta_data ->> 'starting_balance', '')::numeric;
  exception when others then
    requested_balance := null;
  end;

  if requested_balance is null
     or not (requested_balance = any (public.starting_balance_options())) then
    v_balance := 100000.00;
  else
    v_balance := requested_balance;
  end if;

  insert into public.profiles (id, email, display_name, experience_level)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    requested_level
  )
  on conflict (id) do nothing;

  insert into public.portfolios (user_id, cash_balance, starting_balance)
  values (new.id, v_balance, v_balance)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
