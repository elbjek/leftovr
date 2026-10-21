-- FIXES C16: money totals mixed currencies. value_events and lot prices had
-- no currency, so after a household changed currency Insights summed old
-- amounts as if they were in the new one. Tag both; Insights counts only the
-- household's current currency (older rows stay for export).

alter table public.value_events add column currency text;
alter table public.inventory_items add column purchase_currency text;

-- Default to the household's currency at insert time when the writer didn't
-- say (spend events, lot inserts, older app builds). Lot-derived saved/wasted
-- events pass the lot's own currency explicitly.
create or replace function public.stamp_household_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'value_events' then
    if new.currency is null then
      select h.currency_code into new.currency from public.households h where h.id = new.household_id;
    end if;
  elsif new.purchase_price is not null
        and (new.purchase_currency is null or tg_op = 'UPDATE') then
    -- A price typed now (insert or later edit) is in today's currency.
    select h.currency_code into new.purchase_currency from public.households h where h.id = new.household_id;
  end if;
  return new;
end $$;

revoke execute on function public.stamp_household_currency() from public, anon, authenticated;

create trigger value_events_stamp_currency
  before insert on public.value_events
  for each row execute function public.stamp_household_currency();

create trigger inventory_items_stamp_purchase_currency
  before insert or update of purchase_price on public.inventory_items
  for each row execute function public.stamp_household_currency();

-- Backfill: everything so far was recorded in the household's current currency.
update public.value_events v set currency = h.currency_code
  from public.households h where h.id = v.household_id and v.currency is null;
update public.inventory_items i set purchase_currency = h.currency_code
  from public.households h where h.id = i.household_id
  and i.purchase_price is not null and i.purchase_currency is null;

-- apply_cook: same body as 20261021160000, saved events carry the lot's currency.
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
    select i.normalized_name, i.category, i.purchase_price, i.purchase_amount, i.purchase_currency,
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
      insert into public.value_events (household_id, kind, value, normalized_name, category, created_by, currency)
      values (
        p_household_id, 'saved',
        rec.purchase_price / rec.purchase_amount * consumed,
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
