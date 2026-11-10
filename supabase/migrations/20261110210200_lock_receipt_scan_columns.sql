-- Security review 2026-11-10: a scan's creator could update any column of it,
-- including created_at, which the 30/day ceiling and the scan functions' daily
-- and monthly caps count by. Back-dating reset every scan quota. Keep only the
-- columns the confirm step writes.
revoke update on table public.receipt_scans from authenticated;
grant update (status, item_count, review_count, duplicate_of, processed_at)
  on table public.receipt_scans to authenticated;
