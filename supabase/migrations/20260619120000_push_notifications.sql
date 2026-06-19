-- Push notifications: send-log for dedup + daily cap, plus supporting columns.

-- 1/user/day cap + per-type dedup + coalesce window all derive from this table.
create table public.notification_sends (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  type text not null check (type in ('daily','recap','topup','reengagement','member_activity')),
  sent_at timestamptz not null default now()
);

create index notification_sends_user_sent_idx
  on public.notification_sends (user_id, sent_at desc);
create index notification_sends_household_type_sent_idx
  on public.notification_sends (household_id, type, sent_at desc);

alter table public.notification_sends enable row level security;

-- Service role (edge fns) writes; users may read their own rows only.
create policy "notification_sends_select_self"
  on public.notification_sends
  for select
  using (user_id = auth.uid());

-- One household timezone drives the daily/recap send window comparison.
alter table public.household_notification_settings
  add column timezone text not null default 'UTC';

-- Powers the re-engagement rule.
alter table public.profiles
  add column last_active_at timestamptz;

-- Per-user mute for member-activity pushes.
alter table public.notification_preferences
  add column member_activity_enabled boolean not null default true;
