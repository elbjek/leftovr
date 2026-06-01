-- Precise magnitude tracking: optional metric net amount per inventory lot.
-- net_unit is canonical metric only (ml | g). Both null = rough item.
alter table public.inventory_items
  add column net_amount numeric(10, 2)
    check (net_amount is null or net_amount > 0),
  add column net_unit text
    check (net_unit is null or net_unit in ('ml', 'g')),
  add constraint inventory_items_net_paired
    check ((net_amount is null) = (net_unit is null));
