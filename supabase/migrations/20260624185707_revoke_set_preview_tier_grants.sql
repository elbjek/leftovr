-- Close the preview-tier self-grant hole: only the RevenueCat webhook
-- (service_role) may set tiers. Postgres grants EXECUTE to PUBLIC by default on
-- function creation, so revoke from PUBLIC as well as anon/authenticated.
revoke execute on function public.set_preview_tier(public.plan_tier) from public;
revoke execute on function public.set_preview_tier(public.plan_tier) from anon;
revoke execute on function public.set_preview_tier(public.plan_tier) from authenticated;
