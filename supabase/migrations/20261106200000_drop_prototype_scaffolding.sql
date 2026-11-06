-- Drop the last of the prototype-era scaffolding.
--
-- 1. profiles.prototype_day (1..7, default 1) gated three "day N" retention
--    features: a day-5 scan nudge, a day-7 savings recap, and a day-3 cook
--    coachmark. Nothing ever wrote the column — no client code, no RPC, no
--    trigger — so it sat at 1 and all three were unreachable. It was also in
--    the client-writable UPDATE grant, so a client could set it and light up
--    UI that never shipped (App Review 2.5.19: no dormant features).
--    The day-7 recap also invented its numbers (items * 0.4, * 1.5 for money,
--    ignoring the household currency).
--
-- 2. profiles.cooked_coachmark_seen_at only ever recorded that coachmark being
--    dismissed; with the coachmark gone nothing reads or writes it.
--
-- 3. set_preview_tier() let a signed-in user grant themselves any tier during
--    the prototype. Execute was revoked from public/anon/authenticated in
--    20260624185707, but the SECURITY DEFINER function itself is still there
--    and nothing calls it. Drop it rather than leave a self-serve premium
--    switch one stray grant away from live.

drop function if exists public.set_preview_tier(public.plan_tier);

alter table public.profiles drop column if exists prototype_day;
alter table public.profiles drop column if exists cooked_coachmark_seen_at;

-- Re-state the client-writable column grant without the two dropped columns
-- (dropping a column removes its grant, but keep this list explicit so the
-- current surface is readable in one place).
revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  avatar_initials,
  language,
  default_servings,
  cooking_for_seed,
  shopping_style,
  primary_goal,
  avoidances,
  onboarding_completed_at,
  last_active_at
) on table public.profiles to authenticated;
