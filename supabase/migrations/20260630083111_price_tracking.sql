-- Price tracking: per-household currency, per-lot price (with basis for
-- proportional partial attribution), money events, and used/discarded reasons.

-- 1. Household currency
alter table public.households
  add column if not exists currency_code text not null default 'USD';

-- 2. Per-lot price. purchase_price = total paid; purchase_amount = the
--    quantity/net it covered at purchase (immutable, unlike quantity/net_amount
--    which deplete). Unit price is derived = purchase_price / purchase_amount.
alter table public.inventory_items
  add column if not exists purchase_price numeric,
  add column if not exists purchase_amount numeric;

-- 3. Money events: single source for spend/saved/wasted insights.
create table if not exists public.value_events (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('spend','saved','wasted')),
  value numeric not null,
  normalized_name text not null,
  category public.inventory_category not null default 'other',
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists value_events_household_time_idx
  on public.value_events (household_id, occurred_at desc);

alter table public.value_events enable row level security;

create policy "value_events_select_member"
  on public.value_events for select
  using ((select public.is_household_member(household_id)));

create policy "value_events_insert_member"
  on public.value_events for insert
  with check (
    (select public.is_household_member(household_id))
    and (created_by is null or created_by = (select auth.uid()))
  );
