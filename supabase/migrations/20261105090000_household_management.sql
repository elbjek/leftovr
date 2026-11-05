-- FIXES B24: manage the whole household from Settings — leave, remove a
-- member, hand over ownership. (Rename is a plain update: `name` is already
-- in the authenticated UPDATE column grant.)
--
-- Every user always has exactly one active household, so whoever leaves or
-- is removed lands in a fresh solo kitchen. Their shared food stays behind.
-- Plan tier follows the webhook/delete-account rule: household_premium while
-- any active member has profiles.tier = 'household_premium'.

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------

create or replace function public.recompute_household_plan(target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.households h
  set plan_tier = case
    when exists (
      select 1
      from public.household_members m
      join public.profiles p on p.id = m.user_id
      where m.household_id = target
        and m.status = 'active'
        and p.tier = 'household_premium'
    ) then 'household_premium'::public.plan_tier
    else 'free'::public.plan_tier
  end
  where h.id = target;
$$;

-- Marks `leaver` removed from `target`. An owner's role passes to the
-- longest-standing remaining member (same heir rule as delete-account); an
-- emptied household is archived. Role resets to member so a later rejoin
-- through an invite can't bring back a second owner.
create or replace function public.exit_household(target uuid, leaver uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  was_owner boolean;
  heir uuid;
begin
  select hm.role = 'owner'
  into was_owner
  from public.household_members hm
  where hm.household_id = target
    and hm.user_id = leaver
    and hm.status = 'active';

  if not found then
    return;
  end if;

  update public.household_members
  set status = 'removed', removed_at = now(), role = 'member', updated_at = now()
  where household_id = target
    and user_id = leaver;

  if public.household_member_count(target) = 0 then
    update public.households set status = 'archived' where id = target;
    return;
  end if;

  if was_owner then
    select hm.user_id
    into heir
    from public.household_members hm
    where hm.household_id = target
      and hm.status = 'active'
    order by hm.joined_at
    limit 1;

    update public.household_members
    set role = 'owner', updated_at = now()
    where household_id = target
      and user_id = heir;

    -- created_by drives rename_default_kitchen; the kitchen now belongs to the heir.
    update public.households set created_by = heir where id = target;
  end if;

  perform public.recompute_household_plan(target);
end;
$$;

-- New solo kitchen for `uid` (as at sign-up), keeping the currency of the
-- kitchen they came from. Becomes their active household.
create or replace function public.create_solo_household(uid uuid, from_household uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.households (name, created_by, currency_code)
  select
    p.display_name || '''s kitchen',
    uid,
    coalesce((select h.currency_code from public.households h where h.id = from_household), 'USD')
  from public.profiles p
  where p.id = uid
  returning id into new_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, uid, 'owner');

  insert into public.household_notification_settings (household_id)
  values (new_id);

  update public.profiles set active_household_id = new_id where id = uid;

  perform public.recompute_household_plan(new_id);
  return new_id;
end;
$$;

revoke execute on function public.recompute_household_plan(uuid) from public, anon, authenticated;
revoke execute on function public.exit_household(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_solo_household(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client RPCs
-- ---------------------------------------------------------------------------

-- Leave a shared kitchen. Returns the caller's new solo household id.
create or replace function public.leave_household(target_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.households h where h.id = target_household_id for update;

  if not public.is_household_member(target_household_id) then
    raise exception 'Not a member of this household';
  end if;

  if public.household_member_count(target_household_id) < 2 then
    raise exception 'You are the only member of this household';
  end if;

  perform public.exit_household(target_household_id, (select auth.uid()));
  return public.create_solo_household((select auth.uid()), target_household_id);
end;
$$;

-- Owner removes another member. The removed member gets a solo kitchen, and
-- the household's open invite codes are revoked (they may know one).
create or replace function public.remove_household_member(target_household_id uuid, member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.households h where h.id = target_household_id for update;

  if not public.is_household_owner(target_household_id) then
    raise exception 'Only the owner can remove members';
  end if;

  if member_user_id = (select auth.uid()) then
    raise exception 'Use leave_household to leave';
  end if;

  if not exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = member_user_id
      and hm.status = 'active'
  ) then
    raise exception 'Not a member of this household';
  end if;

  perform public.exit_household(target_household_id, member_user_id);
  perform public.create_solo_household(member_user_id, target_household_id);

  update public.household_invites
  set status = 'revoked', updated_at = now()
  where household_id = target_household_id
    and status = 'active';
end;
$$;

-- Owner hands the owner role to another active member.
create or replace function public.transfer_household_ownership(target_household_id uuid, new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.households h where h.id = target_household_id for update;

  if not public.is_household_owner(target_household_id) then
    raise exception 'Only the owner can transfer ownership';
  end if;

  if new_owner_id = (select auth.uid()) or not exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = new_owner_id
      and hm.status = 'active'
  ) then
    raise exception 'Not a member of this household';
  end if;

  update public.household_members
  set role = case when user_id = new_owner_id then 'owner'::public.household_role else 'member'::public.household_role end,
      updated_at = now()
  where household_id = target_household_id
    and status = 'active';

  update public.households set created_by = new_owner_id where id = target_household_id;
end;
$$;

revoke execute on function public.leave_household(uuid) from public, anon;
revoke execute on function public.remove_household_member(uuid, uuid) from public, anon;
revoke execute on function public.transfer_household_ownership(uuid, uuid) from public, anon;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_household_ownership(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Join: same body as 20261021170000, but leaving the old household goes
-- through exit_household (an owner who joins elsewhere now hands the kitchen
-- to the next member instead of leaving it ownerless, and the old kitchen's
-- plan is recomputed), and the joined kitchen's plan is recomputed too (a
-- payer joining a free kitchen now covers it).
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

  perform 1 from public.households h where h.id = invite.household_id for update;

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

  -- Rule 2: block a Household Premium payer/owner from abandoning members.
  if current_household_id is not null
     and current_household_id <> invite.household_id
     and public.is_household_owner(current_household_id)
     and (select h.plan_tier from public.households h where h.id = current_household_id) = 'household_premium'
     and public.household_member_count(current_household_id) > 1
  then
    raise exception 'You own an active Household Premium plan with other members. Transfer ownership or cancel it before joining another household.';
  end if;

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
    role = 'member',
    removed_at = null,
    updated_at = now();

  update public.profiles
  set active_household_id = invite.household_id
  where id = (select auth.uid());

  -- Rule 1: the new household covers premium via is_premium(); a personal paid tier
  -- would double-charge. Drop it. TODO real-billing: also cancel the subscription
  -- at the payment provider (Stripe/RevenueCat) when checkout exists.
  if (select h.plan_tier from public.households h where h.id = invite.household_id) = 'household_premium' then
    update public.profiles
    set tier = 'free'
    where id = (select auth.uid())
      and tier <> 'free';
  end if;

  if current_household_id is not null and current_household_id <> invite.household_id then
    perform public.exit_household(current_household_id, (select auth.uid()));
  end if;

  perform public.recompute_household_plan(invite.household_id);

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
