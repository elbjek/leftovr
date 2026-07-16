-- Pantry photo AI: a scan can now come from shelf photos instead of a receipt.
-- Pantry scans reuse the receipt_scans pipeline (attempt tracking, free-taste
-- trigger, rate-limit counting) and are distinguished by scan_type.

alter table public.receipt_scans
  add column scan_type text not null default 'receipt'
    check (scan_type in ('receipt', 'pantry'));

-- Inventory rows confirmed from a pantry scan carry their own source so they
-- never emit purchase/spend accounting the way receipt rows do. Not used in
-- this migration (Postgres forbids using a new enum value in the same
-- transaction that adds it); the client inserts it at runtime.
alter type public.inventory_source add value if not exists 'pantry';
