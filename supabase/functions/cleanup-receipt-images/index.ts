import { createClient } from "npm:@supabase/supabase-js@^2.46.1";

// Hourly cron entrypoint (cleanup-receipt-images-hourly). Removes receipt and
// pantry uploads that no scan ever picked up: the scan functions delete their
// file within minutes, and clients can't delete, so anything older than an
// hour is an abandoned or abusive upload. Guarded by CRON_SECRET, like
// notifications-dispatch, so a logged-in user can't trigger it.
Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: names, error } = await supabase.rpc("stale_receipt_uploads", { p_limit: 1000 });
  if (error) {
    console.error("[cleanup-receipt-images] listing failed", error);
    return Response.json({ error: "list_failed" }, { status: 500 });
  }

  // ponytail: up to 1000 files an hour; a backlog drains over a few runs.
  const paths = (names ?? []) as string[];
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error: removeError } = await supabase.storage.from("receipt-images").remove(batch);
    if (removeError) {
      console.error("[cleanup-receipt-images] remove failed", removeError);
      continue;
    }
    removed += batch.length;
  }

  console.info("[cleanup-receipt-images] removed", { found: paths.length, removed });
  return Response.json({ removed });
});
