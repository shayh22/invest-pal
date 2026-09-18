-- Stand-in for the parts of Supabase the migrations depend on, so the schema
-- and the trading functions can be tested against a plain Postgres instance
-- (in CI, say) without the whole Supabase stack.
--
-- Only what the migrations actually touch: auth.users, auth.uid() and the
-- authenticated role.

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Supabase derives this from the request JWT; here it comes from a setting the
-- tests can change to impersonate a user.
create or replace function auth.uid() returns uuid
  language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
-- Supabase grants these by default; RLS is what actually restricts access.
alter default privileges in schema public
  grant all on tables to anon, authenticated;
