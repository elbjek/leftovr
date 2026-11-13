-- Free accounts get one successful generation, ever. generate-recipes checks
-- that with plain reads before inserting the attempt row, and stamps the
-- account only after the paid model call, so a burst of parallel requests
-- (each with its own idempotency key) all passed the gate and each ran Sonnet;
-- the losers' completed rows could then be replayed by key. Enforce it where
-- the row is written instead, under the same per-user lock as the daily
-- ceiling: a free account may have one generation in flight at a time, and
-- none once its free generation is used. A refusal raises 'usage_cap_reached',
-- which the function already maps to 429.

create or replace function public.enforce_free_generation_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'processing' then
    return new;
  end if;

  -- Same key as enforce_daily_usage_ceiling: parallel inserts for one user
  -- queue here, and each sees the rows committed before it.
  perform pg_advisory_xact_lock(hashtext('recipe_generation_attempts:' || new.user_id::text));

  if exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.tier in ('premium', 'household_premium')
  ) or exists (
    select 1 from public.households h
    where h.id = new.household_id and h.plan_tier = 'household_premium'
  ) then
    return new;
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.free_recipe_generation_used_at is not null
  ) then
    raise exception 'usage_cap_reached';
  end if;

  -- One in flight (7 min = the function's stale-processing cutoff), and none
  -- in the moment between a run completing and the account being stamped.
  if exists (
    select 1 from public.recipe_generation_attempts a
    where a.user_id = new.user_id
      and a.id <> new.id
      and (
        (a.status = 'processing' and a.created_at > now() - interval '7 minutes')
        or (a.status = 'completed' and a.completed_at > now() - interval '10 minutes')
      )
  ) then
    raise exception 'usage_cap_reached';
  end if;

  return new;
end $$;

revoke execute on function public.enforce_free_generation_gate() from public, anon, authenticated;

create trigger recipe_generation_attempts_free_gate
  before insert or update of status on public.recipe_generation_attempts
  for each row execute function public.enforce_free_generation_gate();
