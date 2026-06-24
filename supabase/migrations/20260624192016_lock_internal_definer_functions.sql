-- Lock internal SECURITY DEFINER plumbing away from the public PostgREST RPC
-- endpoint. These are trigger helpers / internal calls — never client-facing.
-- invoke_edge_fn is the critical one: it posts to any edge function with the
-- service_role key, so anon/authenticated must not be able to reach it.
-- Triggers fire as the table owner regardless of these EXECUTE grants.
revoke execute on function public.invoke_edge_fn(text, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.on_inventory_insert_notify() from public, anon, authenticated;
revoke execute on function public.mark_free_receipt_scan_used() from public, anon, authenticated;
revoke execute on function public.mark_free_recipe_generation_used() from public, anon, authenticated;
