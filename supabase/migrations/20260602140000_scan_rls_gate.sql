set check_function_bodies = off;

-- Server-side mirror of the scan gate (design §2):
-- inserting a receipt scan requires premium, EXCEPT during onboarding
-- (the household's first_fill_completed_at is still null = one free simulated scan).
-- Restrictive: AND-ed with the existing permissive receipt_scans_all_member policy.
create policy "receipt_scans_insert_premium_or_onboarding"
  on public.receipt_scans
  as restrictive
  for insert
  to authenticated
  with check (
    public.is_premium()
    or exists (
      select 1
      from public.households h
      where h.id = receipt_scans.household_id
        and h.first_fill_completed_at is null
    )
  );
