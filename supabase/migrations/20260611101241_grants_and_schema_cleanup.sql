-- DATABASE_REVIEW D7 (partial) / D9 / D14 / D15: grants + schema cleanup.
--
-- D14: GRANT ALL included TRUNCATE and REFERENCES; RLS does not govern TRUNCATE,
--      so tighten to the four DML privileges PostgREST actually serves.
-- D15: inventory_items is soft-delete only (removed_at) — the client never hard
--      deletes; revoke DELETE so it can't.
-- D7:  recipes.is_favorite was superseded by recipe_favorites (20260610130000)
--      but the column lingered; drop it.
-- D9:  duplicate receipt detection was check-then-act across two statements and
--      racy under concurrency. Partial unique index makes the signature check
--      atomic; intentional "add anyway" inserts carry duplicate_of and are
--      exempt.

-- D14: tighten table privileges.
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- D15: soft-delete table — no hard deletes from clients.
revoke delete on table public.inventory_items from authenticated;

-- D7: drop the superseded shared-favorite flag.
alter table public.recipes drop column is_favorite;

-- D9: atomic duplicate-receipt guard. "Add anyway" rows set duplicate_of, so
-- they bypass the unique constraint; only first-time signatures collide.
drop index if exists receipt_scans_signature_idx;
create unique index receipt_scans_signature_unique_idx
  on public.receipt_scans (household_id, receipt_signature)
  where receipt_signature is not null
    and duplicate_of is null
    and status = 'completed';
