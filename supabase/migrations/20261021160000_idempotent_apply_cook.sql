-- FIXES B11: cooking could deplete twice. A 20s client timeout or a sheet
-- re-confirm while apply_cook was still in flight sent a second call that
-- depleted the same ingredients again. The client now sends one cook id per
-- cook attempt (kept until a cook succeeds); apply_cook skips an id that
-- already has a cooked_events row.
--
-- Same body as 20260630083205 plus p_cook_id. The old 5-arg function is
-- dropped, not overloaded: two candidates would make PostgREST reject every
-- apply_cook call. Builds already shipped call with 5 named args and resolve
-- to this one via the default.

alter table public.cooked_events add column client_cook_id uuid;
create unique index cooked_events_client_cook_id_key
  on public.cooked_events (client_cook_id) where client_cook_id is not null;

drop function public.apply_cook(uuid, jsonb, uuid, integer, jsonb);

create or replace function public.apply_cook(
  p_household_id uuid,
  p_ops jsonb,
  p_recipe_id uuid default null,
  p_servings integer default null,
  p_used_items jsonb default null,
  p_cook_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  op jsonb;
  touched_ids uuid[] := '{}';
  rec record;
  consumed numeric;
begin
  -- B11: a retried cook (timeout, sheet re-confirm) carries the same client
  -- cook id; if it already landed, do nothing. The xact lock serializes two
  -- in-flight retries so the second sees the first's cooked_events row.
  if p_cook_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_cook_id::text, 0));
    if exists (select 1 from public.cooked_events ce where ce.client_cook_id = p_cook_id) then
      return;
    end if;
  end if;

  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) loop
    touched_ids := touched_ids || (op->>'id')::uuid;

    -- Pre-read the lot so we can value the consumed delta before mutating it.
    select i.normalized_name, i.category, i.purchase_price, i.purchase_amount,
           i.net_amount, i.quantity
      into rec
      from public.inventory_items i
     where i.id = (op->>'id')::uuid
       and i.household_id = p_household_id
       and i.removed_at is null;

    case op->>'kind'
      when 'remove' then
        consumed := coalesce(rec.net_amount, rec.quantity, 0);
        update public.inventory_items
        set removed_at = now(), removal_reason = 'cooked'
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setNet' then
        consumed := greatest(coalesce(rec.net_amount, 0) - (op->>'netAmount')::numeric, 0);
        update public.inventory_items
        set net_amount = (op->>'netAmount')::numeric
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setQuantity' then
        consumed := greatest(coalesce(rec.quantity, 0) - (op->>'quantity')::numeric, 0);
        update public.inventory_items
        set quantity = (op->>'quantity')::numeric
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setPartial' then
        consumed := 0;
        update public.inventory_items
        set partial_state = (op->>'partialState')::public.partial_state
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      else
        raise exception 'apply_cook: unknown op kind %', op->>'kind';
    end case;

    -- Emit a saved value event for the consumed amount, when the lot is priced
    -- and something was actually consumed.
    if rec.purchase_price is not null
       and coalesce(rec.purchase_amount, 0) > 0
       and consumed > 0 then
      insert into public.value_events (household_id, kind, value, normalized_name, category, created_by)
      values (
        p_household_id, 'saved',
        rec.purchase_price / rec.purchase_amount * consumed,
        rec.normalized_name, rec.category, (select auth.uid())
      );
    end if;
  end loop;

  -- One usage event per distinct item touched, partial or full.
  insert into public.item_usage_events (household_id, normalized_name, category, used_by)
  select distinct p_household_id, i.normalized_name, i.category, (select auth.uid())
  from public.inventory_items i
  where i.id = any(touched_ids)
    and i.household_id = p_household_id;

  -- p_used_items present = this was a cook, not a plain "use one" depletion.
  if p_used_items is not null then
    insert into public.cooked_events (household_id, recipe_id, cooked_by, servings, used_items, client_cook_id)
    values (p_household_id, p_recipe_id, (select auth.uid()), p_servings, p_used_items, p_cook_id);
  end if;
end;
$$;

grant execute on function public.apply_cook(uuid, jsonb, uuid, integer, jsonb, uuid) to authenticated;
