-- Liquids are tracked as "have it / don't": no millilitres anywhere.
-- Existing volume lots lose their net amount and fall back to the count.

-- The price basis must move with it. purchase_amount held the ml the price
-- covered; with no net amount left, lotRemainingValue() and apply_cook read
-- the count instead, so a 1 L bottle would otherwise be valued at 1/1000th
-- of its price.
update public.inventory_items
set purchase_amount = quantity
where net_unit = 'ml' and purchase_amount is not null;

update public.inventory_items
set net_amount = null, net_unit = null
where net_unit = 'ml';

alter table public.inventory_items
  drop constraint if exists inventory_items_net_unit_check;

alter table public.inventory_items
  add constraint inventory_items_net_unit_check
    check (net_unit is null or net_unit = 'g');

-- Rows whose unit was itself a volume ("600 ml") become one countable pack.
update public.inventory_items
set quantity = 1, unit = 'bottle'
where lower(btrim(unit)) in ('l', 'lit', 'litar', 'liter', 'litre', 'ml', 'dl', 'cl');
