set check_function_bodies = off;

create extension if not exists pgcrypto with schema extensions;

create type public.household_status as enum ('active', 'archived');
create type public.household_role as enum ('owner', 'member');
create type public.member_status as enum ('active', 'removed');
create type public.invite_status as enum ('active', 'accepted', 'revoked', 'expired');
create type public.plan_tier as enum ('free', 'premium', 'household_premium');
create type public.inventory_category as enum (
  'dairy_eggs',
  'meat',
  'fish',
  'vegetables',
  'fruit',
  'bakery',
  'pantry',
  'frozen',
  'drinks',
  'snacks',
  'other'
);
create type public.inventory_source as enum ('receipt', 'barcode', 'manual', 'moved_from_household');
create type public.partial_state as enum ('full', 'some_used', 'low');
create type public.urgency_band as enum ('safe', 'use_soon', 'urgent');
create type public.receipt_scan_status as enum (
  'processing',
  'completed',
  'failed',
  'duplicate_cancelled'
);
create type public.review_item_status as enum ('pending', 'accepted', 'rejected', 'edited');
create type public.recipe_cooking_mode as enum ('household', 'just_me');
create type public.notification_permission_status as enum (
  'not_determined',
  'granted',
  'denied',
  'provisional'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_initials text,
  language text not null default 'en',
  default_servings integer not null default 1 check (default_servings between 1 and 12),
  cooking_for_seed text,
  shopping_style text,
  primary_goal text,
  avoidances text[] not null default '{}',
  tier public.plan_tier not null default 'free',
  active_household_id uuid,
  onboarding_completed_at timestamptz,
  cooked_coachmark_seen_at timestamptz,
  prototype_day integer not null default 1 check (prototype_day between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  status public.household_status not null default 'active',
  plan_tier public.plan_tier not null default 'free',
  default_servings integer not null default 1 check (default_servings between 1 and 12),
  first_fill_completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_active_household_id_fkey
  foreign key (active_household_id)
  references public.households(id)
  on delete set null;

create table public.household_members (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null default 'member',
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table public.household_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique,
  status public.invite_status not null default 'active',
  max_uses integer not null default 2 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  created_by uuid not null references public.profiles(id) on delete cascade,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receipt_scans (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status public.receipt_scan_status not null default 'processing',
  receipt_signature text,
  template_key text,
  item_count integer not null default 0 check (item_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  duplicate_of uuid references public.receipt_scans(id) on delete set null,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  category public.inventory_category not null default 'other',
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit text not null default 'item',
  display_quantity text,
  partial_state public.partial_state not null default 'full',
  urgency public.urgency_band,
  shelf_life_range text,
  source public.inventory_source not null,
  source_scan_id uuid references public.receipt_scans(id) on delete set null,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  added_by uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  removal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receipt_review_items (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  scan_id uuid not null references public.receipt_scans(id) on delete cascade,
  proposed_name text not null,
  normalized_name text,
  proposed_category public.inventory_category not null default 'other',
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status public.review_item_status not null default 'pending',
  resolved_name text,
  resolved_category public.inventory_category,
  resolved_inventory_item_id uuid references public.inventory_items(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  generated_by uuid not null references public.profiles(id) on delete cascade,
  cooking_mode public.recipe_cooking_mode not null default 'household',
  avoidances_used text[] not null default '{}',
  fridge_snapshot jsonb not null default '[]'::jsonb,
  is_premium_optimized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  session_id uuid references public.recipe_sessions(id) on delete cascade,
  title text not null,
  description text,
  time_minutes integer check (time_minutes is null or time_minutes > 0),
  complexity text,
  servings integer not null default 1 check (servings between 1 and 12),
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  used_inventory_item_ids uuid[] not null default '{}',
  tags text[] not null default '{}',
  avoidance_tags text[] not null default '{}',
  is_favorite boolean not null default false,
  generated_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cooked_events (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  cooked_by uuid not null references public.profiles(id) on delete cascade,
  servings integer check (servings is null or servings between 1 and 12),
  used_items jsonb not null default '[]'::jsonb,
  removed_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  permission_status public.notification_permission_status not null default 'not_determined',
  smart_suggestions_enabled boolean not null default false,
  push_token text,
  platform text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.household_notification_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade unique,
  daily_suggestion_enabled boolean not null default false,
  send_window_start time not null default '13:00',
  send_window_end time not null default '14:00',
  last_suggestion_at timestamptz,
  last_suggestion_payload jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index household_members_user_active_idx
  on public.household_members (user_id, status);
create index household_members_household_active_idx
  on public.household_members (household_id, status);
create index household_invites_code_idx
  on public.household_invites (code)
  where status = 'active';
create index receipt_scans_household_created_idx
  on public.receipt_scans (household_id, created_at desc);
create index receipt_scans_signature_idx
  on public.receipt_scans (household_id, receipt_signature)
  where receipt_signature is not null;
create index inventory_items_household_active_idx
  on public.inventory_items (household_id, removed_at, category);
create index receipt_review_items_pending_idx
  on public.receipt_review_items (household_id, status)
  where status = 'pending';
create index recipe_sessions_household_created_idx
  on public.recipe_sessions (household_id, created_at desc);
create index recipes_household_created_idx
  on public.recipes (household_id, created_at desc);
create index cooked_events_household_created_idx
  on public.cooked_events (household_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();
create trigger set_household_members_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();
create trigger set_household_invites_updated_at
  before update on public.household_invites
  for each row execute function public.set_updated_at();
create trigger set_receipt_scans_updated_at
  before update on public.receipt_scans
  for each row execute function public.set_updated_at();
create trigger set_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();
create trigger set_receipt_review_items_updated_at
  before update on public.receipt_review_items
  for each row execute function public.set_updated_at();
create trigger set_recipe_sessions_updated_at
  before update on public.recipe_sessions
  for each row execute function public.set_updated_at();
create trigger set_recipes_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();
create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();
create trigger set_household_notification_settings_updated_at
  before update on public.household_notification_settings
  for each row execute function public.set_updated_at();

create or replace function public.make_avatar_initials(display_name text)
returns text
language sql
immutable
as $$
  select upper(
    left(split_part(trim(coalesce(display_name, '')), ' ', 1), 1) ||
    case
      when array_length(regexp_split_to_array(trim(coalesce(display_name, '')), '\s+'), 1) > 1
      then left((regexp_split_to_array(trim(coalesce(display_name, '')), '\s+'))[2], 1)
      else ''
    end
  );
$$;

create or replace function public.is_household_member(household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = is_household_member.household_id
      and hm.user_id = auth.uid()
      and hm.status = 'active'
  );
$$;

create or replace function public.is_household_owner(household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = is_household_owner.household_id
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
      and hm.status = 'active'
  );
$$;

create or replace function public.household_member_count(household_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.household_members hm
  where hm.household_id = household_member_count.household_id
    and hm.status = 'active';
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  generated_code text;
begin
  loop
    generated_code := 'CHOMP-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.household_invites hi where hi.code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  household_id uuid;
begin
  display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  if display_name is null then
    display_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, display_name, avatar_initials)
  values (new.id, display_name, public.make_avatar_initials(display_name));

  insert into public.households (name, created_by)
  values (display_name || '''s fridge', new.id)
  returning id into household_id;

  insert into public.household_members (household_id, user_id, role)
  values (household_id, new.id, 'owner');

  update public.profiles
  set active_household_id = household_id
  where id = new.id;

  insert into public.notification_preferences (user_id)
  values (new.id);

  insert into public.household_notification_settings (household_id)
  values (household_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_household_invite(target_household_id uuid)
returns public.household_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.household_invites;
begin
  if not public.is_household_member(target_household_id) then
    raise exception 'Not a member of this household';
  end if;

  insert into public.household_invites (household_id, code, created_by)
  values (target_household_id, public.generate_invite_code(), auth.uid())
  returning * into invite;

  return invite;
end;
$$;

create or replace function public.lookup_household_invite(p_invite_code text)
returns table (
  invite_code text,
  household_id uuid,
  household_name text,
  member_count integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    hi.code,
    h.id,
    h.name,
    public.household_member_count(h.id),
    hi.expires_at
  from public.household_invites hi
  join public.households h on h.id = hi.household_id
  where hi.code = upper(trim(p_invite_code))
    and hi.status = 'active'
    and hi.expires_at > now()
    and h.status = 'active';
end;
$$;

create or replace function public.accept_household_invite(invite_code text, move_existing_items boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.household_invites;
  current_household_id uuid;
  new_household_id uuid;
begin
  select *
  into invite
  from public.household_invites hi
  where hi.code = upper(trim(invite_code))
    and hi.status = 'active'
    and hi.expires_at > now()
  for update;

  if invite.id is null then
    raise exception 'Invite code is invalid or expired';
  end if;

  if public.household_member_count(invite.household_id) >= 3 then
    raise exception 'Household member limit reached';
  end if;

  if exists (
    select 1
    from public.household_members hm
    where hm.household_id = invite.household_id
      and hm.user_id = auth.uid()
      and hm.status = 'active'
  ) then
    update public.profiles
    set active_household_id = invite.household_id
    where id = auth.uid();

    return invite.household_id;
  end if;

  select active_household_id
  into current_household_id
  from public.profiles
  where id = auth.uid();

  if move_existing_items and current_household_id is not null then
    update public.inventory_items
    set
      household_id = invite.household_id,
      source = 'moved_from_household'
    where household_id = current_household_id
      and removed_at is null;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do update
  set
    status = 'active',
    removed_at = null,
    updated_at = now();

  update public.profiles
  set active_household_id = invite.household_id
  where id = auth.uid();

  if current_household_id is not null and current_household_id <> invite.household_id then
    update public.household_members
    set
      status = 'removed',
      removed_at = now()
    where household_id = current_household_id
      and user_id = auth.uid();

    if public.household_member_count(current_household_id) = 0 then
      update public.households
      set status = 'archived'
      where id = current_household_id;
    end if;
  end if;

  update public.household_invites
  set
    used_count = used_count + 1,
    accepted_by = auth.uid(),
    accepted_at = now(),
    status = case
      when used_count + 1 >= max_uses then 'accepted'::public.invite_status
      else status
    end
  where id = invite.id;

  new_household_id := invite.household_id;
  return new_household_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.receipt_scans enable row level security;
alter table public.inventory_items enable row level security;
alter table public.receipt_review_items enable row level security;
alter table public.recipe_sessions enable row level security;
alter table public.recipes enable row level security;
alter table public.cooked_events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.household_notification_settings enable row level security;

create policy "profiles_select_household_members"
  on public.profiles
  for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members self
      join public.household_members other
        on other.household_id = self.household_id
      where self.user_id = auth.uid()
        and self.status = 'active'
        and other.user_id = profiles.id
        and other.status = 'active'
    )
  );

create policy "profiles_update_self"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "households_select_member"
  on public.households
  for select
  using (public.is_household_member(id));

create policy "households_insert_self"
  on public.households
  for insert
  with check (created_by = auth.uid());

create policy "households_update_member"
  on public.households
  for update
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

create policy "household_members_select_member"
  on public.household_members
  for select
  using (public.is_household_member(household_id));

create policy "household_members_update_owner"
  on public.household_members
  for update
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

create policy "household_invites_select_member"
  on public.household_invites
  for select
  using (public.is_household_member(household_id));

create policy "household_invites_insert_member"
  on public.household_invites
  for insert
  with check (public.is_household_member(household_id) and created_by = auth.uid());

create policy "household_invites_update_member"
  on public.household_invites
  for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "receipt_scans_all_member"
  on public.receipt_scans
  for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and created_by = auth.uid());

create policy "inventory_items_all_member"
  on public.inventory_items
  for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "receipt_review_items_all_member"
  on public.receipt_review_items
  for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "recipe_sessions_all_member"
  on public.recipe_sessions
  for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and generated_by = auth.uid());

create policy "recipes_all_member"
  on public.recipes
  for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and generated_by = auth.uid());

create policy "cooked_events_all_member"
  on public.cooked_events
  for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and cooked_by = auth.uid());

create policy "notification_preferences_select_self"
  on public.notification_preferences
  for select
  using (user_id = auth.uid());

create policy "notification_preferences_update_self"
  on public.notification_preferences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notification_preferences_insert_self"
  on public.notification_preferences
  for insert
  with check (user_id = auth.uid());

create policy "household_notification_settings_all_member"
  on public.household_notification_settings
  for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.lookup_household_invite(text) to authenticated;
grant execute on function public.accept_household_invite(text, boolean) to authenticated;
