-- Test: default kitchen names (migration 20261106160000)
-- kitchen_name_for / rename_default_kitchen / create_solo_household.
-- Run:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/kitchen_names_test.sql
-- Seeds throwaway data, asserts, ROLLBACK at end (no residue).

begin;

do $$
declare
  u_en uuid := '00000000-0000-0000-0000-0000000000e1';
  u_sr uuid := '00000000-0000-0000-0000-0000000000e2';
  h_en uuid;
  h_sr uuid;
  solo uuid;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u_en, 'en@t', 'authenticated', 'authenticated', '{"display_name":"Ann"}'),
    (u_sr, 'sr@t', 'authenticated', 'authenticated', '{"display_name":"Lena"}');

  -- CASE1: the blank-name fallbacks never produce NULL.
  assert public.kitchen_name_for(null, 'en') = 'My kitchen', 'CASE1 FAIL: en null name';
  assert public.kitchen_name_for('  ', 'sr') = 'Moja kuhinja', 'CASE1 FAIL: sr blank name';
  assert public.kitchen_name_for('Ann', 'en') = 'Ann''s kitchen', 'CASE1 FAIL: en name';
  assert public.kitchen_name_for('Lena', 'sr') = 'Lena — kuhinja', 'CASE1 FAIL: sr name';
  raise notice 'CASE1 PASS: kitchen_name_for covers both languages and blank names';

  -- CASE2: renaming follows the kitchen's own language.
  update public.profiles set language = 'sr' where id = u_sr;
  select active_household_id into h_sr from public.profiles where id = u_sr;
  update public.households set name = public.kitchen_name_for('Lena', 'sr') where id = h_sr;
  update public.profiles set display_name = 'Lena K' where id = u_sr;
  assert (select name from public.households where id = h_sr) = 'Lena K — kuhinja',
    'CASE2 FAIL: sr rename, got ' || (select name from public.households where id = h_sr);

  select active_household_id into h_en from public.profiles where id = u_en;
  update public.profiles set display_name = 'Ann B' where id = u_en;
  assert (select name from public.households where id = h_en) = 'Ann B''s kitchen',
    'CASE2 FAIL: en rename, got ' || (select name from public.households where id = h_en);
  raise notice 'CASE2 PASS: rename follows the name the kitchen already has';

  -- CASE3: a hand-renamed kitchen is left alone.
  update public.households set name = 'Vikendica' where id = h_sr;
  update public.profiles set display_name = 'Lena M' where id = u_sr;
  assert (select name from public.households where id = h_sr) = 'Vikendica', 'CASE3 FAIL: custom name overwritten';
  raise notice 'CASE3 PASS: a renamed kitchen is never auto-renamed';

  -- CASE4: the solo kitchen a leaver lands in is named in their language.
  solo := public.create_solo_household(u_sr, h_sr);
  assert (select name from public.households where id = solo) = 'Lena M — kuhinja',
    'CASE4 FAIL: solo kitchen name, got ' || (select name from public.households where id = solo);
  assert (select active_household_id from public.profiles where id = u_sr) = solo, 'CASE4 FAIL: not activated';
  raise notice 'CASE4 PASS: solo kitchen is named in the user''s language';

  raise notice 'ALL KITCHEN NAME CASES PASSED';
end $$;

rollback;
