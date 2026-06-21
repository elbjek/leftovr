-- Anonymized retention record written when a user deletes their account.
-- Holds NO personal data (no name, no email) — only the id and non-identifying
-- stats kept for product analytics. Service-role only: RLS on, no policies, so
-- clients can never read or write it.

create table if not exists public.deleted_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  deleted_at timestamptz not null default now(),
  account_created_at timestamptz,
  tier text,
  language text,
  primary_goal text,
  shopping_style text,
  onboarding_completed boolean,
  household_count integer not null default 0,
  inventory_item_count integer not null default 0,
  recipe_count integer not null default 0
);

alter table public.deleted_accounts enable row level security;
