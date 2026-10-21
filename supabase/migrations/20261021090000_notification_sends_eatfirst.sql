-- notifications-dispatch records eat-first pushes as type 'eatfirst', which the
-- original check rejected, so those sends were never logged and the global
-- 1/user/day cap could not see them.

-- Drop the existing type check whatever its generated name is.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notification_sends'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.notification_sends drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.notification_sends
  add constraint notification_sends_type_check
  check (type in ('daily','recap','eatfirst','topup','reengagement','member_activity'));
