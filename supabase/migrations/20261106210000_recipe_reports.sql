-- App Review guideline 1.2 asks apps that generate content to give people a
-- way to flag what the generator got wrong. Recipes here never leave a
-- household of at most three people, so this is a signal for us, not a
-- moderation queue: a row, nothing else. No email, no takedown path, no
-- surface in the app that reads it back.

create table public.recipe_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  reason text check (reason is null or length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index recipe_reports_created_idx on public.recipe_reports (created_at desc);
-- One report per person per recipe: tapping twice is a double tap, not two
-- complaints, and it keeps the table from being a write amplifier.
create unique index recipe_reports_unique_per_user
  on public.recipe_reports (recipe_id, reported_by);

alter table public.recipe_reports enable row level security;

-- Insert only, and only about a recipe in a household you belong to. Nobody
-- reads these from the client, not even their own: a report is a one-way
-- message to us, and leaving select off means a member cannot see what another
-- member flagged.
create policy "recipe_reports_insert_member"
  on public.recipe_reports
  for insert
  to authenticated
  with check (
    (select public.is_household_member(household_id))
    and reported_by = (select auth.uid())
  );

grant insert on table public.recipe_reports to authenticated;
