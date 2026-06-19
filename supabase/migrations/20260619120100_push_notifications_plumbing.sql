-- Invoke edge functions from Postgres (cron + triggers) via pg_net + Vault.
create extension if not exists pg_net with schema extensions;

-- project_url secret; service_role_key must be set out-of-band (see plan manual steps).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret('https://pctnbnfxmxljujkyzcmr.supabase.co', 'project_url');
  end if;
end $$;

create or replace function public.invoke_edge_fn(fn_name text, body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or service_key is null then
    return; -- secrets not configured yet; no-op rather than error
  end if;
  perform extensions.net.http_post(
    url := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := body
  );
end $$;

-- Member-activity: notify other members whenever items are added (any path).
create or replace function public.on_inventory_insert_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.invoke_edge_fn(
    'notify-member-activity',
    jsonb_build_object(
      'household_id', new.household_id,
      'actor_id', new.added_by,
      'count', 1
    )
  );
  return new;
end $$;

create trigger inventory_items_notify_member_activity
  after insert on public.inventory_items
  for each row execute function public.on_inventory_insert_notify();

-- Hourly scheduled dispatch.
select cron.schedule(
  'notifications-dispatch-hourly',
  '0 * * * *',
  $$ select public.invoke_edge_fn('notifications-dispatch', '{}'::jsonb) $$
);
