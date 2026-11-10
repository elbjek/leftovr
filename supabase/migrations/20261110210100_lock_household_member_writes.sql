-- Security review 2026-11-10: every user owns their own kitchen, so every user
-- could rewrite any member row there (user_id, status, role) through the
-- initial schema's owner update policy, skipping leave / remove / transfer and
-- their plan recompute. The client only selects members; only the definer
-- RPCs write them now.
drop policy if exists "household_members_update_owner" on public.household_members;
revoke insert, update, delete on table public.household_members from authenticated;
