-- SECURITY_REVIEW S1 / S2 / S3 / S4: privilege and policy hardening.
--
-- S1: profiles.tier and households.plan_tier were updatable by any user via
--     the generic self/member update policies — one UPDATE granted premium and
--     every server-side gate trusts is_premium(). Column-level grants now lock
--     both; the prototype "preview premium" flows through one named SECURITY
--     DEFINER function (set_preview_tier) that is the single kill switch to
--     revoke before real billing ships.
-- S2: accept_household_invite(move_existing_items) moved EVERY active item of
--     the user's current household — including other members' — into the new
--     household. Now moves only items the caller added.
-- S3: invite codes were 24 bits of entropy with an unthrottled lookup RPC.
--     Codes are now 64 bits (16 hex chars) and lookups are throttled per user.
-- S4: "for all member" policies let any member delete/rewrite other members'
--     recipes, scans, sessions, and cooked events (including ownership hijack
--     by overwriting generated_by). Writes are now owner-scoped; reads stay
--     household-wide. inventory_items stays member-writable by design (shared
--     fridge).

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- S1: column-level update grants
-- ---------------------------------------------------------------------------

revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  avatar_initials,
  language,
  default_servings,
  cooking_for_seed,
  shopping_style,
  primary_goal,
  avoidances,
  onboarding_completed_at,
  cooked_coachmark_seen_at,
  prototype_day
) on table public.profiles to authenticated;

revoke update on table public.households from authenticated;
grant update (
  name,
  default_servings,
  first_fill_completed_at
) on table public.households to authenticated;

-- Prototype-only premium preview. KILL SWITCH before launch:
--   revoke execute on function public.set_preview_tier(public.plan_tier) from authenticated;
-- (after which tier changes can only come from a service-role payment webhook).
create or replace function public.set_preview_tier(p_tier public.plan_tier)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set tier = p_tier
  where id = (select auth.uid());

  update public.households h
  set plan_tier = case when p_tier = 'household_premium' then 'household_premium'::public.plan_tier else 'free'::public.plan_tier end
  from public.profiles p
  where p.id = (select auth.uid())
    and h.id = p.active_household_id;
end;
$$;

grant execute on function public.set_preview_tier(public.plan_tier) to authenticated;

-- ---------------------------------------------------------------------------
-- S3: 64-bit invite codes + throttled lookup
-- ---------------------------------------------------------------------------

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  generated_code text;
begin
  loop
    generated_code := 'CHOMP-' || upper(encode(extensions.gen_random_bytes(8), 'hex'));
    exit when not exists (
      select 1 from public.household_invites hi where hi.code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

-- Lookup throttle bookkeeping. RLS on with no policies: clients cannot touch
-- it directly; only the SECURITY DEFINER lookup function writes here.
create table public.invite_lookup_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index invite_lookup_attempts_user_time_idx
  on public.invite_lookup_attempts (user_id, attempted_at desc);

alter table public.invite_lookup_attempts enable row level security;
revoke all on table public.invite_lookup_attempts from authenticated;

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
declare
  recent_attempts integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;

  select count(*) into recent_attempts
  from public.invite_lookup_attempts a
  where a.user_id = (select auth.uid())
    and a.attempted_at > now() - interval '1 hour';

  if recent_attempts >= 10 then
    raise exception 'Too many invite lookups. Try again later.';
  end if;

  insert into public.invite_lookup_attempts (user_id)
  values ((select auth.uid()));

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

-- Keep the throttle table small.
select cron.schedule(
  'cleanup-invite-lookup-attempts',
  '23 3 * * *',
  $$
    delete from public.invite_lookup_attempts
    where attempted_at < now() - interval '1 day'
  $$
);

-- ---------------------------------------------------------------------------
-- S2: invite acceptance moves only the caller's own items
-- ---------------------------------------------------------------------------

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
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
  ) then
    update public.profiles
    set active_household_id = invite.household_id
    where id = (select auth.uid());

    return invite.household_id;
  end if;

  select active_household_id
  into current_household_id
  from public.profiles
  where id = (select auth.uid());

  -- S2: only the caller's own items move — never housemates' shared inventory.
  if move_existing_items and current_household_id is not null then
    update public.inventory_items
    set
      household_id = invite.household_id,
      source = 'moved_from_household'
    where household_id = current_household_id
      and removed_at is null
      and added_by = (select auth.uid());
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, (select auth.uid()), 'member')
  on conflict (household_id, user_id) do update
  set
    status = 'active',
    removed_at = null,
    updated_at = now();

  update public.profiles
  set active_household_id = invite.household_id
  where id = (select auth.uid());

  if current_household_id is not null and current_household_id <> invite.household_id then
    update public.household_members
    set
      status = 'removed',
      removed_at = now()
    where household_id = current_household_id
      and user_id = (select auth.uid());

    if public.household_member_count(current_household_id) = 0 then
      update public.households
      set status = 'archived'
      where id = current_household_id;
    end if;
  end if;

  update public.household_invites
  set
    used_count = used_count + 1,
    accepted_by = (select auth.uid()),
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

-- ---------------------------------------------------------------------------
-- S4: ownership-scoped write policies (reads stay household-wide)
-- ---------------------------------------------------------------------------

drop policy "recipes_all_member" on public.recipes;
create policy "recipes_select_member"
  on public.recipes
  for select
  using ((select public.is_household_member(household_id)));
create policy "recipes_insert_own"
  on public.recipes
  for insert
  with check (
    (select public.is_household_member(household_id))
    and generated_by = (select auth.uid())
  );
create policy "recipes_update_own"
  on public.recipes
  for update
  using (generated_by = (select auth.uid()))
  with check (
    (select public.is_household_member(household_id))
    and generated_by = (select auth.uid())
  );
create policy "recipes_delete_own"
  on public.recipes
  for delete
  using (generated_by = (select auth.uid()));

drop policy "recipe_sessions_all_member" on public.recipe_sessions;
create policy "recipe_sessions_select_member"
  on public.recipe_sessions
  for select
  using ((select public.is_household_member(household_id)));
create policy "recipe_sessions_insert_own"
  on public.recipe_sessions
  for insert
  with check (
    (select public.is_household_member(household_id))
    and generated_by = (select auth.uid())
  );

drop policy "receipt_scans_all_member" on public.receipt_scans;
create policy "receipt_scans_select_member"
  on public.receipt_scans
  for select
  using ((select public.is_household_member(household_id)));
create policy "receipt_scans_insert_own"
  on public.receipt_scans
  for insert
  with check (
    (select public.is_household_member(household_id))
    and created_by = (select auth.uid())
  );
create policy "receipt_scans_update_own"
  on public.receipt_scans
  for update
  using (created_by = (select auth.uid()))
  with check (
    (select public.is_household_member(household_id))
    and created_by = (select auth.uid())
  );

drop policy "cooked_events_all_member" on public.cooked_events;
create policy "cooked_events_select_member"
  on public.cooked_events
  for select
  using ((select public.is_household_member(household_id)));
create policy "cooked_events_insert_own"
  on public.cooked_events
  for insert
  with check (
    (select public.is_household_member(household_id))
    and cooked_by = (select auth.uid())
  );
