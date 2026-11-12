-- Plain-Postgres check that archiving a kitchen revokes its live invite codes.
-- Run against an EMPTY scratch database, never a Supabase project:
--   createdb archive_scratch && psql -d archive_scratch -v ON_ERROR_STOP=1 -f supabase/tests/revoke_invites_on_archive_test.sql

\set ON_ERROR_STOP 1
do $$ begin
  create role anon; create role authenticated;
exception when duplicate_object then null;
end $$;
create type public.household_status as enum ('active', 'archived');
create type public.invite_status as enum ('active', 'accepted', 'revoked', 'expired');
create table public.households (id int primary key, status public.household_status not null default 'active');
create table public.household_invites (
  id int primary key, household_id int references public.households(id),
  status public.invite_status not null default 'active', updated_at timestamptz);

insert into public.households values (1, 'active'), (2, 'active'), (3, 'archived');
insert into public.household_invites (id, household_id) values (10, 1), (20, 2), (30, 3);

\ir ../migrations/20261112210000_revoke_invites_on_archive.sql

do $$ begin
  -- Backfill: a kitchen archived before the migration loses its code.
  assert (select status from public.household_invites where id = 30) = 'revoked', 'backfill';

  update public.households set status = 'archived' where id = 1;
  assert (select status from public.household_invites where id = 10) = 'revoked', 'archive revokes';
  assert (select status from public.household_invites where id = 20) = 'active', 'other kitchen untouched';
end $$;
\echo PASS
