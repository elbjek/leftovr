-- A new account's kitchen is named "<name>'s kitchen" at sign-up, and with
-- Apple sign-in that name is the private-relay email prefix ("wzgkwbnmtw's
-- kitchen"). The name people give in onboarding or Settings only reached
-- their profile. Now a display-name change renames the kitchen they created,
-- but only while it still carries the default name, so a kitchen someone
-- renamed by hand is left alone.

create or replace function public.rename_default_kitchen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.households
  set name = new.display_name || '''s kitchen'
  where created_by = new.id
    and name = old.display_name || '''s kitchen';
  return new;
end;
$$;

revoke all on function public.rename_default_kitchen() from public, anon, authenticated;

drop trigger if exists rename_default_kitchen on public.profiles;
create trigger rename_default_kitchen
  after update of display_name on public.profiles
  for each row
  when (new.display_name is distinct from old.display_name
        and nullif(trim(new.display_name), '') is not null)
  execute function public.rename_default_kitchen();

-- Kitchens still named after the sign-up email prefix while their creator has
-- since chosen a real name.
update public.households h
set name = p.display_name || '''s kitchen'
from public.profiles p
join auth.users u on u.id = p.id
where h.created_by = p.id
  and h.name = split_part(u.email, '@', 1) || '''s kitchen'
  and nullif(trim(p.display_name), '') is not null
  and p.display_name <> split_part(u.email, '@', 1);
