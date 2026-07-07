-- Fix: pg_net's function lives in schema `net` (net.http_post), not
-- `extensions.net.http_post`. The latter is a 3-part name Postgres treats as a
-- cross-database reference ("cross-database references are not implemented"),
-- which broke every insert that fires the member-activity trigger once the
-- service_role_key secret was set.

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
  perform net.http_post(
    url := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := body
  );
end $$;
