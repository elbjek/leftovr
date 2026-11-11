-- Test: shopping list (migration 20261111200000).
-- RLS keeps lists inside the household, ticking is the only update, a food
-- reaching the kitchen ticks its list item, and buy_again picks used-up
-- staples only.
-- Run:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/shopping_list_test.sql
-- Seeds throwaway data, asserts all cases, ROLLBACK at end (no residue).

begin;

do $$
declare
  u_ana uuid := '00000000-0000-0000-0000-0000000005a1';
  u_bo  uuid := '00000000-0000-0000-0000-0000000005b1';
  h_ana uuid;
  h_bo  uuid;
  item  uuid;
  raised boolean;
  names text[];
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u_ana, 'ana@t', 'authenticated', 'authenticated', '{"display_name":"Ana"}'),
    (u_bo,  'bo@t',  'authenticated', 'authenticated', '{"display_name":"Bo"}');
  select active_household_id into h_ana from public.profiles where id = u_ana;
  select active_household_id into h_bo  from public.profiles where id = u_bo;

  -- Purchase history for buy_again (seeded as owner, before switching role).
  insert into public.inventory_items
    (household_id, name, normalized_name, source, added_by, added_at, removed_at, removal_reason) values
    -- staple, used up: suggested
    (h_ana, 'Milk', 'milk', 'receipt', u_ana, now() - interval '20 days', now() - interval '10 days', 'used'),
    (h_ana, 'Milk', 'milk', 'receipt', u_ana, now() - interval '9 days',  now() - interval '2 days',  'used'),
    -- staple, thrown out last time: not suggested
    (h_ana, 'Rocket', 'rocket', 'receipt', u_ana, now() - interval '20 days', now() - interval '10 days', 'used'),
    (h_ana, 'Rocket', 'rocket', 'receipt', u_ana, now() - interval '9 days',  now() - interval '2 days',  'discarded'),
    -- staple, one still in the kitchen: not suggested
    (h_ana, 'Bread', 'bread', 'receipt', u_ana, now() - interval '20 days', now() - interval '10 days', 'used'),
    (h_ana, 'Bread', 'bread', 'receipt', u_ana, now() - interval '9 days',  null, null),
    -- bought once: not suggested
    (h_ana, 'Saffron', 'saffron', 'receipt', u_ana, now() - interval '9 days', now() - interval '2 days', 'used'),
    -- staple, used up long ago: not suggested
    (h_ana, 'Tofu', 'tofu', 'receipt', u_ana, now() - interval '80 days', now() - interval '70 days', 'used'),
    (h_ana, 'Tofu', 'tofu', 'receipt', u_ana, now() - interval '60 days', now() - interval '45 days', 'used'),
    -- Bo's kitchen: never visible to Ana
    (h_bo, 'Butter', 'butter', 'receipt', u_bo, now() - interval '20 days', now() - interval '10 days', 'used'),
    (h_bo, 'Butter', 'butter', 'receipt', u_bo, now() - interval '9 days',  now() - interval '2 days',  'used');

  perform set_config('request.jwt.claims', json_build_object('sub', u_ana, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CASE1: buy_again = used-up staples only.
  select array_agg(b.normalized_name) into names from public.buy_again(h_ana) b;
  assert names = array['milk'], format('CASE1 FAIL: buy_again gave %s', names);

  -- CASE2: another household's history comes back empty (RLS on inventory).
  select array_agg(b.normalized_name) into names from public.buy_again(h_bo) b;
  assert names is null, format('CASE2 FAIL: saw another kitchen: %s', names);

  -- CASE3: adding to your own list works; an item on the list leaves buy_again.
  insert into public.shopping_list_items (household_id, name, normalized_name, added_by)
    values (h_ana, 'Milk', 'milk', u_ana);
  select array_agg(b.normalized_name) into names from public.buy_again(h_ana) b;
  assert names is null, 'CASE3 FAIL: listed food still suggested';

  -- CASE4: no writing to another household's list, nor as someone else.
  raised := false;
  begin
    insert into public.shopping_list_items (household_id, name, normalized_name, added_by)
      values (h_bo, 'Eggs', 'eggs', u_ana);
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE4 FAIL: wrote to another household list';
  raised := false;
  begin
    insert into public.shopping_list_items (household_id, name, normalized_name, added_by)
      values (h_ana, 'Eggs', 'eggs', u_bo);
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE4 FAIL: added an item as another user';

  -- CASE5: ticking is the only update.
  select id into item from public.shopping_list_items where household_id = h_ana;
  update public.shopping_list_items set checked_at = now() where id = item;
  update public.shopping_list_items set checked_at = null where id = item;
  raised := false;
  begin
    update public.shopping_list_items set household_id = h_bo where id = item;
  exception when insufficient_privilege then raised := true; end;
  assert raised, 'CASE5 FAIL: moved a list item to another household';

  -- CASE6: a food reaching the kitchen ticks the matching list items.
  insert into public.shopping_list_items (household_id, name, normalized_name, added_by) values
    (h_ana, 'Egg', 'egg', u_ana),
    (h_ana, 'Olive oil', 'olive oil', u_ana),
    (h_ana, 'C++ sauce', 'c++ sauce', u_ana);
  insert into public.inventory_items (household_id, name, normalized_name, source, added_by)
    values (h_ana, 'Whole milk', 'whole milk', 'receipt', u_ana);
  assert (select checked_at is not null from public.shopping_list_items where id = item),
    'CASE6 FAIL: "whole milk" did not tick "milk"';
  insert into public.inventory_items (household_id, name, normalized_name, source, added_by)
    values (h_ana, 'Eggplant', 'eggplant', 'manual', u_ana);
  assert (select checked_at is null from public.shopping_list_items where normalized_name = 'egg'),
    'CASE6 FAIL: "eggplant" ticked "egg"';
  insert into public.inventory_items (household_id, name, normalized_name, source, added_by)
    values (h_ana, 'Extra virgin olive oil', 'extra virgin olive oil', 'pantry', u_ana);
  assert (select checked_at is not null from public.shopping_list_items where normalized_name = 'olive oil'),
    'CASE6 FAIL: pantry add did not tick "olive oil"';
  -- Regex metacharacters in a list name don't break the trigger.
  insert into public.inventory_items (household_id, name, normalized_name, source, added_by)
    values (h_ana, 'Hot c++ sauce', 'hot c++ sauce', 'manual', u_ana);
  assert (select checked_at is not null from public.shopping_list_items where normalized_name = 'c++ sauce'),
    'CASE6 FAIL: "c++ sauce" not ticked';

  -- CASE7: Ana can't see Bo's list; Bo's adds never tick Ana's items.
  reset role;
  insert into public.shopping_list_items (household_id, name, normalized_name, added_by)
    values (h_bo, 'Eggs', 'eggs', u_bo);
  set local role authenticated;
  assert (select count(*) from public.shopping_list_items where household_id = h_bo) = 0,
    'CASE7 FAIL: saw another household list';

  -- CASE8: reminder schedule only takes weekdays 0-6 and hours 0-23.
  raised := false;
  begin
    update public.household_notification_settings set shopping_reminder_days = '{7}' where household_id = h_ana;
  exception when check_violation then raised := true; end;
  assert raised, 'CASE8 FAIL: weekday 7 accepted';
  update public.household_notification_settings
    set shopping_reminder_days = '{6}', shopping_reminder_hour = 10 where household_id = h_ana;

  raise notice 'shopping_list_test: all cases passed';
end $$;

rollback;
