import { createClient } from "npm:@supabase/supabase-js@^2.46.1";
import { sendPush } from "../_shared/sendPush.ts";
import { coalesceOpen } from "../_shared/notificationRules.ts";

const COALESCE_MIN = 10;

// Invoked by the inventory_items AFTER INSERT trigger via pg_net.
// Body: { household_id, actor_id, count }
Deno.serve(async (req) => {
  // Service-role only: invoked by the inventory trigger via pg_net with the
  // service key. A valid user JWT alone (verify_jwt gateway) is not enough —
  // require the service-role bearer so users can't spoof activity pushes.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { household_id, actor_id, count } = await req.json();
  if (!household_id || !actor_id) return Response.json({ ok: false }, { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );
  const now = new Date();

  // Only shared (household_premium) households have an "other member" to notify.
  const { data: household } = await supabase
    .from("households").select("plan_tier").eq("id", household_id).single();
  if (household?.plan_tier !== "household_premium") return Response.json({ ok: true, skipped: "not_shared" });

  // Coalesce: skip if this household already triggered a member_activity push recently.
  const { data: recent } = await supabase
    .from("notification_sends").select("sent_at")
    .eq("household_id", household_id).eq("type", "member_activity")
    .order("sent_at", { ascending: false }).limit(1);
  if (!coalesceOpen(recent?.[0]?.sent_at ?? null, now, COALESCE_MIN)) {
    return Response.json({ ok: true, skipped: "coalesced" });
  }

  const { data: actor } = await supabase
    .from("profiles").select("display_name").eq("id", actor_id).single();
  const name = actor?.display_name ?? "Someone";

  // Other members with a token + not muted.
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, notification_preferences!inner(push_token, notifications_enabled, member_activity_enabled)")
    .eq("household_id", household_id).eq("status", "active").neq("user_id", actor_id);

  const tokens: string[] = [], userIds: string[] = [];
  for (const m of members ?? []) {
    const p = (m as any).notification_preferences;
    if (p?.push_token && p?.notifications_enabled && p?.member_activity_enabled) { tokens.push(p.push_token); userIds.push(m.user_id); }
  }
  if (tokens.length === 0) return Response.json({ ok: true, skipped: "no_targets" });

  const n = Number(count) || 1;
  const dead = await sendPush(tokens, {
    title: "Fridge updated",
    body: `${name} added ${n} item${n === 1 ? "" : "s"} to the fridge.`,
    data: { type: "member_activity", household_id },
  });

  await supabase.from("notification_sends").insert(
    userIds.map((user_id) => ({ user_id, household_id, type: "member_activity", sent_at: now.toISOString() })),
  );
  for (const token of dead) {
    await supabase.from("notification_preferences").update({ push_token: null }).eq("push_token", token);
  }
  return Response.json({ ok: true, sent: tokens.length });
});
