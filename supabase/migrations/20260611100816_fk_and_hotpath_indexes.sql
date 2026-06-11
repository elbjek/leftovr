-- DATABASE_REVIEW D4/D5: indexes for hot query paths and unindexed foreign keys.
-- Postgres does not auto-index FK columns; unindexed FKs slow joins, RLS
-- subqueries, and ON DELETE CASCADE/SET NULL maintenance.

-- D4: depleteItemQuantity filters household_id + normalized_name on active lots
-- (runs once per ingredient on every cooked event).
create index inventory_items_household_norm_active_idx
  on public.inventory_items (household_id, normalized_name)
  where removed_at is null;

-- D5: FK indexes.

-- joined to profiles on every fridge load (profiles!added_by)
create index inventory_items_added_by_idx
  on public.inventory_items (added_by);

-- ON DELETE SET NULL maintenance when receipt_scans rows are deleted
create index inventory_items_source_scan_id_idx
  on public.inventory_items (source_scan_id)
  where source_scan_id is not null;

-- session -> recipes lookups and ON DELETE CASCADE
create index recipes_session_id_idx
  on public.recipes (session_id)
  where session_id is not null;

-- per-user recipe filters ("my recipes")
create index recipes_generated_by_idx
  on public.recipes (generated_by);

-- every cooked-count query filters/joins on recipe_id
create index cooked_events_recipe_id_idx
  on public.cooked_events (recipe_id)
  where recipe_id is not null;

-- per-user cooked history (listCookedRecipes(cookedBy))
create index cooked_events_cooked_by_idx
  on public.cooked_events (cooked_by);

-- scan -> review items lookup and ON DELETE CASCADE
create index receipt_review_items_scan_id_idx
  on public.receipt_review_items (scan_id);

-- read by is_premium() on every premium-gated insert
create index profiles_active_household_id_idx
  on public.profiles (active_household_id)
  where active_household_id is not null;

-- member-facing invite listing (only the code column was indexed)
create index household_invites_household_id_idx
  on public.household_invites (household_id);

-- recipe_sessions.generated_by FK
create index recipe_sessions_generated_by_idx
  on public.recipe_sessions (generated_by);
