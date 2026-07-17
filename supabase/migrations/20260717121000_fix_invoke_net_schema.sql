-- Fix invoke_edge_fn: pg_net lives in the `net` schema; the previous
-- migration qualified it as `extensions.net.http_post`, which Postgres reads
-- as a cross-database reference and rejects at call time.

create or replace function public.invoke_edge_fn(fn_name text, body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  cron_secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'cron_secret';
  if base_url is null or cron_secret is null then
    return; -- secrets not configured yet; no-op rather than error
  end if;
  perform net.http_post(
    url := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := body
  );
end $$;
