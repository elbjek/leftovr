-- FIXES A4: generate-recipes mode "expand" had no quota — any signed-in user
-- got unlimited AI recipes. One row per expand call; the edge fn (service
-- role) counts a user's last 24h before calling the model. Clients have no
-- access.

create table public.recipe_expand_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index recipe_expand_events_user_created_idx
  on public.recipe_expand_events (user_id, created_at desc);

alter table public.recipe_expand_events enable row level security;
revoke all on table public.recipe_expand_events from anon, authenticated;
