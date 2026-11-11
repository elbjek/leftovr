-- Shopping list (2026-11-11). One list per household: anyone can add or tick.
-- Foods that reach the kitchen (receipt, pantry photo, barcode or manual add)
-- tick their list item automatically. "Buy again" suggestions are computed
-- from purchase history, never stored. A reminder push goes out on the
-- household's chosen weekdays at the chosen hour (free, per-member opt-out).

create table public.shopping_list_items (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  -- canonicalFoodName(name) from the client, same as inventory_items.
  normalized_name text not null check (length(normalized_name) between 1 and 80),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);

create index shopping_list_items_household_idx
  on public.shopping_list_items (household_id, checked_at);

alter table public.shopping_list_items enable row level security;

create policy "shopping_list_items_select_member"
  on public.shopping_list_items for select to authenticated
  using ((select public.is_household_member(household_id)));

create policy "shopping_list_items_insert_member"
  on public.shopping_list_items for insert to authenticated
  with check (
    (select public.is_household_member(household_id))
    and added_by = (select auth.uid())
  );

create policy "shopping_list_items_update_member"
  on public.shopping_list_items for update to authenticated
  using ((select public.is_household_member(household_id)))
  with check ((select public.is_household_member(household_id)));

create policy "shopping_list_items_delete_member"
  on public.shopping_list_items for delete to authenticated
  using ((select public.is_household_member(household_id)));

-- Default privileges grant everything; narrow it.
revoke all on table public.shopping_list_items from anon, authenticated;
grant select, insert, delete on table public.shopping_list_items to authenticated;
-- Ticking is the only client update; household and author stay put.
grant update (checked_at) on table public.shopping_list_items to authenticated;

-- Reminder schedule (household) and opt-out (member).
alter table public.household_notification_settings
  add column shopping_reminder_days smallint[] not null default '{}'
    check (shopping_reminder_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  add column shopping_reminder_hour smallint not null default 10
    check (shopping_reminder_hour between 0 and 23);

alter table public.notification_preferences
  add column shopping_reminders_enabled boolean not null default true;

alter table public.notification_sends drop constraint notification_sends_type_check;
alter table public.notification_sends add constraint notification_sends_type_check
  check (type in ('daily','recap','topup','reengagement','member_activity','eatfirst','streak','member_cooked','member_change','shopping'));

-- A food reaching the kitchen ticks the matching open list items: the same
-- canonical name, or the list name as whole words inside the new one ("milk"
-- is ticked by "whole milk", "egg" is not ticked by "eggplant").
-- ponytail: word match only, so "egg" is not ticked by "eggs"; add plural
-- folding if people complain.
create function public.tick_shopping_list_on_add()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shopping_list_items s
     set checked_at = now()
   where s.household_id = new.household_id
     and s.checked_at is null
     and (
       s.normalized_name = new.normalized_name
       or new.normalized_name ~ (
         '\m' || regexp_replace(s.normalized_name, '([^[:alnum:][:space:]])', '\\\1', 'g') || '\M'
       )
     );
  return null;
end;
$$;

revoke execute on function public.tick_shopping_list_on_add() from public, anon, authenticated;

create trigger tick_shopping_list_on_add
  after insert on public.inventory_items
  for each row execute function public.tick_shopping_list_on_add();

-- "Buy again": foods added on 2+ different days in the last 90 days, used up
-- (not thrown out) in the last 30 days, with nothing of them left in the
-- kitchen and not already on the list. Security invoker: a member's RLS scopes
-- it to their own households; the dispatcher calls it as service role.
create function public.buy_again(p_household uuid, p_limit int default 8)
returns table (name text, normalized_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  with per_food as (
    select
      i.normalized_name,
      (array_agg(i.name order by i.added_at desc))[1] as name,
      count(distinct (i.added_at at time zone 'UTC')::date) as buys,
      (array_agg(i.removal_reason order by i.removed_at desc nulls first))[1] as last_reason,
      max(i.removed_at) as last_removed
    from public.inventory_items i
    where i.household_id = p_household
      and i.added_at > now() - interval '90 days'
    group by i.normalized_name
  )
  select p.name, p.normalized_name
  from per_food p
  where p.buys >= 2
    and p.last_removed > now() - interval '30 days'
    and coalesce(p.last_reason, '') <> 'discarded'
    and not exists (
      select 1 from public.inventory_items a
      where a.household_id = p_household
        and a.normalized_name = p.normalized_name
        and a.removed_at is null
    )
    and not exists (
      select 1 from public.shopping_list_items s
      where s.household_id = p_household
        and s.checked_at is null
        and s.normalized_name = p.normalized_name
    )
  order by p.buys desc, p.last_removed desc
  limit least(greatest(p_limit, 0), 20);
$$;

revoke execute on function public.buy_again(uuid, int) from public, anon;
grant execute on function public.buy_again(uuid, int) to authenticated, service_role;
