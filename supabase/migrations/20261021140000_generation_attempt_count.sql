-- FIXES A6: a failed generation attempt is retried by reusing its row (unique
-- per user + idempotency key), so row counts undercount model calls. The edge
-- fn bumps attempt_count on each retry and caps on the sum, which lets free
-- users retry after a failure without unbounded paid calls.

alter table public.recipe_generation_attempts
  add column attempt_count integer not null default 1;
