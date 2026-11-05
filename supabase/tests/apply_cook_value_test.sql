-- Plain-Postgres check of the "saved" money apply_cook records per cook.
-- Run against an EMPTY scratch database, never a Supabase project:
--   createdb cook_value_scratch && psql -d cook_value_scratch -v ON_ERROR_STOP=1 -f supabase/tests/apply_cook_value_test.sql
-- Stubs the bits of the Supabase schema apply_cook touches, applies it, then asserts.
-- The lots are copies of real rows that once made one dinner "save" 452.851,30 RSD:
-- priced per pack (purchase_amount = 1) but measured in grams (net_amount = 500).

\set ON_ERROR_STOP 1
do $$ begin
  create role anon; create role authenticated; create role service_role;
exception when duplicate_object then null;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create type public.partial_state as enum ('full', 'some_used', 'low');
create domain public.inventory_category as text;
create table public.households (id uuid primary key, currency_code text not null default 'RSD');
create table public.inventory_items (
  id uuid primary key, household_id uuid, normalized_name text, category public.inventory_category,
  quantity numeric, net_amount numeric, purchase_price numeric, purchase_amount numeric,
  partial_state public.partial_state default 'full', removed_at timestamptz, removal_reason text);
create table public.value_events (
  id serial, household_id uuid, kind text, value numeric, normalized_name text,
  category public.inventory_category, created_by uuid, occurred_at timestamptz default now());
create table public.item_usage_events (household_id uuid, normalized_name text, category public.inventory_category, used_by uuid);
create table public.cooked_events (
  household_id uuid, recipe_id uuid, cooked_by uuid, servings int, used_items jsonb, client_cook_id uuid);

\ir ../migrations/20261021190000_money_currency.sql
\ir ../migrations/20261105120000_cook_value_basis.sql

insert into public.households values ('00000000-0000-0000-0000-0000000000aa');
insert into public.inventory_items (id, household_id, normalized_name, category, quantity, net_amount, purchase_price, purchase_amount) values
  -- Priced per pack, measured in g/ml (the bad rows).
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'ground beef', 'meat', 1, 500, 620, 1),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'olive oil', 'pantry', 1, 720.43, 1290, 1),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'pasta', 'pantry', 2, 500, 159, 2),
  -- Priced per gram as the app writes it: 1 kg for 500, 400 g left.
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000aa', 'rice', 'pantry', 1, 400, 500, 1000),
  -- Counted: 10 eggs for 330, 8 left.
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000aa', 'eggs', 'dairy_eggs', 8, null, 330, 10);

select public.apply_cook(
  '00000000-0000-0000-0000-0000000000aa',
  '[{"kind":"remove","id":"00000000-0000-0000-0000-000000000001"},
    {"kind":"setNet","id":"00000000-0000-0000-0000-000000000002","netAmount":690.86},
    {"kind":"remove","id":"00000000-0000-0000-0000-000000000003"},
    {"kind":"setNet","id":"00000000-0000-0000-0000-000000000004","netAmount":200},
    {"kind":"setQuantity","id":"00000000-0000-0000-0000-000000000005","quantity":6}]'::jsonb,
  null, 4, '[]'::jsonb, null);

do $$
declare
  got numeric;
  total numeric := 0;
begin
  select round(value, 2) into got from public.value_events where normalized_name = 'ground beef';
  assert got = 620, format('ground beef: whole pack used, saved %s, want 620', got);
  total := total + got;
  -- 2 tbsp (29.57 ml) of what was left of the bottle.
  select round(value, 2) into got from public.value_events where normalized_name = 'olive oil';
  assert got = round(1290 * 29.57 / 720.43, 2), format('olive oil: saved %s, want 52.95', got);
  total := total + got;
  select round(value, 2) into got from public.value_events where normalized_name = 'pasta';
  assert got = 159, format('pasta: saved %s, want 159', got);
  total := total + got;
  select round(value, 2) into got from public.value_events where normalized_name = 'rice';
  assert got = 100, format('rice: 200 g at 0.5/g, saved %s, want 100', got);
  total := total + got;
  select round(value, 2) into got from public.value_events where normalized_name = 'eggs';
  assert got = 66, format('eggs: 2 of 10 for 330, saved %s, want 66', got);
  total := total + got;
  -- One dinner can never save more than its lots cost.
  assert total <= 620 + 1290 + 159 + 500 + 330, format('cook saved %s', total);
  raise notice 'apply_cook value: all assertions passed (saved %)', total;
end $$;
