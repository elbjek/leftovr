-- DATABASE_REVIEW D12 / D13 / D16.
--
-- D12: display_quantity was a client-computed presentation string that no UI
--      ever read; every quantity/net update paid an extra SELECT round-trip
--      just to recompute it. Drop the column; labels are formatted at render.
-- D13: the cook flow was N+1 sequential statements (deplete per ingredient,
--      then insert the cooked event) with no transaction — a mid-flight
--      failure left inventory half-depleted with no event. apply_cook applies
--      the client-computed depletion ops and records the cooked event in one
--      atomic, RLS-enforced (SECURITY INVOKER) call.
-- D16: invite rows stayed status='active' forever past expires_at (filtered at
--      read time only); pg_cron expires them nightly so the unique code space
--      and partial code index stay small.

-- D12: drop the write-only presentation column.
alter table public.inventory_items drop column display_quantity;

-- D13: atomic cook/deplete RPC. Ops are produced by the client's tested
-- planDepletion() and applied here in one transaction. SECURITY INVOKER, so
-- every UPDATE/INSERT still passes the household RLS policies.
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
begin
  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) loop
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

  -- p_used_items present = this was a cook, not a plain "use one" depletion.
  if p_used_items is not null then
    insert into public.cooked_events (household_id, recipe_id, cooked_by, servings, used_items)
    values (p_household_id, p_recipe_id, (select auth.uid()), p_servings, p_used_items);
  end if;
end;
$$;

grant execute on function public.apply_cook(uuid, jsonb, uuid, integer, jsonb) to authenticated;

-- D16: expire stale invites nightly (runs as postgres, bypasses RLS by design).
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'expire-household-invites',
  '17 3 * * *',
  $$
    update public.household_invites
    set status = 'expired'
    where status = 'active'
      and expires_at <= now()
  $$
);
