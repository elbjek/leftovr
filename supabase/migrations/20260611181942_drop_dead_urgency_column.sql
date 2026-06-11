-- DATABASE_REVIEW D7 (final): drop the dead `urgency` column.
--
-- The column was a snapshot written at insert time and never refreshed as items
-- aged. Since CODE_REVIEW #1, urgency is computed on read (resolveUrgency from
-- expiry/age) and the column is no longer read by any code path. Remove it and
-- the now-unused enum.

alter table public.inventory_items drop column urgency;

drop type public.urgency_band;
