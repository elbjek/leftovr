-- Test: accept_household_invite billing guards (migration 20260701120000)
-- Run:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/household_join_billing_guards_test.sql
-- Seeds throwaway data, asserts all cases, ROLLBACK at end (no residue).
-- auth.uid() is driven by the request.jwt.claims GUC set per-call.

begin;

do $$
declare
  -- users
  u_solo   uuid := '00000000-0000-0000-0000-000000000001'; -- premium, joins HP household  (Rule 1)
  u_payer  uuid := '00000000-0000-0000-0000-000000000002'; -- owns HP household w/ member   (Rule 2 blocked)
  u_member uuid := '00000000-0000-0000-0000-000000000003'; -- housemate of u_payer
  u_soloown uuid := '00000000-0000-0000-0000-000000000004'; -- sole owner of HP household    (regression)
  u_free   uuid := '00000000-0000-0000-0000-000000000005'; -- premium, joins FREE household  (Rule 1 no-op)
  u_hostA  uuid := '00000000-0000-0000-0000-000000000010'; -- owns target HP household A
  u_hostB  uuid := '00000000-0000-0000-0000-000000000011'; -- owns target household B (free)
  u_hostC  uuid := '00000000-0000-0000-0000-000000000012'; -- owns target household C

  -- households
  h_solo    uuid; h_targetA uuid; -- Rule 1
  h_payer   uuid; h_targetB uuid; -- Rule 2
  h_soloown uuid; h_targetC uuid; -- regression
  h_free    uuid;                 -- Rule 1 no-op (free target reuses targetB)

  got_tier plan_tier;
  got_active uuid;
  got_status household_status;
  raised boolean;

  procedure_note text;
begin
  -- disable triggers (handle_new_user would auto-create profiles/households) during seed
  perform set_config('session_replication_role','replica', true);

  -- seed auth.users (profiles.id FKs to auth.users)
  insert into auth.users (id, email, aud, role) values
    (u_solo,'solo@t','authenticated','authenticated'),
    (u_payer,'payer@t','authenticated','authenticated'),
    (u_member,'member@t','authenticated','authenticated'),
    (u_soloown,'soloown@t','authenticated','authenticated'),
    (u_free,'free@t','authenticated','authenticated'),
    (u_hostA,'hosta@t','authenticated','authenticated'),
    (u_hostB,'hostb@t','authenticated','authenticated'),
    (u_hostC,'hostc@t','authenticated','authenticated');

  -- seed profiles
  insert into public.profiles (id, display_name, tier) values
    (u_solo,'solo','premium'),
    (u_payer,'payer','free'),
    (u_member,'member','free'),
    (u_soloown,'soloown','free'),
    (u_free,'freejoin','premium'),
    (u_hostA,'hostA','free'),
    (u_hostB,'hostB','free'),
    (u_hostC,'hostC','free');

  -- households
  insert into public.households (name, plan_tier, created_by) values ('solo-hh','free',u_solo) returning id into h_solo;
  insert into public.households (name, plan_tier, created_by) values ('targetA-hp','household_premium',u_hostA) returning id into h_targetA;
  insert into public.households (name, plan_tier, created_by) values ('payer-hp','household_premium',u_payer) returning id into h_payer;
  insert into public.households (name, plan_tier, created_by) values ('targetB-free','free',u_hostB) returning id into h_targetB;
  insert into public.households (name, plan_tier, created_by) values ('soloown-hp','household_premium',u_soloown) returning id into h_soloown;
  insert into public.households (name, plan_tier, created_by) values ('targetC','free',u_hostC) returning id into h_targetC;

  -- memberships (owners + housemate)
  insert into public.household_members (household_id, user_id, role) values
    (h_solo,u_solo,'owner'),
    (h_targetA,u_hostA,'owner'),
    (h_payer,u_payer,'owner'),
    (h_payer,u_member,'member'),
    (h_targetB,u_hostB,'owner'),
    (h_soloown,u_soloown,'owner'),
    (h_targetC,u_hostC,'owner');

  -- active households
  update public.profiles set active_household_id = h_solo    where id = u_solo;
  update public.profiles set active_household_id = h_payer   where id = u_payer;
  update public.profiles set active_household_id = h_soloown where id = u_soloown;
  update public.profiles set active_household_id = h_solo    where id = u_free; -- reuse: put u_free in its own free hh
  -- give u_free its own free household so Rule 1 no-op target is a real free hh
  update public.profiles set active_household_id = h_targetB where id = u_free;

  -- invites (max_uses high so scenarios don't exhaust)
  insert into public.household_invites (household_id, code, created_by, max_uses) values
    (h_targetA,'AAAA1',u_hostA,5),  -- Rule 1 target (HP)
    (h_targetB,'BBBB2',u_hostB,5),  -- Rule 2 target + Rule1-no-op target (free)
    (h_targetC,'CCCC3',u_hostC,5);  -- regression target

  -- re-enable triggers before exercising the RPC
  perform set_config('session_replication_role','origin', true);

  ------------------------------------------------------------------
  -- CASE 1 — Rule 1: premium user joins HP household -> tier downgraded to free
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub',u_solo,'role','authenticated')::text, true);
  perform public.accept_household_invite('AAAA1', false);

  select tier, active_household_id into got_tier, got_active from public.profiles where id = u_solo;
  assert got_tier = 'free', format('CASE1 FAIL: expected tier free, got %s', got_tier);
  assert got_active = h_targetA, format('CASE1 FAIL: expected active=targetA, got %s', got_active);
  assert public.household_member_count(h_targetA) = 2, 'CASE1 FAIL: targetA should have 2 members';
  raise notice 'CASE1 PASS: Rule 1 downgrade works (premium -> free on HP join)';

  ------------------------------------------------------------------
  -- CASE 2 — Rule 2: HP owner with a housemate is BLOCKED from joining elsewhere
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub',u_payer,'role','authenticated')::text, true);
  raised := false;
  begin
    perform public.accept_household_invite('BBBB2', false);
  exception when others then
    raised := true;
    procedure_note := SQLERRM;
  end;
  assert raised, 'CASE2 FAIL: expected exception, none raised';
  assert procedure_note ilike '%Household Premium%', format('CASE2 FAIL: wrong error: %s', procedure_note);
  -- payer unchanged
  select active_household_id into got_active from public.profiles where id = u_payer;
  assert got_active = h_payer, 'CASE2 FAIL: payer active household changed';
  assert public.household_member_count(h_payer) = 2, 'CASE2 FAIL: payer household member count changed';
  assert (select used_count from public.household_invites where code='BBBB2') = 0, 'CASE2 FAIL: invite consumed';
  raise notice 'CASE2 PASS: Rule 2 blocks HP payer abandonment (%)', procedure_note;

  ------------------------------------------------------------------
  -- CASE 3 — Regression: SOLE owner of HP household CAN join; old hh archives
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub',u_soloown,'role','authenticated')::text, true);
  perform public.accept_household_invite('CCCC3', false);

  select active_household_id into got_active from public.profiles where id = u_soloown;
  assert got_active = h_targetC, 'CASE3 FAIL: solo owner did not move to targetC';
  select status into got_status from public.households where id = h_soloown;
  assert got_status = 'archived', format('CASE3 FAIL: old solo hh not archived, status=%s', got_status);
  raise notice 'CASE3 PASS: solo HP owner can leave; old household archived';

  ------------------------------------------------------------------
  -- CASE 4 — Rule 1 scope: premium user joining a FREE household keeps premium
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub',u_free,'role','authenticated')::text, true);
  perform public.accept_household_invite('BBBB2', false); -- targetB is free
  select tier into got_tier from public.profiles where id = u_free;
  assert got_tier = 'premium', format('CASE4 FAIL: premium wrongly dropped joining free hh, got %s', got_tier);
  raise notice 'CASE4 PASS: joining a free household does NOT touch personal tier';

  raise notice 'ALL CASES PASSED';
end $$;

rollback;
