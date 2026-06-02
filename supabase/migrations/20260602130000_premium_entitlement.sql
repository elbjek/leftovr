set check_function_bodies = off;

-- Server-side mirror of the client entitlement rule (design §3):
-- premium if own profile is premium/household_premium, OR active household is household_premium.
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
    where p.id = auth.uid()
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

grant execute on function public.is_premium() to authenticated;

-- Share gate (design §4): inviting members requires Household Premium on the target household.
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

  insert into public.household_invites (household_id, code, created_by)
  values (target_household_id, public.generate_invite_code(), auth.uid())
  returning * into invite;

  return invite;
end;
$$;
