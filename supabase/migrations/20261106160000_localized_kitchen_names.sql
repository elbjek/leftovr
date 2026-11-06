-- Default kitchen names were English-only ("Lena's kitchen"), so a Serbian
-- user who left a shared kitchen landed in an English-named one. They were
-- also unsafe: create_solo_household built the name from profiles.display_name
-- with no fallback, so a null/blank name produced a null name and the insert
-- returned no row (the member insert then failed with a null household_id).
--
-- Serbian avoids the possessive ("Lenina/Lenin/Lenino" depends on the name),
-- so the default reads "Lena — kuhinja".

create or replace function public.kitchen_name_for(display_name text, lang text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lang = 'sr' then
      coalesce(nullif(trim(display_name), '') || ' — kuhinja', 'Moja kuhinja')
    else
      coalesce(nullif(trim(display_name), '') || '''s kitchen', 'My kitchen')
  end;
$$;

revoke execute on function public.kitchen_name_for(text, text) from public, anon, authenticated;

-- Follow a display-name change in whichever language the kitchen was named in.
create or replace function public.rename_default_kitchen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.households
  set name = public.kitchen_name_for(new.display_name, new.language)
  where created_by = new.id
    and name in (
      public.kitchen_name_for(old.display_name, 'en'),
      public.kitchen_name_for(old.display_name, 'sr')
    );
  return new;
end;
$$;

revoke all on function public.rename_default_kitchen() from public, anon, authenticated;

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
    public.kitchen_name_for(p.display_name, p.language),
    uid,
    coalesce((select h.currency_code from public.households h where h.id = from_household), 'USD')
  from public.profiles p
  where p.id = uid
  returning id into new_id;

  if new_id is null then
    raise exception 'No profile for %', uid;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, uid, 'owner');

  insert into public.household_notification_settings (household_id)
  values (new_id);

  update public.profiles set active_household_id = new_id where id = uid;

  perform public.recompute_household_plan(new_id);
  return new_id;
end;
$$;

revoke execute on function public.create_solo_household(uuid, uuid) from public, anon, authenticated;
