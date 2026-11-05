-- Recipe covers: a top-down photo per recipe, made by the recipe-cover edge
-- function with OpenAI and shared across households by dish.
-- * recipes.dish_key: a short generic English dish name the card AI returns
--   ("tomato pasta"). Similar recipes share it, so they share covers.
-- * recipe_covers: up to three photos per dish (variant 0-2, each its own
--   surface and light), so a common dish doesn't look the same everywhere.
--   Service role only: clients read recipes.cover_path, never this table.
-- * recipe-covers bucket: public read (a photo of food holds nothing
--   personal); only the edge function writes.

alter table public.recipes
  add column dish_key text check (dish_key is null or char_length(dish_key) <= 60),
  add column cover_path text;

create table public.recipe_covers (
  dish_key text not null,
  variant smallint not null check (variant between 0 and 2),
  path text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (dish_key, variant)
);

alter table public.recipe_covers enable row level security;
revoke all on public.recipe_covers from anon, authenticated;

create index recipe_covers_created_by_idx on public.recipe_covers (created_by, created_at);

-- Each new cover is a paid image: at most 40 per user per day.
create trigger recipe_covers_daily_ceiling
  before insert on public.recipe_covers
  for each row execute function public.enforce_daily_usage_ceiling('created_by', '40');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-covers', 'recipe-covers', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
