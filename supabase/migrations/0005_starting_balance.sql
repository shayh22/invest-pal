-- invest-pal: let a new account choose how much it starts with.
--
-- Everyone began with $100,000, which is a poor teacher. On that balance the
-- $0.50 minimum commission is invisible; on $100 it is half a percent of the
-- account per fill. Letting someone start small is the most direct way to show
-- that fixed costs dominate a small account.
--
-- The chosen amount is also recorded, because a portfolio that does not
-- remember what it started with cannot tell you your return.
--
-- Safe to re-run.

alter table public.portfolios
  add column if not exists starting_balance numeric(18, 2) not null default 100000.00;

comment on column public.portfolios.starting_balance is
  'What the account was funded with. Fixed at signup; cash_balance moves.';

-- Portfolios created before this column all began at the old fixed amount.
update public.portfolios
   set starting_balance = 100000.00
 where starting_balance is null;

-- ---------------------------------------------------------------------------
-- The amounts on offer
-- ---------------------------------------------------------------------------

create or replace function public.starting_balance_options()
returns numeric[]
language sql
immutable
set search_path = ''
as $$ select array[100, 1000, 10000, 100000]::numeric[] $$;

comment on function public.starting_balance_options() is
  'Amounts a new account may be funded with, exposed so the signup form and '
  'the trigger cannot disagree about what is allowed.';

revoke all on function public.starting_balance_options() from public;
grant execute on function public.starting_balance_options() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Provisioning honours the choice, and distrusts it
-- ---------------------------------------------------------------------------

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
