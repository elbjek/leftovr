-- Personal shopping lists (2026-11-12, Lena: "I should have my own and one
-- for the household"). owner_id null = the household's shared list; set = that
-- member's own list in this household, seen and changed by them only.
-- A food reaching the kitchen ticks the household list and the adder's own
-- list, never another member's.

alter table public.shopping_list_items
  add column owner_id uuid references public.profiles(id) on delete cascade;

drop index if exists public.shopping_list_items_household_idx;
create index shopping_list_items_household_idx
  on public.shopping_list_items (household_id, owner_id, checked_at);

drop policy "shopping_list_items_select_member" on public.shopping_list_items;
drop policy "shopping_list_items_insert_member" on public.shopping_list_items;
drop policy "shopping_list_items_update_member" on public.shopping_list_items;
drop policy "shopping_list_items_delete_member" on public.shopping_list_items;

create policy "shopping_list_items_select_member"
  on public.shopping_list_items for select to authenticated
  using (
    (select public.is_household_member(household_id))
    and (owner_id is null or owner_id = (select auth.uid()))
  );

create policy "shopping_list_items_insert_member"
  on public.shopping_list_items for insert to authenticated
  with check (
    (select public.is_household_member(household_id))
    and added_by = (select auth.uid())
    and (owner_id is null or owner_id = (select auth.uid()))
  );

create policy "shopping_list_items_update_member"
  on public.shopping_list_items for update to authenticated
  using (
    (select public.is_household_member(household_id))
    and (owner_id is null or owner_id = (select auth.uid()))
  )
  with check (
    (select public.is_household_member(household_id))
    and (owner_id is null or owner_id = (select auth.uid()))
  );

create policy "shopping_list_items_delete_member"
  on public.shopping_list_items for delete to authenticated
  using (
    (select public.is_household_member(household_id))
    and (owner_id is null or owner_id = (select auth.uid()))
  );

-- Inserts carry owner_id; updates stay checked_at only (grant unchanged).

create or replace function public.tick_shopping_list_on_add()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shopping_list_items s
     set checked_at = now()
   where s.household_id = new.household_id
     and s.checked_at is null
     and (s.owner_id is null or s.owner_id = new.added_by)
     and (
       s.normalized_name = new.normalized_name
       or (s.food_key is not null and s.food_key = new.food_key)
       or new.normalized_name ~ (
         '\m' || regexp_replace(s.normalized_name, '([^[:alnum:][:space:]])', '\\\1', 'g') || '\M'
       )
     );
  return null;
end;
$$;
