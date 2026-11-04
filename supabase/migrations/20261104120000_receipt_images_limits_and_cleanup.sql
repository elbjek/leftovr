-- receipt-images abuse guards.
-- 1. The bucket had no size or type limit, so any member could upload large
--    files of any type into their household folder. The app only ever uploads
--    camera JPEGs and e-receipt PDFs; 10 MB is far above either.
-- 2. Files are deleted only by the scan functions, and clients can't delete
--    (no storage DELETE policy), so an upload that is never scanned stayed
--    forever. An hourly job removes uploads older than an hour; a real scan
--    downloads and deletes its file within minutes of the upload.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'application/pdf']
where id = 'receipt-images';

-- Names of receipt-images objects older than an hour, for the cleanup edge
-- function to remove through the Storage API (deleting storage.objects rows
-- directly would leave the file bytes behind).
create or replace function public.stale_receipt_uploads(p_limit integer default 1000)
returns setof text
language sql
security definer
set search_path = ''
as $$
  select name
  from storage.objects
  where bucket_id = 'receipt-images'
    and created_at < now() - interval '1 hour'
  order by created_at
  limit p_limit
$$;

revoke execute on function public.stale_receipt_uploads(integer) from public, anon, authenticated;
grant execute on function public.stale_receipt_uploads(integer) to service_role;

select cron.schedule(
  'cleanup-receipt-images-hourly',
  '17 * * * *',
  $$ select public.invoke_edge_fn('cleanup-receipt-images', '{}'::jsonb) $$
);
