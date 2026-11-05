-- Test: household management RPCs (migration 20261105090000)
-- leave_household / remove_household_member / transfer_household_ownership,
-- and the owner hand-over accept_household_invite now does when leaving.
-- Run:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/household_management_test.sql
-- Seeds throwaway data, asserts all cases, ROLLBACK at end (no residue).
-- auth.uid() is driven by the request.jwt.claims GUC set per-call.

begin;

do $$
declare
  u_ana uuid := '00000000-0000-0000-0000-0000000000a1'; -- owner, Household Premium payer
  u_bo  uuid := '00000000-0000-0000-0000-0000000000b1'; -- member
  u_cy  uuid := '00000000-0000-0000-0000-0000000000c1'; -- member
  h     uuid;  -- the shared kitchen
  h_new uuid;
  raised boolean;
begin
  -- Sign-up trigger (handle_new_user) creates each profile + solo kitchen.
  -- (The CLI login role can't set session_replication_role to skip it.)
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u_ana, 'ana@t', 'authenticated', 'authenticated', '{"display_name":"Ana"}'),
    (u_bo,  'bo@t',  'authenticated', 'authenticated', '{"display_name":"Bo"}'),
    (u_cy,  'cy@t',  'authenticated', 'authenticated', '{"display_name":"Cy"}');
  select active_household_id into h from public.profiles where id = u_ana;
  update public.profiles set tier = 'household_premium' where id = u_ana;
  update public.households set plan_tier = 'household_premium', currency_code = 'RSD' where id = h;
  -- Bo and Cy move into Ana's kitchen; their own sign-up kitchens are retired.
  update public.household_members set status = 'removed', removed_at = now()
    where user_id in (u_bo, u_cy);
  update public.households set status = 'archived'
    where created_by in (u_bo, u_cy);
  update public.household_members set joined_at = now() - interval '3 days'
    where household_id = h and user_id = u_ana;
  insert into public.household_members (household_id, user_id, role, joined_at) values
    (h, u_bo, 'member', now() - interval '2 days'),
    (h, u_cy, 'member', now() - interval '1 day');
  update public.profiles set active_household_id = h where id in (u_bo, u_cy);
  insert into public.household_invites (household_id, code, created_by) values (h, 'MGMT0001', u_ana);

  -- CASE1: a member can't remove anyone or take ownership.
  perform set_config('request.jwt.claims', json_build_object('sub', u_bo, 'role', 'authenticated')::text, true);
  raised := false;
  begin perform public.remove_household_member(h, u_cy); exception when others then raised := true; end;
  assert raised, 'CASE1 FAIL: member removed someone';
  raised := false;
  begin perform public.transfer_household_ownership(h, u_bo); exception when others then raised := true; end;
  assert raised, 'CASE1 FAIL: member took ownership';
  assert public.household_member_count(h) = 3, 'CASE1 FAIL: membership changed';
  raise notice 'CASE1 PASS: members cannot remove or transfer';

  -- CASE2: the owner can't remove themself or a non-member.
  perform set_config('request.jwt.claims', json_build_object('sub', u_ana, 'role', 'authenticated')::text, true);
  raised := false;
  begin perform public.remove_household_member(h, u_ana); exception when others then raised := true; end;
  assert raised, 'CASE2 FAIL: owner removed self';
  raised := false;
  begin perform public.remove_household_member(h, gen_random_uuid()); exception when others then raised := true; end;
  assert raised, 'CASE2 FAIL: removed a non-member';
  raise notice 'CASE2 PASS: owner remove guards';

  -- CASE3: owner hands over to Bo.
  perform public.transfer_household_ownership(h, u_bo);
  assert (select role from public.household_members where household_id = h and user_id = u_bo) = 'owner', 'CASE3 FAIL: Bo not owner';
  assert (select role from public.household_members where household_id = h and user_id = u_ana) = 'member', 'CASE3 FAIL: Ana still owner';
  assert (select created_by from public.households where id = h) = u_bo, 'CASE3 FAIL: created_by not moved';
  raise notice 'CASE3 PASS: transfer ownership';

  -- CASE4: Bo (owner) removes Cy → Cy gets a solo kitchen; open invites revoked.
  perform set_config('request.jwt.claims', json_build_object('sub', u_bo, 'role', 'authenticated')::text, true);
  perform public.remove_household_member(h, u_cy);
  select active_household_id into h_new from public.profiles where id = u_cy;
  assert h_new <> h, 'CASE4 FAIL: Cy still points at the shared kitchen';
  assert (select status from public.household_members where household_id = h and user_id = u_cy) = 'removed', 'CASE4 FAIL: Cy still active';
  assert (select role from public.household_members where household_id = h_new and user_id = u_cy) = 'owner', 'CASE4 FAIL: Cy not owner of new kitchen';
  assert (select currency_code from public.households where id = h_new) = 'RSD', 'CASE4 FAIL: currency not carried';
  assert not exists (select 1 from public.household_invites where household_id = h and status = 'active'), 'CASE4 FAIL: invite still open';
  raise notice 'CASE4 PASS: remove member';

  -- CASE5: Cy, now outside, can't leave or manage the old kitchen.
  perform set_config('request.jwt.claims', json_build_object('sub', u_cy, 'role', 'authenticated')::text, true);
  raised := false;
  begin perform public.leave_household(h); exception when others then raised := true; end;
  assert raised, 'CASE5 FAIL: removed member left again';
  raise notice 'CASE5 PASS: removed member has no access';

  -- CASE6: Ana (payer, member) leaves → her premium goes with her.
  perform set_config('request.jwt.claims', json_build_object('sub', u_ana, 'role', 'authenticated')::text, true);
  h_new := public.leave_household(h);
  assert (select active_household_id from public.profiles where id = u_ana) = h_new, 'CASE6 FAIL: Ana not moved';
  assert (select plan_tier from public.households where id = h_new) = 'household_premium', 'CASE6 FAIL: new kitchen not premium';
  assert (select plan_tier from public.households where id = h) = 'free', 'CASE6 FAIL: old kitchen kept premium';
  raise notice 'CASE6 PASS: leave + plan recompute';

  -- CASE7: the last member can't leave.
  perform set_config('request.jwt.claims', json_build_object('sub', u_bo, 'role', 'authenticated')::text, true);
  raised := false;
  begin perform public.leave_household(h); exception when others then raised := true; end;
  assert raised, 'CASE7 FAIL: sole member left';
  raise notice 'CASE7 PASS: sole member cannot leave';

  -- CASE8: an owner leaving by joining elsewhere hands the kitchen over.
  -- Ana rejoins Bo's kitchen (as member, not her old owner role), then Bo joins Cy's.
  update public.profiles set tier = 'free' where id = u_ana;
  insert into public.household_invites (household_id, code, created_by) values (h, 'MGMT0002', u_bo);
  perform set_config('request.jwt.claims', json_build_object('sub', u_ana, 'role', 'authenticated')::text, true);
  perform public.accept_household_invite('MGMT0002', false);
  assert (select role from public.household_members where household_id = h and user_id = u_ana) = 'member', 'CASE8 FAIL: rejoin restored owner role';
  insert into public.household_invites (household_id, code, created_by)
    select active_household_id, 'MGMT0003', u_cy from public.profiles where id = u_cy;
  perform set_config('request.jwt.claims', json_build_object('sub', u_bo, 'role', 'authenticated')::text, true);
  perform public.accept_household_invite('MGMT0003', false);
  assert (select role from public.household_members where household_id = h and user_id = u_ana) = 'owner', 'CASE8 FAIL: Ana did not inherit';
  assert (select status from public.households where id = h) = 'active', 'CASE8 FAIL: kitchen archived';
  raise notice 'CASE8 PASS: owner hand-over on join';

  -- CASE9: internal helpers are not callable by clients.
  assert not has_function_privilege('authenticated', 'public.exit_household(uuid,uuid)', 'execute'), 'CASE9 FAIL: exit_household exposed';
  assert not has_function_privilege('authenticated', 'public.create_solo_household(uuid,uuid)', 'execute'), 'CASE9 FAIL: create_solo_household exposed';
  assert not has_function_privilege('authenticated', 'public.recompute_household_plan(uuid)', 'execute'), 'CASE9 FAIL: recompute_household_plan exposed';
  raise notice 'CASE9 PASS: helpers private';

  raise notice 'ALL HOUSEHOLD MANAGEMENT CASES PASSED';
end;
$$;

rollback;
