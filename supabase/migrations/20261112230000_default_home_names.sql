-- Default household names become "{name}'s home" (Lena, 2026-11-12: the pill
-- read "Lena's kitchen"). Serbian keeps the no-possessive form: "Lena — dom".
-- Households still on the old default ("{name}'s kitchen" / "{name} —
-- kuhinja" / "My kitchen" / "Moja kuhinja") are renamed; hand-named ones stay.

create or replace function public.kitchen_name_for(display_name text, lang text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lang = 'sr' then
      coalesce(nullif(trim(display_name), '') || ' — dom', 'Moj dom')
    else
      coalesce(nullif(trim(display_name), '') || '''s home', 'My home')
  end;
$$;

revoke execute on function public.kitchen_name_for(text, text) from public, anon, authenticated;

-- The pre-2026-11-12 defaults, so a household created before this still counts
-- as default-named (renamed here, and followed on later name changes).
create or replace function public.legacy_kitchen_name_for(display_name text, lang text)
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

revoke execute on function public.legacy_kitchen_name_for(text, text) from public, anon, authenticated;

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
      public.kitchen_name_for(old.display_name, 'sr'),
      public.legacy_kitchen_name_for(old.display_name, 'en'),
      public.legacy_kitchen_name_for(old.display_name, 'sr')
    );
  return new;
end;
$$;

revoke all on function public.rename_default_kitchen() from public, anon, authenticated;

-- Sign-up: same body as before, the name now from kitchen_name_for (English;
-- the rename trigger follows once the client syncs the language).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  household_id uuid;
begin
  display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  if display_name is null then
    display_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, display_name, avatar_initials)
  values (new.id, display_name, public.make_avatar_initials(display_name));

  insert into public.households (name, created_by)
  values (public.kitchen_name_for(display_name, 'en'), new.id)
  returning id into household_id;

  insert into public.household_members (household_id, user_id, role)
  values (household_id, new.id, 'owner');

  update public.profiles
  set active_household_id = household_id
  where id = new.id;

  insert into public.notification_preferences (user_id)
  values (new.id);

  insert into public.household_notification_settings (household_id)
  values (household_id);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Rename households still on the old default, in their creator's language.
update public.households h
set name = public.kitchen_name_for(p.display_name, p.language)
from public.profiles p
where p.id = h.created_by
  and h.name in (
    public.legacy_kitchen_name_for(p.display_name, 'en'),
    public.legacy_kitchen_name_for(p.display_name, 'sr')
  );
