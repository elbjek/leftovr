-- Housemates heard about shopping but not about dinner: only inventory inserts
-- notified. Cooking is the thing the other people in the kitchen most want to
-- know about ("dinner's handled"), so cooked_events now notifies too, through
-- the same edge function and the same "Household activity" opt-out.

alter table public.notification_sends drop constraint notification_sends_type_check;
alter table public.notification_sends add constraint notification_sends_type_check
  check (type in ('daily','recap','topup','reengagement','member_activity','eatfirst','streak','member_cooked'));

create or replace function public.on_cooked_event_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dish text;
begin
  select r.title into dish from public.recipes r where r.id = new.recipe_id;

  perform public.invoke_edge_fn(
    'notify-member-activity',
    jsonb_build_object(
      'household_id', new.household_id,
      'actor_id', new.cooked_by,
      'kind', 'cooked',
      'dish', dish
    )
  );
  return null;
end $$;

revoke execute on function public.on_cooked_event_notify() from public, anon, authenticated;

create trigger cooked_events_notify_member_activity
  after insert on public.cooked_events
  for each row execute function public.on_cooked_event_notify();
