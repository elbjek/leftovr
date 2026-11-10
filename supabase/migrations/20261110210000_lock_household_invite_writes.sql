-- Security review 2026-11-10: any member could insert or edit an invite row
-- directly (policies left from the initial schema), skipping
-- create_household_invite's Household Premium gate, the single-active-code
-- rule and the 14-day expiry, and reviving revoked codes. The client only
-- selects invites; only the definer RPCs write them now.
drop policy if exists "household_invites_insert_member" on public.household_invites;
drop policy if exists "household_invites_update_member" on public.household_invites;
revoke insert, update, delete on table public.household_invites from authenticated;
