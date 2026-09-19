-- invest-pal: a list of what you are actually following.
--
-- There are 74 assets. Finding the three you care about means typing their
-- tickers into the picker every time, which is fine once and tiresome by the
-- fourth visit. Every trading app solves this the same way, and so does this
-- one: star an asset and it appears on the dashboard with its price.
--
-- The watchlist is a preference, not account state, so reset_portfolio() is
-- deliberately left alone. Starting over with the money should not make you
-- forget what you were following — those are different decisions, and the one
-- the button names is the money.
--
-- Safe to re-run.

create table if not exists public.watchlist (
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  asset_id     uuid not null references public.assets (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (portfolio_id, asset_id)
);

comment on table public.watchlist is
  'Assets an account follows. A preference, not part of the portfolio, so '
  'starting the account over does not clear it.';

alter table public.watchlist enable row level security;

drop policy if exists "watchlist is self-readable" on public.watchlist;
create policy "watchlist is self-readable"
  on public.watchlist for select
  using (
    exists (
      select 1 from public.portfolios p
       where p.id = watchlist.portfolio_id
         and p.user_id = auth.uid()
    )
  );

-- No write policy: adding and removing go through the function, which is where
-- the cap lives.

/*
 * Follow an asset, or stop.
 *
 * One idempotent call rather than an add and a remove: the UI has a single
 * toggle, and asking it to know which way round it currently is invites the
 * two to disagree. Returns whether the asset is followed afterwards.
 */
create or replace function public.set_watched(
  p_asset_id uuid,
  p_watched  boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_pf    uuid;
  v_count integer;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  select id into v_pf from public.portfolios where user_id = v_user;
  if not found then
    raise exception 'No portfolio for this account.' using errcode = '23503';
  end if;

  if not exists (select 1 from public.assets where id = p_asset_id) then
    raise exception 'Unknown asset.' using errcode = '23503';
  end if;

  if coalesce(p_watched, false) then
    -- Counted before the insert, and only when the row is not already there,
    -- so re-starring something already followed can never trip the cap.
    if not exists (
      select 1 from public.watchlist
       where portfolio_id = v_pf and asset_id = p_asset_id
    ) then
      select count(*) into v_count from public.watchlist where portfolio_id = v_pf;
      if v_count >= 50 then
        raise exception 'That is 50 assets already followed. Remove one first.'
          using errcode = '23514';
      end if;
    end if;

    insert into public.watchlist (portfolio_id, asset_id)
    values (v_pf, p_asset_id)
    on conflict (portfolio_id, asset_id) do nothing;

    return true;
  end if;

  delete from public.watchlist
   where portfolio_id = v_pf and asset_id = p_asset_id;

  return false;
end;
$$;

comment on function public.set_watched(uuid, boolean) is
  'Follow an asset or stop following it. Idempotent; returns the state after.';

revoke all on function public.set_watched(uuid, boolean) from public;
grant execute on function public.set_watched(uuid, boolean) to authenticated;
grant select on public.watchlist to authenticated;
