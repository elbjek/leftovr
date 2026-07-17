-- invoke_edge_fn authenticated with a dedicated Vault `cron_secret` instead of
-- the service-role key. The service key's format changed (legacy JWT →
-- sb_secret) which broke the string compare in the target functions and 403'd
-- every scheduled dispatch; a dedicated secret is decoupled from key rotation.
-- The `cron_secret` Vault value and the matching CRON_SECRET edge-function
-- secret are set out-of-band (never committed).

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
  perform extensions.net.http_post(
    url := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := body
  );
end $$;
