-- Per-user recipe favorites. Replaces the shared recipes.is_favorite flag,
-- which made one member's favorite show up for everyone in the household.

create table public.recipe_favorites (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);

create index recipe_favorites_user_idx
  on public.recipe_favorites (user_id, created_at desc);

alter table public.recipe_favorites enable row level security;

create policy "recipe_favorites_select_self"
  on public.recipe_favorites
  for select
  using (user_id = auth.uid());

create policy "recipe_favorites_insert_self"
  on public.recipe_favorites
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_household_member(r.household_id)
    )
  );

create policy "recipe_favorites_delete_self"
  on public.recipe_favorites
  for delete
  using (user_id = auth.uid());

-- Carry over existing favorites to the recipe's creator.
insert into public.recipe_favorites (recipe_id, user_id)
select id, generated_by
from public.recipes
where is_favorite = true
on conflict do nothing;
