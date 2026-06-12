-- One-free-taste gating (replaces the 3-recipe-sessions-per-week free rule):
-- every user gets exactly one free receipt scan and one free recipe generation
-- (lifetime, per user). From the second attempt onward both are premium.
-- Flags live on profiles and are stamped by security-definer triggers on first
-- insert, so clients cannot reset them (profiles column-level UPDATE grants
-- from the S1 hardening migration do not include these columns).

alter table public.profiles
  add column free_receipt_scan_used_at timestamptz,
  add column free_recipe_generation_used_at timestamptz;

-- Stamp the creator's free-scan flag on their first receipt scan.
create or replace function public.mark_free_receipt_scan_used()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set free_receipt_scan_used_at = now()
  where id = new.created_by
    and free_receipt_scan_used_at is null;
  return new;
end;
$$;

create trigger receipt_scans_mark_free_use
  after insert on public.receipt_scans
  for each row execute function public.mark_free_receipt_scan_used();

-- Stamp the generator's free-generation flag on their first recipe session.
create or replace function public.mark_free_recipe_generation_used()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set free_recipe_generation_used_at = now()
  where id = new.generated_by
    and free_recipe_generation_used_at is null;
  return new;
end;
$$;

create trigger recipe_sessions_mark_free_use
  after insert on public.recipe_sessions
  for each row execute function public.mark_free_recipe_generation_used();

-- Backfill: users who already scanned/generated have used their free taste.
update public.profiles p
set free_receipt_scan_used_at = s.first_scan
from (
  select created_by, min(created_at) as first_scan
  from public.receipt_scans
  group by created_by
) s
where p.id = s.created_by
  and p.free_receipt_scan_used_at is null;

update public.profiles p
set free_recipe_generation_used_at = s.first_session
from (
  select generated_by, min(created_at) as first_session
  from public.recipe_sessions
  group by generated_by
) s
where p.id = s.generated_by
  and p.free_recipe_generation_used_at is null;

-- Receipt scans: premium OR the user's one free scan is still unused.
drop policy "receipt_scans_insert_premium" on public.receipt_scans;
create policy "receipt_scans_insert_premium_or_first"
  on public.receipt_scans
  as restrictive
  for insert
  to authenticated
  with check (
    (select public.is_premium())
    or (
      select p.free_receipt_scan_used_at
      from public.profiles p
      where p.id = (select auth.uid())
    ) is null
  );

-- Recipe sessions: premium OR the user's one free generation is still unused.
-- (Replaces the client-only weekly limit; this is the server-side gate.)
create policy "recipe_sessions_insert_premium_or_first"
  on public.recipe_sessions
  as restrictive
  for insert
  to authenticated
  with check (
    (select public.is_premium())
    or (
      select p.free_recipe_generation_used_at
      from public.profiles p
      where p.id = (select auth.uid())
    ) is null
  );
