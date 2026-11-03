-- Streaks with freezes. A streak is consecutive local days on which a member
-- used something up (item_usage_events). Every 7 days in a row earns a
-- freeze (bank of 2); a missed day is covered automatically when the bank
-- holds enough freezes for the whole gap. Covered days keep the streak alive
-- but don't add to it. streak_state is the one place this is computed — the
-- app (sync_streak) and the evening streak push both read it.

alter table public.notification_preferences
  add column if not exists streak_reminders_enabled boolean not null default true;

create table public.streak_freezes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  -- The streak run it was earned in and the milestone (7, 14, …) that earned
  -- it, so one milestone pays out once.
  chain_start date not null,
  milestone integer not null,
  -- The local day it covered; null while banked.
  used_on date,
  created_at timestamptz not null default now(),
  unique (user_id, household_id, chain_start, milestone)
);

create index streak_freezes_user_household_idx
  on public.streak_freezes (user_id, household_id);

alter table public.streak_freezes enable row level security;

-- Read-only to the owner; every write goes through streak_state.
create policy "streak_freezes_select_own"
  on public.streak_freezes
  for select
  using (user_id = (select auth.uid()));

create or replace function public.streak_state(
  p_user uuid,
  p_household uuid,
  p_tz text,
  p_apply boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone p_tz)::date;
  v_used date[];
  v_frozen date[];
  v_bank integer;
  v_last date;
  v_gap integer;
  v_cursor date;
  v_start date;
  v_streak integer := 0;
  v_milestone integer;
  v_today_count integer;
begin
  -- Two app launches at once must not spend the same freeze twice.
  if p_apply then
    perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_household::text, 0));
  end if;

  select coalesce(array_agg(distinct (e.used_at at time zone p_tz)::date), '{}')
    into v_used
    from public.item_usage_events e
   where e.household_id = p_household
     and e.used_by = p_user
     and e.used_at >= now() - interval '400 days';

  select coalesce(array_agg(f.used_on), '{}')
    into v_frozen
    from public.streak_freezes f
   where f.user_id = p_user and f.household_id = p_household and f.used_on is not null;

  select count(*)
    into v_bank
    from public.streak_freezes f
   where f.user_id = p_user and f.household_id = p_household and f.used_on is null;

  -- Yesterday missed: cover every day since the last active one, but only if
  -- the bank covers the whole gap (a partial cover can't save the streak).
  if not ((v_today - 1) = any(v_used || v_frozen)) then
    select max(d) into v_last from unnest(v_used || v_frozen) d where d < v_today - 1;
    if v_last is not null then
      v_gap := (v_today - 1) - v_last;
      if v_gap <= v_bank then
        if p_apply then
          update public.streak_freezes f
             set used_on = v_last + picked.n::integer
            from (
              select b.id, row_number() over (order by b.created_at, b.id) as n
                from public.streak_freezes b
               where b.user_id = p_user and b.household_id = p_household and b.used_on is null
               order by b.created_at, b.id
               limit v_gap
            ) picked
           where f.id = picked.id;
        end if;
        select v_frozen || array_agg(v_last + g) into v_frozen from generate_series(1, v_gap) g;
        v_bank := v_bank - v_gap;
      end if;
    end if;
  end if;

  -- Today still empty doesn't break the streak until it ends.
  v_cursor := case when v_today = any(v_used) then v_today else v_today - 1 end;
  while v_cursor = any(v_used || v_frozen) loop
    if v_cursor = any(v_used) then
      v_streak := v_streak + 1;
    end if;
    v_start := v_cursor;
    v_cursor := v_cursor - 1;
  end loop;

  v_milestone := (v_streak / 7) * 7;
  if p_apply and v_milestone >= 7 and v_bank < 2 then
    insert into public.streak_freezes (user_id, household_id, chain_start, milestone)
    values (p_user, p_household, v_start, v_milestone)
    on conflict do nothing;
    if found then
      v_bank := v_bank + 1;
    end if;
  end if;

  select count(*)
    into v_today_count
    from public.item_usage_events e
   where e.household_id = p_household
     and e.used_by = p_user
     and e.used_at >= now() - interval '2 days'
     and (e.used_at at time zone p_tz)::date = v_today;

  return jsonb_build_object(
    'streak', v_streak,
    'freezes', v_bank,
    'today', v_today_count,
    'days', (
      select jsonb_agg(jsonb_build_object(
               'date', d::text,
               'state', case when d = any(v_used) then 'used'
                             when d = any(v_frozen) then 'frozen'
                             else 'none' end)
             order by d)
        from generate_series(0, 6) i, lateral (select v_today - 6 + i as d) x
    )
  );
end;
$$;

-- The app's entry point: the signed-in member's streak in their kitchen.
create or replace function public.sync_streak(p_household_id uuid, p_tz text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  return public.streak_state((select auth.uid()), p_household_id, p_tz, true);
end;
$$;

-- streak_state takes any user id: service role only (the push dispatcher).
revoke execute on function public.streak_state(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.streak_state(uuid, uuid, text, boolean) to service_role;
revoke execute on function public.sync_streak(uuid, text) from public, anon;
grant execute on function public.sync_streak(uuid, text) to authenticated;

-- The evening "streak at risk" push is logged as 'streak'.
alter table public.notification_sends drop constraint notification_sends_type_check;
alter table public.notification_sends
  add constraint notification_sends_type_check
  check (type in ('daily','recap','eatfirst','topup','reengagement','member_activity','streak'));
