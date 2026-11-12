-- When a kitchen is archived (its last member left), its active invite codes
-- stayed live. accept_household_invite never reads households.status, so anyone
-- holding an old code could join the archived kitchen and read what the last
-- member left behind. Revoke a kitchen's codes the moment it is archived,
-- whichever function archives it.

create or replace function public.revoke_invites_on_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.household_invites
  set status = 'revoked', updated_at = now()
  where household_id = new.id
    and status = 'active';
  return new;
end;
$$;

revoke execute on function public.revoke_invites_on_archive() from public, anon, authenticated;

create trigger households_revoke_invites_on_archive
  after update of status on public.households
  for each row
  when (new.status = 'archived' and old.status is distinct from 'archived')
  execute function public.revoke_invites_on_archive();

-- Kitchens archived before this migration.
update public.household_invites hi
set status = 'revoked', updated_at = now()
from public.households h
where h.id = hi.household_id
  and h.status = 'archived'
  and hi.status = 'active';
