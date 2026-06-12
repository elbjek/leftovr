-- Insights fix: "items used" previously counted only fully-removed lots, so
-- partial depletion (2 of 6 eggs, 200g off a 1kg bag) never registered and
-- cooked meals showed 0 items saved. apply_cook now logs one usage event per
-- distinct item it touches — partial or full — and insights read from that.

create table public.item_usage_events (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  normalized_name text not null,
  category public.inventory_category not null default 'other',
  used_by uuid not null references public.profiles(id) on delete cascade,
  used_at timestamptz not null default now()
);

create index item_usage_events_household_time_idx
  on public.item_usage_events (household_id, used_at desc);

alter table public.item_usage_events enable row level security;

create policy "item_usage_events_select_member"
  on public.item_usage_events
  for select
  using ((select public.is_household_member(household_id)));

create policy "item_usage_events_insert_own"
  on public.item_usage_events
  for insert
  with check (
    (select public.is_household_member(household_id))
    and used_by = (select auth.uid())
  );

-- apply_cook: same atomic behavior, plus the usage log.
create or replace function public.apply_cook(
  p_household_id uuid,
  p_ops jsonb,
  p_recipe_id uuid default null,
  p_servings integer default null,
  p_used_items jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  op jsonb;
  touched_ids uuid[] := '{}';
begin
  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) loop
    touched_ids := touched_ids || (op->>'id')::uuid;

    case op->>'kind'
      when 'remove' then
        update public.inventory_items
        set removed_at = now(), removal_reason = 'cooked'
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setNet' then
        update public.inventory_items
        set net_amount = (op->>'netAmount')::numeric
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setQuantity' then
        update public.inventory_items
        set quantity = (op->>'quantity')::numeric
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setPartial' then
        update public.inventory_items
        set partial_state = (op->>'partialState')::public.partial_state
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      else
        raise exception 'apply_cook: unknown op kind %', op->>'kind';
    end case;
  end loop;

  -- One usage event per distinct item touched, partial or full.
  insert into public.item_usage_events (household_id, normalized_name, category, used_by)
  select distinct p_household_id, i.normalized_name, i.category, (select auth.uid())
  from public.inventory_items i
  where i.id = any(touched_ids)
    and i.household_id = p_household_id;

  -- p_used_items present = this was a cook, not a plain "use one" depletion.
  if p_used_items is not null then
    insert into public.cooked_events (household_id, recipe_id, cooked_by, servings, used_items)
    values (p_household_id, p_recipe_id, (select auth.uid()), p_servings, p_used_items);
  end if;
end;
$$;
