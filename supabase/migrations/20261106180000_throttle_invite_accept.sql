-- Two holes the review turned up.
--
-- 1. lookup_household_invite was throttled, accept_household_invite was not,
--    so the whole rate limit could be skipped by posting codes straight at
--    accept. Same 10-per-hour budget, same table, counted before the lookup.
--    A bad code now returns null instead of raising, so the attempt row
--    survives the call; the client raises the error instead.
-- 2. Every SECURITY DEFINER helper below was executable by anon through the
--    default PUBLIC grant on functions. They all bail without a session except
--    household_member_count, which handed anyone holding a household UUID its
--    member count. Lock them to authenticated (plus service_role for the edge
--    functions).

set check_function_bodies = off;

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
  recent_attempts integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;

  -- Same hourly budget and table as lookup_household_invite: a guesser who
  -- skips lookup and posts codes straight at accept gets the same 10 tries.
  select count(*) into recent_attempts
  from public.invite_lookup_attempts a
  where a.user_id = (select auth.uid())
    and a.attempted_at > now() - interval '1 hour';

  if recent_attempts >= 10 then
    raise exception 'Too many invite attempts. Try again later.';
  end if;

  -- Logged before the lookup so failed guesses count.
  insert into public.invite_lookup_attempts (user_id)
  values ((select auth.uid()));

  select *
  into invite
  from public.household_invites hi
  where hi.code = upper(trim(invite_code))
    and hi.status = 'active'
    and hi.expires_at > now()
  for update;

  -- Returns null rather than raising: a raise would roll back the attempt row
  -- above with it, and an unlogged guess is a free guess. The client turns the
  -- null back into "Invite code is invalid or expired".
  if invite.id is null then
    return null;
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

revoke execute on function public.accept_household_invite(text, boolean) from public, anon;
grant execute on function public.accept_household_invite(text, boolean) to authenticated;

revoke execute on function public.create_household_invite(uuid) from public, anon;
grant execute on function public.create_household_invite(uuid) to authenticated;

revoke execute on function public.lookup_household_invite(text) from public, anon;
grant execute on function public.lookup_household_invite(text) to authenticated;

revoke execute on function public.is_premium() from public, anon;
grant execute on function public.is_premium() to authenticated, service_role;

revoke execute on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated, service_role;

revoke execute on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_owner(uuid) to authenticated, service_role;

revoke execute on function public.household_member_count(uuid) from public, anon;
grant execute on function public.household_member_count(uuid) to authenticated, service_role;
