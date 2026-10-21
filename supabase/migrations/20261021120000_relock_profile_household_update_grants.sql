-- FIXES A1: 20260701000000 re-granted table-wide UPDATE on profiles/households,
-- undoing the S1 column lock. Any signed-in user could set profiles.tier,
-- reset free_*_used_at, set households.plan_tier, or repoint
-- active_household_id (which edge fns trust with the service role).
-- Re-lock to the columns the client actually writes. Everything else
-- (tier, plan_tier, free_*_used_at, active_household_id) changes only via
-- SECURITY DEFINER RPCs, triggers, or service-role edge fns.

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
  cooked_coachmark_seen_at,
  prototype_day,
  last_active_at
) on table public.profiles to authenticated;

revoke update on table public.households from authenticated;
grant update (
  name,
  default_servings,
  currency_code,
  first_fill_completed_at
) on table public.households to authenticated;
