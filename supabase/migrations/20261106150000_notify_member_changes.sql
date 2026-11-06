-- Membership changed silently: someone joining, leaving or being removed sent
-- nothing, so the others only found out when the member list looked different.
-- Notify the remaining members through the same edge function.
--
-- Unlike the activity pushes these are NOT gated on household_premium: the
-- most important one ("the payer left") happens exactly when the kitchen's
-- plan has just dropped to free.

alter table public.notification_sends drop constraint notification_sends_type_check;
alter table public.notification_sends add constraint notification_sends_type_check
  check (type in ('daily','recap','topup','reengagement','member_activity','eatfirst','streak','member_cooked','member_change'));

-- exit_household gains the reason, so "left" and "removed" read differently.
drop function public.exit_household(uuid, uuid);

create or replace function public.exit_household(target uuid, leaver uuid, reason text default 'left')
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

  perform public.invoke_edge_fn(
    'notify-member-activity',
    jsonb_build_object('household_id', target, 'actor_id', leaver, 'kind', reason)
  );
end;
$$;

revoke execute on function public.exit_household(uuid, uuid, text) from public, anon, authenticated;

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

  perform public.exit_household(target_household_id, member_user_id, 'removed');
  perform public.create_solo_household(member_user_id, target_household_id);

  update public.household_invites
  set status = 'revoked', updated_at = now()
  where household_id = target_household_id
    and status = 'active';
end;
$$;

revoke execute on function public.remove_household_member(uuid, uuid) from public, anon;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;

-- accept_household_invite: same body as 20261105090000 plus the "joined" push.
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
    perform public.exit_household(current_household_id, (select auth.uid()), 'left');
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

  perform public.invoke_edge_fn(
    'notify-member-activity',
    jsonb_build_object('household_id', invite.household_id, 'actor_id', (select auth.uid()), 'kind', 'joined')
  );

  new_household_id := invite.household_id;
  return new_household_id;
end;
$$;
