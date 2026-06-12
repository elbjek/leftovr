-- Real receipt normalization pipeline: image storage, edge-function attempt
-- tracking on receipt_scans, and the per-store-chain line normalization cache.

alter table public.receipt_scans
  add column image_path text,
  add column prompt_tokens integer;

-- Normalization cache: receipt line text is highly repetitive per store chain,
-- so cache the canonical item per (store_chain, raw_line_text). Hits override
-- model output for deterministic normalization; misses are written back only
-- when model confidence is high. Service-role only — no client policies.
create table public.receipt_line_cache (
  id uuid primary key default gen_random_uuid(),
  store_chain text not null,
  raw_line_text text not null,
  name text not null,
  normalized_name text not null,
  category text not null,
  quantity numeric,
  unit text,
  net_amount numeric,
  net_unit text,
  confidence numeric not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (store_chain, raw_line_text)
);

alter table public.receipt_line_cache enable row level security;

-- Hit bookkeeping in one statement (edge function calls this with service role).
create or replace function public.bump_receipt_line_cache_hits(
  p_store_chain text,
  p_raw_lines text[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.receipt_line_cache
  set hit_count = hit_count + 1,
      last_seen_at = now()
  where store_chain = p_store_chain
    and raw_line_text = any(p_raw_lines);
$$;

revoke execute on function public.bump_receipt_line_cache_hits(text, text[]) from public, anon, authenticated;

-- Private bucket for receipt photos, one folder per household.
insert into storage.buckets (id, name, public)
values ('receipt-images', 'receipt-images', false);

create policy "receipt_images_member_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'receipt-images'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy "receipt_images_member_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'receipt-images'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
