-- Restore UPDATE grant for `authenticated` on profiles + households.
-- Regression from grants_and_schema_cleanup left `authenticated` without UPDATE,
-- so onboarding profile submit failed with: permission denied for table profiles/households.
-- RLS policies (profiles_update_self, households_update_member) already gate which rows.

grant update on public.profiles to authenticated;
grant update on public.households to authenticated;
