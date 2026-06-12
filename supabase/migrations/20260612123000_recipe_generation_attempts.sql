create table public.recipe_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  response_json jsonb,
  error_message text,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost_cents integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create index recipe_generation_attempts_user_created_idx
  on public.recipe_generation_attempts (user_id, created_at desc);

create index recipe_generation_attempts_household_created_idx
  on public.recipe_generation_attempts (household_id, created_at desc);

alter table public.recipe_generation_attempts enable row level security;

create policy "recipe_generation_attempts_select_own"
  on public.recipe_generation_attempts
  for select
  to authenticated
  using (user_id = (select auth.uid()));
