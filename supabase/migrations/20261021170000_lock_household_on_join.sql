-- FIXES B25: member cap race. Same body as 20260701120000 plus a row lock
-- on the target household before the member count, so concurrent joins via
-- different invite codes serialize and the 3-member cap holds.

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

  -- B25: lock the household row before counting. Concurrent joins through
  -- different invite codes each lock only their own invite row, so without
  -- this both could see 2 members and both join (4 > cap of 3).
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
