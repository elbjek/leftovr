-- Household join billing guards
-- Rule 1: joining a Household Premium household makes a personal paid plan redundant.
--         Drop profiles.tier to 'free' on join to avoid silent double-pay.
-- Rule 2: an owner of an active household_premium household with other members
--         cannot abandon it by accepting another invite (would orphan members and
--         leave a zombie subscription). Force transfer/cancel first.
-- Based on the security_hardening (S2) definition; only the two guarded blocks are new.

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

grant execute on function public.accept_household_invite(text, boolean) to authenticated;
