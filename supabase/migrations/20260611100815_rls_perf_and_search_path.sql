-- DATABASE_REVIEW D1/D2/D3/D6: RLS performance + function search_path hardening.
--
-- D1: bare auth.uid() in a policy is re-evaluated per row; (select auth.uid())
--     is evaluated once per statement (initplan). Flagged 14x by the Supabase
--     linter (auth_rls_initplan).
-- D2: same applies to the is_household_member()/is_household_owner()/is_premium()
--     helpers — wrapping them in a scalar subquery caches the result per statement.
-- D3: profiles_select_household_members ran a correlated self-join per profile
--     row; rewritten as hashed IN-subqueries with identical semantics
--     (own row, or shares an active household with the caller).
-- D6: pin search_path on the three non-SECURITY DEFINER functions flagged by
--     the function_search_path_mutable linter.
--
-- No behavior change intended: every policy keeps its original USING/WITH CHECK
-- semantics, only the evaluation strategy changes.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- D6: pin search_path (all object references inside are already schema-qualified)
-- ---------------------------------------------------------------------------

alter function public.set_updated_at() set search_path = '';
alter function public.make_avatar_initials(text) set search_path = '';
alter function public.generate_invite_code() set search_path = '';

-- ---------------------------------------------------------------------------
-- D1/D2: helper functions evaluate auth.uid() once
-- ---------------------------------------------------------------------------

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
      and hm.user_id = (select auth.uid())
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
      and hm.user_id = (select auth.uid())
      and hm.role = 'owner'
      and hm.status = 'active'
  );
$$;

create or replace function public.is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.tier in ('premium', 'household_premium')
        or exists (
          select 1
          from public.households h
          where h.id = p.active_household_id
            and h.plan_tier = 'household_premium'
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- D3: profiles select policy — hashed subqueries instead of per-row self-join
-- ---------------------------------------------------------------------------

drop policy "profiles_select_household_members" on public.profiles;
create policy "profiles_select_household_members"
  on public.profiles
  for select
  using (
    id = (select auth.uid())
    or id in (
      select other.user_id
      from public.household_members other
      where other.status = 'active'
        and other.household_id in (
          select self.household_id
          from public.household_members self
          where self.user_id = (select auth.uid())
            and self.status = 'active'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- D1/D2: remaining policies — wrap auth.uid() and helper calls in initplans
-- ---------------------------------------------------------------------------

drop policy "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy "households_select_member" on public.households;
create policy "households_select_member"
  on public.households
  for select
  using ((select public.is_household_member(id)));

drop policy "households_insert_self" on public.households;
create policy "households_insert_self"
  on public.households
  for insert
  with check (created_by = (select auth.uid()));

drop policy "households_update_member" on public.households;
create policy "households_update_member"
  on public.households
  for update
  using ((select public.is_household_member(id)))
  with check ((select public.is_household_member(id)));

drop policy "household_members_select_member" on public.household_members;
create policy "household_members_select_member"
  on public.household_members
  for select
  using ((select public.is_household_member(household_id)));

drop policy "household_members_update_owner" on public.household_members;
create policy "household_members_update_owner"
  on public.household_members
  for update
  using ((select public.is_household_owner(household_id)))
  with check ((select public.is_household_owner(household_id)));

drop policy "household_invites_select_member" on public.household_invites;
create policy "household_invites_select_member"
  on public.household_invites
  for select
  using ((select public.is_household_member(household_id)));

drop policy "household_invites_insert_member" on public.household_invites;
create policy "household_invites_insert_member"
  on public.household_invites
  for insert
  with check (
    (select public.is_household_member(household_id))
    and created_by = (select auth.uid())
  );

drop policy "household_invites_update_member" on public.household_invites;
create policy "household_invites_update_member"
  on public.household_invites
  for update
  using ((select public.is_household_member(household_id)))
  with check ((select public.is_household_member(household_id)));

drop policy "receipt_scans_all_member" on public.receipt_scans;
create policy "receipt_scans_all_member"
  on public.receipt_scans
  for all
  using ((select public.is_household_member(household_id)))
  with check (
    (select public.is_household_member(household_id))
    and created_by = (select auth.uid())
  );

drop policy "inventory_items_all_member" on public.inventory_items;
create policy "inventory_items_all_member"
  on public.inventory_items
  for all
  using ((select public.is_household_member(household_id)))
  with check ((select public.is_household_member(household_id)));

drop policy "receipt_review_items_all_member" on public.receipt_review_items;
create policy "receipt_review_items_all_member"
  on public.receipt_review_items
  for all
  using ((select public.is_household_member(household_id)))
  with check ((select public.is_household_member(household_id)));

drop policy "recipe_sessions_all_member" on public.recipe_sessions;
create policy "recipe_sessions_all_member"
  on public.recipe_sessions
  for all
  using ((select public.is_household_member(household_id)))
  with check (
    (select public.is_household_member(household_id))
    and generated_by = (select auth.uid())
  );

drop policy "recipes_all_member" on public.recipes;
create policy "recipes_all_member"
  on public.recipes
  for all
  using ((select public.is_household_member(household_id)))
  with check (
    (select public.is_household_member(household_id))
    and generated_by = (select auth.uid())
  );

drop policy "cooked_events_all_member" on public.cooked_events;
create policy "cooked_events_all_member"
  on public.cooked_events
  for all
  using ((select public.is_household_member(household_id)))
  with check (
    (select public.is_household_member(household_id))
    and cooked_by = (select auth.uid())
  );

drop policy "notification_preferences_select_self" on public.notification_preferences;
create policy "notification_preferences_select_self"
  on public.notification_preferences
  for select
  using (user_id = (select auth.uid()));

drop policy "notification_preferences_update_self" on public.notification_preferences;
create policy "notification_preferences_update_self"
  on public.notification_preferences
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy "notification_preferences_insert_self" on public.notification_preferences;
create policy "notification_preferences_insert_self"
  on public.notification_preferences
  for insert
  with check (user_id = (select auth.uid()));

drop policy "household_notification_settings_all_member" on public.household_notification_settings;
create policy "household_notification_settings_all_member"
  on public.household_notification_settings
  for all
  using ((select public.is_household_member(household_id)))
  with check ((select public.is_household_member(household_id)));

drop policy "recipe_favorites_select_self" on public.recipe_favorites;
create policy "recipe_favorites_select_self"
  on public.recipe_favorites
  for select
  using (user_id = (select auth.uid()));

drop policy "recipe_favorites_insert_self" on public.recipe_favorites;
create policy "recipe_favorites_insert_self"
  on public.recipe_favorites
  for insert
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and (select public.is_household_member(r.household_id))
    )
  );

drop policy "recipe_favorites_delete_self" on public.recipe_favorites;
create policy "recipe_favorites_delete_self"
  on public.recipe_favorites
  for delete
  using (user_id = (select auth.uid()));

-- Restrictive premium gates: is_premium() evaluated once per statement.

drop policy "receipt_scans_insert_premium_or_onboarding" on public.receipt_scans;
create policy "receipt_scans_insert_premium_or_onboarding"
  on public.receipt_scans
  as restrictive
  for insert
  to authenticated
  with check (
    (select public.is_premium())
    or exists (
      select 1
      from public.households h
      where h.id = receipt_scans.household_id
        and h.first_fill_completed_at is null
    )
  );

drop policy "inventory_items_barcode_premium_or_onboarding" on public.inventory_items;
create policy "inventory_items_barcode_premium_or_onboarding"
  on public.inventory_items
  as restrictive
  for insert
  to authenticated
  with check (
    source <> 'barcode'
    or (select public.is_premium())
    or exists (
      select 1
      from public.households h
      where h.id = inventory_items.household_id
        and h.first_fill_completed_at is null
    )
  );
