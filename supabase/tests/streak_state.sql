-- Plain-Postgres check for streak_state / sync_streak (20261103120000_streak_freezes).
-- Run against an EMPTY scratch database, never a Supabase project:
--   psql -d <scratch> -f supabase/tests/streak_state.sql
-- Stubs the bits of the Supabase schema the migration touches, applies it, then asserts.

do $$ begin
  create role anon; create role authenticated; create role service_role;
exception when duplicate_object then null;
end $$;
create schema extensions;
create function extensions.gen_random_uuid() returns uuid language sql as 'select pg_catalog.gen_random_uuid()';
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.profiles (id uuid primary key);
create table public.households (id uuid primary key);
create table public.household_members (household_id uuid, user_id uuid);
create function public.is_household_member(household_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members m where m.household_id = $1 and m.user_id = auth.uid()) $$;
create table public.item_usage_events (
  id uuid primary key default gen_random_uuid(), household_id uuid, normalized_name text default 'x',
  used_by uuid, used_at timestamptz not null default now());
create table public.notification_preferences (user_id uuid primary key);
create table public.notification_sends (id serial, type text);
alter table public.notification_sends add constraint notification_sends_type_check check (type in ('daily'));

\ir ../migrations/20261103120000_streak_freezes.sql

\set ON_ERROR_STOP 1
-- Users 1..5, one household. Dates are relative to "today" in UTC.
insert into public.households values ('00000000-0000-0000-0000-0000000000aa');
insert into public.profiles select ('00000000-0000-0000-0000-00000000000' || i)::uuid from generate_series(1,5) i;
insert into public.household_members select '00000000-0000-0000-0000-0000000000aa', ('00000000-0000-0000-0000-00000000000' || i)::uuid from generate_series(1,4) i;

create function pg_temp.use(u int, days_ago int, n int default 1) returns void language sql as $$
  insert into public.item_usage_events (household_id, used_by, used_at)
  select '00000000-0000-0000-0000-0000000000aa', ('00000000-0000-0000-0000-00000000000' || u)::uuid,
         (date_trunc('day', now() at time zone 'UTC') - make_interval(days => days_ago) + interval '12 hours') at time zone 'UTC'
  from generate_series(1, n) $$;
create function pg_temp.st(u int) returns jsonb language sql as $$
  select public.streak_state(('00000000-0000-0000-0000-00000000000' || u)::uuid, '00000000-0000-0000-0000-0000000000aa', 'UTC', true) $$;
create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin if not ok then raise exception 'FAIL: %', label; end if; raise notice 'ok: %', label; end $$;

-- U1: 7 days in a row ending today → streak 7, earns exactly one freeze.
select pg_temp.use(1, d) from generate_series(0, 6) d;
select pg_temp.check('U1 streak 7', (pg_temp.st(1)->>'streak')::int = 7);
select pg_temp.check('U1 earned 1 freeze', (pg_temp.st(1)->>'freezes')::int = 1);
select pg_temp.check('U1 no double earn', (select count(*) from public.streak_freezes where user_id = '00000000-0000-0000-0000-000000000001') = 1);
select pg_temp.check('U1 week all used', (select bool_and(x->>'state' = 'used') from jsonb_array_elements(pg_temp.st(1)->'days') x));

-- U2: 7 days ending the day before yesterday, freeze already earned for that run → yesterday covered.
select pg_temp.use(2, d) from generate_series(2, 8) d;
insert into public.streak_freezes (user_id, household_id, chain_start, milestone)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', (now() at time zone 'UTC')::date - 8, 7);
select pg_temp.check('U2 streak survives at 7', (pg_temp.st(2)->>'streak')::int = 7);
select pg_temp.check('U2 freeze spent', (pg_temp.st(2)->>'freezes')::int = 0);
select pg_temp.check('U2 yesterday frozen', (pg_temp.st(2)->'days'->5->>'state') = 'frozen');
select pg_temp.check('U2 spent once', (select count(*) from public.streak_freezes where user_id = '00000000-0000-0000-0000-000000000002' and used_on is not null) = 1);
-- Using something today grows it to 8 and doesn't re-earn milestone 7.
select pg_temp.use(2, 0);
select pg_temp.check('U2 streak 8 after today', (pg_temp.st(2)->>'streak')::int = 8);
select pg_temp.check('U2 still 0 freezes', (pg_temp.st(2)->>'freezes')::int = 0);

-- U3: two missed days, only one freeze → streak breaks, freeze kept.
select pg_temp.use(3, d) from generate_series(3, 5) d;
insert into public.streak_freezes (user_id, household_id, chain_start, milestone)
values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', '2026-01-01', 7);
select pg_temp.check('U3 streak 0', (pg_temp.st(3)->>'streak')::int = 0);
select pg_temp.check('U3 freeze kept', (pg_temp.st(3)->>'freezes')::int = 1);

-- U4: two items today, nothing before → streak 1, today 2; dry run writes nothing.
select pg_temp.use(4, 0, 2);
select pg_temp.check('U4 today 2', (pg_temp.st(4)->>'today')::int = 2);
select pg_temp.check('U4 streak 1', (pg_temp.st(4)->>'streak')::int = 1);
select pg_temp.check('U4 yesterday empty keeps streak', (public.streak_state('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'UTC', false)->>'streak')::int = 7);

-- Bank cap: 14 days in a row with 2 freezes banked earns nothing more.
select pg_temp.use(5, d) from generate_series(0, 13) d;
insert into public.streak_freezes (user_id, household_id, chain_start, milestone)
select '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000aa', '2026-01-01', m from unnest(array[7, 14]) m;
select pg_temp.check('U5 capped at 2', (pg_temp.st(5)->>'freezes')::int = 2);

-- sync_streak: members only.
set test.uid = '00000000-0000-0000-0000-000000000001';
select pg_temp.check('member sync ok', (public.sync_streak('00000000-0000-0000-0000-0000000000aa', 'UTC')->>'streak')::int = 7);
set test.uid = '00000000-0000-0000-0000-000000000005';
do $$ begin
  perform public.sync_streak('00000000-0000-0000-0000-0000000000aa', 'UTC');
  raise exception 'FAIL: non-member allowed';
exception when insufficient_privilege then raise notice 'ok: non-member refused';
end $$;

-- Grants.
select pg_temp.check('authenticated cannot call streak_state', not has_function_privilege('authenticated', 'public.streak_state(uuid, uuid, text, boolean)', 'execute'));
select pg_temp.check('authenticated can sync', has_function_privilege('authenticated', 'public.sync_streak(uuid, text)', 'execute'));
insert into public.notification_sends (type) values ('streak');
select pg_temp.check('streak send type allowed', true);
