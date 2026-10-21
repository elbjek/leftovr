-- FIXES B19: "Kitchen updated" spam. The row-level trigger fired one
-- notify-member-activity call per inserted item with count 1, so a 20-line
-- receipt fired 20 concurrent calls that raced the 10-minute coalesce check.
-- Now one call per insert statement per household + actor, with the real
-- count. Same function name, so its revoked EXECUTE (20260624192016) stays.

drop trigger inventory_items_notify_member_activity on public.inventory_items;

create or replace function public.on_inventory_insert_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch record;
begin
  for batch in
    select household_id, added_by, count(*) as n
    from new_rows
    where added_by is not null -- author can be NULL since B22
    group by household_id, added_by
  loop
    perform public.invoke_edge_fn(
      'notify-member-activity',
      jsonb_build_object(
        'household_id', batch.household_id,
        'actor_id', batch.added_by,
        'count', batch.n
      )
    );
  end loop;
  return null;
end $$;

create trigger inventory_items_notify_member_activity
  after insert on public.inventory_items
  referencing new table as new_rows
  for each statement execute function public.on_inventory_insert_notify();
