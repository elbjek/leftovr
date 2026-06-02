set check_function_bodies = off;

-- Server-side mirror of the barcode scan gate (design §2):
-- inserting a barcode-sourced inventory item requires premium, EXCEPT during
-- onboarding (household's first_fill_completed_at is null). Manual, receipt, and
-- moved_from_household inserts are unaffected.
-- Restrictive: AND-ed with the existing permissive inventory_items_all_member policy.
create policy "inventory_items_barcode_premium_or_onboarding"
  on public.inventory_items
  as restrictive
  for insert
  to authenticated
  with check (
    source <> 'barcode'
    or public.is_premium()
    or exists (
      select 1
      from public.households h
      where h.id = inventory_items.household_id
        and h.first_fill_completed_at is null
    )
  );
