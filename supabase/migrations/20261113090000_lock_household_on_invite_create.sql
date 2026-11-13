-- create_household_invite checked membership without locking the kitchen, so it
-- could run alongside remove_household_member (which does lock it): the member
-- passed the check, the removal revoked the kitchen's codes and committed, and
-- the invite insert then went through, leaving the removed person a fresh code
-- to rejoin with. Take the same household lock first; under read committed the
-- membership check after the wait sees the committed removal.

create or replace function public.create_household_invite(target_household_id uuid)
returns public.household_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.household_invites;
begin
  perform 1 from public.households h where h.id = target_household_id for update;

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
