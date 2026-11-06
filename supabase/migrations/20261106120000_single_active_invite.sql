-- One live invite code per kitchen. Tapping "Create invite code" again used to
-- leave the previous code working while the UI only ever shows the newest one
-- (getActiveInviteForHousehold takes the latest active row), so a code the
-- owner believed replaced still let someone in. Revoke the old ones first.

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

  if not exists (
    select 1
    from public.households h
    where h.id = target_household_id
      and h.plan_tier = 'household_premium'
  ) then
    raise exception 'Household Premium required to invite members';
  end if;

  update public.household_invites
  set status = 'revoked', updated_at = now()
  where household_id = target_household_id
    and status = 'active';

  insert into public.household_invites (household_id, code, created_by)
  values (target_household_id, public.generate_invite_code(), auth.uid())
  returning * into invite;

  return invite;
end;
$$;
