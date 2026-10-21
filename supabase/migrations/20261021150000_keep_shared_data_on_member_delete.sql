-- FIXES B22: deleting a member's account cascaded through these author
-- columns and deleted shared household data the other members still use
-- (fridge items, scans, recipes, cook history). Keep the rows; forget the
-- author (SET NULL, like value_events.created_by). A sole member's household
-- is still deleted outright by the delete-account edge fn first.
-- Personal rows (memberships, notification prefs/sends, favorites,
-- generation attempts, expand events, invites they created) still cascade.

alter table public.inventory_items alter column added_by drop not null;
alter table public.inventory_items drop constraint inventory_items_added_by_fkey;
alter table public.inventory_items add constraint inventory_items_added_by_fkey
  foreign key (added_by) references public.profiles(id) on delete set null;

alter table public.receipt_scans alter column created_by drop not null;
alter table public.receipt_scans drop constraint receipt_scans_created_by_fkey;
alter table public.receipt_scans add constraint receipt_scans_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.recipe_sessions alter column generated_by drop not null;
alter table public.recipe_sessions drop constraint recipe_sessions_generated_by_fkey;
alter table public.recipe_sessions add constraint recipe_sessions_generated_by_fkey
  foreign key (generated_by) references public.profiles(id) on delete set null;

alter table public.recipes alter column generated_by drop not null;
alter table public.recipes drop constraint recipes_generated_by_fkey;
alter table public.recipes add constraint recipes_generated_by_fkey
  foreign key (generated_by) references public.profiles(id) on delete set null;

alter table public.cooked_events alter column cooked_by drop not null;
alter table public.cooked_events drop constraint cooked_events_cooked_by_fkey;
alter table public.cooked_events add constraint cooked_events_cooked_by_fkey
  foreign key (cooked_by) references public.profiles(id) on delete set null;

alter table public.item_usage_events alter column used_by drop not null;
alter table public.item_usage_events drop constraint item_usage_events_used_by_fkey;
alter table public.item_usage_events add constraint item_usage_events_used_by_fkey
  foreign key (used_by) references public.profiles(id) on delete set null;
