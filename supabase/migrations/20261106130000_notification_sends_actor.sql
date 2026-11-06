-- Member-activity pushes coalesce on "did this kitchen already get one in the
-- last 10 minutes", which swallowed the second person's shopping trip when two
-- housemates unpacked bags together. Record who caused the send so the window
-- can be per actor instead of per kitchen.

alter table public.notification_sends
  add column actor_id uuid references public.profiles(id) on delete set null;

create index notification_sends_household_type_actor_idx
  on public.notification_sends (household_id, type, actor_id, sent_at desc);
