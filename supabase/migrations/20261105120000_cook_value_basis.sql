-- A cook "saved" 452.851,30 RSD. apply_cook valued a lot at
-- purchase_price / purchase_amount per unit consumed, with consumed in net g/ml
-- whenever the lot has a net. Lots priced per pack (purchase_amount = the count)
-- but measured in grams then saved price × grams: 620 / 1 × 500 g = 310000.
--
-- Now: value = share of the lot consumed × what the lot still is worth.
-- The share is unit-free (net before vs after, or count before vs after), so
-- it no longer matters which basis purchase_amount was written in. What the
-- lot is worth reads purchase_amount as a net only when it exceeds the count;
-- a count basis never does. It is capped at the price: a lot can't save more
-- than it cost. Same body as 20261021190000 otherwise.
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
  share numeric;
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

    -- Pre-read the lot so we can value the consumed share before mutating it.
    select i.normalized_name, i.category, i.purchase_price, i.purchase_amount, i.purchase_currency,
           i.net_amount, i.quantity
      into rec
      from public.inventory_items i
     where i.id = (op->>'id')::uuid
       and i.household_id = p_household_id
       and i.removed_at is null;

    case op->>'kind'
      when 'remove' then
        share := 1;
        update public.inventory_items
        set removed_at = now(), removal_reason = 'cooked'
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setNet' then
        share := case when rec.net_amount > 0
          then greatest(rec.net_amount - (op->>'netAmount')::numeric, 0) / rec.net_amount else 0 end;
        update public.inventory_items
        set net_amount = (op->>'netAmount')::numeric
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setQuantity' then
        share := case when rec.quantity > 0
          then greatest(rec.quantity - (op->>'quantity')::numeric, 0) / rec.quantity else 0 end;
        update public.inventory_items
        set quantity = (op->>'quantity')::numeric
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      when 'setPartial' then
        share := 0;
        update public.inventory_items
        set partial_state = (op->>'partialState')::public.partial_state
        where id = (op->>'id')::uuid
          and household_id = p_household_id
          and removed_at is null;
      else
        raise exception 'apply_cook: unknown op kind %', op->>'kind';
    end case;

    -- Emit a saved value event for the consumed share, when the lot is priced
    -- and something was actually consumed. Mirrors lotRemainingValue (src/lib/money.ts).
    if rec.purchase_price is not null
       and coalesce(rec.purchase_amount, 0) > 0
       and share > 0 then
      insert into public.value_events (household_id, kind, value, normalized_name, category, created_by, currency)
      values (
        p_household_id, 'saved',
        share * least(
          rec.purchase_price,
          rec.purchase_price / rec.purchase_amount * case
            when rec.net_amount is not null and rec.purchase_amount > coalesce(rec.quantity, 0) then rec.net_amount
            else coalesce(rec.quantity, 0)
          end
        ),
        rec.normalized_name, rec.category, (select auth.uid()), rec.purchase_currency
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
