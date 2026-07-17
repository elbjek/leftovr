-- Free scan taste is now consumed only by a SUCCESSFUL scan (items found),
-- stamped explicitly by the normalize-receipt / normalize-pantry edge
-- functions on their success paths. The old trigger stamped it on every scan
-- attempt (even failures), so one bad photo burned the free taste forever.
-- See docs/AS_BUILT.md ("Free taste").

drop trigger if exists receipt_scans_mark_free_use on public.receipt_scans;
drop function if exists public.mark_free_receipt_scan_used();
