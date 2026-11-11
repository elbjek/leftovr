-- Shopping list, round 2 (2026-11-11, agreed with Lena):
-- * food_key: the client's catalog food id (src/lib/foodIcons.ts
--   `foodMatchKey`, own English/Serbian names and their singular/plural
--   forms only), so "jaja" ticks "jaje" and "eggs" ticks "egg". Null when the
--   name matches no catalog food, and on rows written before this migration;
--   name matching still applies then.
-- * Pantry photos are stocktakes, not purchases: they no longer count as a
--   buy for buy_again.
-- * Thrown-out food is suggested again, flagged so the app can say "buy less".
-- * A suggestion can be dismissed until that food is added again.

alter table public.inventory_items
  add column food_key text check (food_key is null or length(food_key) between 1 and 40);
alter table public.shopping_list_items
  add column food_key text check (food_key is null or length(food_key) between 1 and 40);

create table public.shopping_dismissals (
  household_id uuid not null references public.households(id) on delete cascade,
  -- buy_again's item_key: food_key, else normalized_name.
  item_key text not null check (length(item_key) between 1 and 80),
  dismissed_by uuid references public.profiles(id) on delete set null,
  dismissed_at timestamptz not null default now(),
  primary key (household_id, item_key)
);

alter table public.shopping_dismissals enable row level security;

create policy "shopping_dismissals_select_member"
  on public.shopping_dismissals for select to authenticated
  using ((select public.is_household_member(household_id)));

create policy "shopping_dismissals_insert_member"
  on public.shopping_dismissals for insert to authenticated
  with check (
    (select public.is_household_member(household_id))
    and dismissed_by = (select auth.uid())
  );

-- Upsert (dismissing again after a re-buy) updates the existing row.
create policy "shopping_dismissals_update_member"
  on public.shopping_dismissals for update to authenticated
  using ((select public.is_household_member(household_id)))
  with check (
    (select public.is_household_member(household_id))
    and dismissed_by = (select auth.uid())
  );

revoke all on table public.shopping_dismissals from anon, authenticated;
grant select, insert on table public.shopping_dismissals to authenticated;
grant update (dismissed_at, dismissed_by) on table public.shopping_dismissals to authenticated;

-- Ticking: same rules as before, plus a shared catalog food.
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

-- Return type changes (item_key, thrown_out), so drop and recreate.
drop function public.buy_again(uuid, int);

-- Foods bought (receipt, barcode, manual: not pantry photos) on 2+ different
-- days in the last 90 days, last removed in the last 30 days, with nothing of
-- them left, not open on the list, and not dismissed since they were last
-- added. Grouped by catalog food when known. Security invoker: RLS scopes a
-- member to their own households; the dispatcher calls it as service role.
create function public.buy_again(p_household uuid, p_limit int default 8)
returns table (name text, normalized_name text, item_key text, thrown_out boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with per_food as (
    select
      coalesce(i.food_key, i.normalized_name) as item_key,
      (array_agg(i.name order by i.added_at desc))[1] as name,
      (array_agg(i.normalized_name order by i.added_at desc))[1] as normalized_name,
      count(distinct (i.added_at at time zone 'UTC')::date) filter (where i.source <> 'pantry') as buys,
      (array_agg(i.removal_reason order by i.removed_at desc nulls first))[1] as last_reason,
      max(i.removed_at) as last_removed,
      max(i.added_at) as last_added
    from public.inventory_items i
    where i.household_id = p_household
      and i.added_at > now() - interval '90 days'
    group by 1
  )
  select p.name, p.normalized_name, p.item_key, coalesce(p.last_reason = 'discarded', false)
  from per_food p
  where p.buys >= 2
    and p.last_removed > now() - interval '30 days'
    and not exists (
      select 1 from public.inventory_items a
      where a.household_id = p_household
        and a.removed_at is null
        and (coalesce(a.food_key, a.normalized_name) = p.item_key or a.normalized_name = p.normalized_name)
    )
    and not exists (
      select 1 from public.shopping_list_items s
      where s.household_id = p_household
        and s.checked_at is null
        and (coalesce(s.food_key, s.normalized_name) = p.item_key or s.normalized_name = p.normalized_name)
    )
    and not exists (
      select 1 from public.shopping_dismissals d
      where d.household_id = p_household
        and d.item_key = p.item_key
        and d.dismissed_at > p.last_added
    )
  order by p.buys desc, p.last_removed desc
  limit least(greatest(p_limit, 0), 20);
$$;

revoke execute on function public.buy_again(uuid, int) from public, anon;
grant execute on function public.buy_again(uuid, int) to authenticated, service_role;
