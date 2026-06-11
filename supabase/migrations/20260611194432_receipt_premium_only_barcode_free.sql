-- Pricing decision: receipt scanning carries a real per-scan AI cost, so it is
-- premium-only with NO free onboarding scan. Barcode lookups hit the free
-- OpenFoodFacts API, so barcode-sourced items are free for everyone (as is
-- manual entry). Replaces the premium-or-onboarding gates from
-- 20260602140000/20260602150000.

-- Receipt scans: premium only.
drop policy "receipt_scans_insert_premium_or_onboarding" on public.receipt_scans;
create policy "receipt_scans_insert_premium"
  on public.receipt_scans
  as restrictive
  for insert
  to authenticated
  with check ((select public.is_premium()));

-- Barcode items: free — drop the gate entirely.
drop policy "inventory_items_barcode_premium_or_onboarding" on public.inventory_items;
