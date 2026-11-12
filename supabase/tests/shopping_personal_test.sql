-- Test: personal shopping lists (migration 20261112240000).
-- A member's own items are invisible and untouchable to the rest of the
-- household; a food reaching the kitchen ticks the household list and the
-- adder's own list only.
-- Run:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/shopping_personal_test.sql
-- Seeds throwaway data, asserts all cases, ROLLBACK at end (no residue).

begin;

do $$
declare
  u_ana uuid := '00000000-0000-0000-0000-0000000006a1';
  u_bo  uuid := '00000000-0000-0000-0000-0000000006b1';
  h uuid;
  ana_milk uuid;
  n int;
  raised boolean;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u_ana, 'ana@t', 'authenticated', 'authenticated', '{"display_name":"Ana"}'),
    (u_bo,  'bo@t',  'authenticated', 'authenticated', '{"display_name":"Bo"}');
  select active_household_id into h from public.profiles where id = u_ana;
  insert into public.household_members (household_id, user_id, role) values (h, u_bo, 'member');

  insert into public.shopping_list_items (household_id, name, normalized_name, added_by, owner_id) values
    (h, 'Milk', 'milk', u_ana, null),
    (h, 'Milk', 'milk', u_ana, u_ana),
    (h, 'Milk', 'milk', u_bo, u_bo),
    (h, 'Quinoa', 'quinoa', u_ana, u_ana);
  select id into ana_milk from public.shopping_list_items where owner_id = u_ana and normalized_name = 'milk';

  -- As Bo.
  perform set_config('request.jwt.claims', json_build_object('sub', u_bo, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CASE1: Bo sees the household list and his own, not Ana's.
  select count(*) into n from public.shopping_list_items;
  assert n = 2, format('CASE1 FAIL: Bo sees %s rows', n);
  assert not exists (select 1 from public.shopping_list_items where owner_id = u_ana), 'CASE1 FAIL: saw Ana''s list';

  -- CASE2: Bo can't tick or delete Ana's items (no rows touched).
  update public.shopping_list_items set checked_at = now() where id = ana_milk;
  delete from public.shopping_list_items where id = ana_milk;

  -- CASE3: Bo can't add to Ana's list.
  raised := false;
  begin
    insert into public.shopping_list_items (household_id, name, normalized_name, added_by, owner_id)
      values (h, 'Eggs', 'eggs', u_bo, u_ana);
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE3 FAIL: added to someone else''s list';

  reset role;
  assert (select checked_at is null from public.shopping_list_items where id = ana_milk), 'CASE2 FAIL: Bo ticked Ana''s item';
  assert exists (select 1 from public.shopping_list_items where id = ana_milk), 'CASE2 FAIL: Bo deleted Ana''s item';

  -- CASE4: Ana's receipt milk ticks the household milk and hers, not Bo's.
  insert into public.inventory_items (household_id, name, normalized_name, source, added_by)
    values (h, 'Whole milk', 'whole milk', 'receipt', u_ana);
  assert (select checked_at is not null from public.shopping_list_items where owner_id is null and normalized_name = 'milk'),
    'CASE4 FAIL: household milk not ticked';
  assert (select checked_at is not null from public.shopping_list_items where id = ana_milk),
    'CASE4 FAIL: Ana''s milk not ticked';
  assert (select checked_at is null from public.shopping_list_items where owner_id = u_bo),
    'CASE4 FAIL: Bo''s milk ticked by Ana''s receipt';

  -- CASE5: a food outside the catalog (no food_key) still ticks by name.
  insert into public.inventory_items (household_id, name, normalized_name, source, added_by)
    values (h, 'White quinoa 500g', 'white quinoa', 'receipt', u_ana);
  assert (select checked_at is not null from public.shopping_list_items where normalized_name = 'quinoa'),
    'CASE5 FAIL: quinoa not ticked';

  raise notice 'shopping_personal_test: all cases passed';
end $$;

rollback;
