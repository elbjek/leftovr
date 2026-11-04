-- Burst-proof daily ceilings on the paid-AI usage tables.
-- The edge functions count a user's last 24h and then insert, as two steps,
-- so many requests fired at the same instant could all pass the count before
-- any of them was recorded. This trigger does the count and the insert under
-- one per-user lock, so concurrent inserts queue and the ceiling is exact.
-- The ceilings are the highest per-tier daily limits the edge functions apply
-- (they keep the tier-specific, friendlier checks); a refusal surfaces as
-- error message 'usage_cap_reached', which the functions map to 429.

create or replace function public.enforce_daily_usage_ceiling()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_column text := tg_argv[0];
  ceiling integer := tg_argv[1]::integer;
  owner_id uuid := (to_jsonb(new) ->> user_column)::uuid;
  recent integer;
begin
  -- Transaction-scoped: held until this insert commits, so the next insert
  -- for the same user and table sees this row in its count.
  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || owner_id::text));
  execute format(
    'select count(*) from %I.%I where %I = $1 and created_at > now() - interval ''1 day''',
    tg_table_schema, tg_table_name, user_column
  ) into recent using owner_id;
  if recent >= ceiling then
    raise exception 'usage_cap_reached';
  end if;
  return new;
end $$;

revoke execute on function public.enforce_daily_usage_ceiling() from public, anon, authenticated;

-- Recipe generations: premium 50/day (free is one lifetime generation).
create trigger recipe_generation_attempts_daily_ceiling
  before insert on public.recipe_generation_attempts
  for each row execute function public.enforce_daily_usage_ceiling('user_id', '50');

-- Receipt and pantry scans share one table and one limit: 30/day.
create trigger receipt_scans_daily_ceiling
  before insert on public.receipt_scans
  for each row execute function public.enforce_daily_usage_ceiling('created_by', '30');

-- Recipe expansions: premium 200/day (free 20, checked in the function).
create trigger recipe_expand_events_daily_ceiling
  before insert on public.recipe_expand_events
  for each row execute function public.enforce_daily_usage_ceiling('user_id', '200');
