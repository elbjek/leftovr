-- Test: direct-write locks (migrations 20261110210000..20261110210200).
-- A signed-in user can no longer write household_invites or household_members
-- directly, nor back-date receipt_scans.created_at; the RPCs and the scan
-- confirm columns still work.
-- Run:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/direct_write_locks_test.sql
-- Seeds throwaway data, asserts all cases, ROLLBACK at end (no residue).
-- Writes run as the authenticated role; auth.uid() comes from request.jwt.claims.

begin;

do $$
declare
  u_ana uuid := '00000000-0000-0000-0000-0000000000d1';
  h     uuid;
  scan  uuid;
  raised boolean;
  code  text;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u_ana, 'ana@t', 'authenticated', 'authenticated', '{"display_name":"Ana"}');
  select active_household_id into h from public.profiles where id = u_ana;
  insert into public.household_invites (household_id, code, created_by) values (h, 'LOCK0001', u_ana);
  insert into public.receipt_scans (household_id, created_by) values (h, u_ana) returning id into scan;

  perform set_config('request.jwt.claims', json_build_object('sub', u_ana, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CASE1: no direct invite writes (the free owner minting a shareable code).
  raised := false;
  begin
    insert into public.household_invites (household_id, code, created_by, max_uses, expires_at)
      values (h, 'FREESHARE', u_ana, 1000, '2099-01-01');
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE1 FAIL: member inserted an invite directly';
  raised := false;
  begin
    update public.household_invites set expires_at = '2099-01-01', max_uses = 1000 where household_id = h;
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE1 FAIL: member edited an invite directly';
  assert (select count(*) from public.household_invites where household_id = h) = 1,
    'CASE1 FAIL: member can no longer read invites';
  raise notice 'CASE1 PASS: invites are read-only to members';

  -- CASE2: no direct member writes, even by the owner.
  raised := false;
  begin
    update public.household_members set status = 'removed' where household_id = h;
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE2 FAIL: owner rewrote a member row directly';
  raised := false;
  begin
    insert into public.household_members (household_id, user_id, role) values (h, gen_random_uuid(), 'member');
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE2 FAIL: owner inserted a member row directly';
  raise notice 'CASE2 PASS: member rows are read-only to members';

  -- CASE3: a scan can't be back-dated, but confirm's columns still update.
  raised := false;
  begin
    update public.receipt_scans set created_at = '2020-01-01' where id = scan;
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE3 FAIL: creator back-dated a scan';
  update public.receipt_scans
    set status = 'completed', item_count = 2, review_count = 1, duplicate_of = null, processed_at = now()
    where id = scan;
  assert (select status from public.receipt_scans where id = scan) = 'completed',
    'CASE3 FAIL: confirm could not complete the scan';
  raise notice 'CASE3 PASS: scan created_at locked, confirm columns writable';

  -- CASE4: the RPC still creates invites for a Household Premium kitchen.
  reset role;
  update public.profiles set tier = 'household_premium' where id = u_ana;
  update public.households set plan_tier = 'household_premium' where id = h;
  set local role authenticated;
  select (public.create_household_invite(h)).code into code;
  assert code is not null, 'CASE4 FAIL: create_household_invite returned no code';
  raise notice 'CASE4 PASS: create_household_invite still works';

  reset role;
end $$;

rollback;
