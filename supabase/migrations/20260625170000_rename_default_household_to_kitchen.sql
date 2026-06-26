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
  values (display_name || '''s kitchen', new.id)
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

update public.households
set name = regexp_replace(name, '''s fridge$', '''s kitchen')
where name ~ '''s fridge$';
