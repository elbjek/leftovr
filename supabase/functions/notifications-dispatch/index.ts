import { createClient } from "npm:@supabase/supabase-js@^2.46.1";
import { sendPush } from "../_shared/sendPush.ts";
import {
  isWithinSendWindow, isRecapDay, sentToday, buildDailySuggestion, toUrgencyGroups,
} from "../_shared/notificationRules.ts";

// Hourly cron entrypoint. Guarded by CRON_SECRET (shared with the Vault
// `cron_secret` used by invoke_edge_fn) so a logged-in user can't trigger the
// whole dispatch batch on demand. Not the service-role key: that env var's
// format changed under us once (JWT → sb_secret) and silently broke the
// compare; a dedicated secret has no such coupling.
Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );
  const now = new Date();
  const results: Record<string, number> = { daily: 0, recap: 0, eatfirst: 0, topup: 0, reengagement: 0 };

  // --- Household premium rules: daily + recap ---
  const { data: households } = await supabase
    .from("household_notification_settings")
    .select("household_id, daily_suggestion_enabled, recap_enabled, send_window_start, send_window_end, timezone, households!inner(plan_tier)")
    .or("daily_suggestion_enabled.eq.true,recap_enabled.eq.true");

  for (const h of households ?? []) {
    const tier = (h as any).households?.plan_tier;
    if (tier !== "premium" && tier !== "household_premium") continue;
    if (!isWithinSendWindow(now, h.send_window_start, h.send_window_end, h.timezone)) continue;

    const recap = isRecapDay(now, h.timezone);
    // Daily and weekly recap are independently opt-out-able.
    if (recap && !h.recap_enabled) continue;
    if (!recap && !h.daily_suggestion_enabled) continue;
    const type = recap ? "recap" : "daily";

    const { data: members } = await supabase
      .from("household_members")
      .select("user_id, profiles!inner(primary_goal), notification_preferences!inner(push_token, notifications_enabled)")
      .eq("household_id", h.household_id)
      .eq("status", "active");

    // One suggestion per household, not per person.
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("name, expires_at")
      .eq("household_id", h.household_id)
      .is("removed_at", null);
    const groups = toUrgencyGroups(inv ?? [], now);
    const goal = (members?.[0] as any)?.profiles?.primary_goal ?? null;
    const payload = recap
      ? { title: "Your week with leftovr", body: "See what you used and saved this week.", data: { type } }
      : buildDailyPayload(groups, goal);
    if (!payload) continue;

    const tokens: string[] = [];
    const sendUserIds: string[] = [];
    for (const m of members ?? []) {
      const prefs = (m as any).notification_preferences;
      if (!prefs?.push_token || !prefs?.notifications_enabled) continue;
      const { data: rows } = await supabase
        .from("notification_sends")
        .select("sent_at")
        .eq("user_id", m.user_id)
        .gte("sent_at", startOfDayUtcFloor(now));
      if (sentToday(rows ?? [], now, h.timezone)) continue; // 1/user/day cap
      tokens.push(prefs.push_token);
      sendUserIds.push(m.user_id);
    }
    if (tokens.length === 0) continue;

    const dead = await sendPush(tokens, payload);
    await recordSends(supabase, sendUserIds, h.household_id, type, now);
    await nullDeadTokens(supabase, dead);
    results[type] += tokens.length;
  }

  // --- Smart "eat first" pushes (per-user opt-in) ---
  results.eatfirst = await runEatFirst(supabase, now);

  // --- Free rules: top-up + re-engagement ---
  results.topup = await runTopUp(supabase, now);
  results.reengagement = await runReengagement(supabase, now);

  return Response.json({ ok: true, results });
});

function buildDailyPayload(groups: { name: string; urgency: string }[], goal: string | null) {
  const s = buildDailySuggestion(groups, goal);
  return s ? { title: s.title, body: s.body, data: { type: "daily", items: s.items } } : null;
}

// Coarse UTC floor for the notification_sends query; sentToday filters precisely by tz.
function startOfDayUtcFloor(now: Date): string {
  return new Date(now.getTime() - 36 * 3600 * 1000).toISOString();
}

async function recordSends(supabase: any, userIds: string[], householdId: string | null, type: string, now: Date) {
  if (userIds.length === 0) return;
  const { error } = await supabase.from("notification_sends").insert(
    userIds.map((user_id) => ({ user_id, household_id: householdId, type, sent_at: now.toISOString() })),
  );
  // An unrecorded send silently breaks dedup and the daily cap — surface it.
  if (error) console.error(`notification_sends insert failed (${type}):`, error.message);
}

async function nullDeadTokens(supabase: any, dead: string[]) {
  for (const token of dead) {
    await supabase.from("notification_preferences").update({ push_token: null }).eq("push_token", token);
  }
}

// Per-user "eat first" nudge: users who opted in get one push when their
// household has items expiring today. Premium-only, respects the household send
// window, and shares the global 1-notification/user/day cap with the daily
// suggestion (daily wins when both could fire on the same day).
async function runEatFirst(supabase: any, now: Date): Promise<number> {
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, push_token, profiles!inner(active_household_id)")
    .eq("smart_suggestions_enabled", true)
    .eq("notifications_enabled", true)
    .not("push_token", "is", null);

  let count = 0;
  for (const p of prefs ?? []) {
    const householdId = (p as any).profiles?.active_household_id;
    if (!householdId) continue;

    const { data: hs } = await supabase
      .from("household_notification_settings")
      .select("send_window_start, send_window_end, timezone, households!inner(plan_tier)")
      .eq("household_id", householdId)
      .maybeSingle();
    if (!hs) continue;
    const tier = (hs as any).households?.plan_tier;
    if (tier !== "premium" && tier !== "household_premium") continue;
    if (!isWithinSendWindow(now, hs.send_window_start, hs.send_window_end, hs.timezone)) continue;

    // Global 1/user/day cap (no type filter) — daily suggestion shares it.
    const { data: rows } = await supabase
      .from("notification_sends")
      .select("sent_at")
      .eq("user_id", p.user_id)
      .gte("sent_at", startOfDayUtcFloor(now));
    if (sentToday(rows ?? [], now, hs.timezone)) continue;

    const { data: inv } = await supabase
      .from("inventory_items")
      .select("name, expires_at")
      .eq("household_id", householdId)
      .is("removed_at", null);
    const urgent = toUrgencyGroups(inv ?? [], now).filter((g) => g.urgency === "urgent");
    if (urgent.length === 0) continue;

    const names = urgent.slice(0, 3).map((g) => g.name);
    const dead = await sendPush([p.push_token], {
      title: "Eat these first",
      body: `${names.join(", ")} ${urgent.length > 1 ? "need" : "needs"} using today.`,
      data: { type: "eatfirst", items: names },
    });
    await recordSends(supabase, [p.user_id], householdId, "eatfirst", now);
    await nullDeadTokens(supabase, dead);
    count += 1;
  }
  return count;
}

async function runTopUp(supabase: any, now: Date): Promise<number> {
  // Households created 3-7 days ago with <2 completed scans, never sent a topup.
  const since = new Date(now.getTime() - 7 * 86400000).toISOString();
  const until = new Date(now.getTime() - 3 * 86400000).toISOString();
  const { data: households } = await supabase
    .from("households")
    .select("id, created_at")
    .gte("created_at", since)
    .lte("created_at", until);
  let count = 0;
  for (const h of households ?? []) {
    const { count: scans } = await supabase
      .from("receipt_scans").select("id", { count: "exact", head: true })
      .eq("household_id", h.id).eq("status", "completed").eq("scan_type", "receipt");
    if ((scans ?? 0) >= 2) continue;
    const { data: already } = await supabase
      .from("notification_sends").select("id").eq("household_id", h.id).eq("type", "topup").limit(1);
    if ((already ?? []).length > 0) continue;
    count += await pushToHousehold(supabase, h.id, now, "topup",
      { title: "Keep your suggestions sharp", body: "Scan a receipt so leftovr knows what you have.", data: { type: "topup" } });
  }
  return count;
}

async function runReengagement(supabase: any, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - 5 * 86400000).toISOString();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, notification_preferences!inner(push_token, notifications_enabled, reengagement_enabled)")
    .lt("last_active_at", cutoff);
  let count = 0;
  for (const u of users ?? []) {
    const prefs = (u as any).notification_preferences;
    const token = prefs?.push_token;
    if (!token || !prefs?.notifications_enabled || !prefs?.reengagement_enabled) continue;
    const { data: recent } = await supabase
      .from("notification_sends").select("id")
      .eq("user_id", u.id).eq("type", "reengagement").gte("sent_at", cutoff).limit(1);
    if ((recent ?? []).length > 0) continue;
    const dead = await sendPush([token], { title: "What's for dinner?", body: "Open leftovr for a quick idea from what you have.", data: { type: "reengagement" } });
    await recordSends(supabase, [u.id], null, "reengagement", now);
    await nullDeadTokens(supabase, dead);
    count += 1;
  }
  return count;
}

// Only used by top-up — gate by the master switch + the per-user tips opt-out.
async function pushToHousehold(supabase: any, householdId: string, now: Date, type: string, payload: any): Promise<number> {
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, notification_preferences!inner(push_token, notifications_enabled, tips_enabled)")
    .eq("household_id", householdId).eq("status", "active");
  const tokens: string[] = [], userIds: string[] = [];
  for (const m of members ?? []) {
    const p = (m as any).notification_preferences;
    if (p?.push_token && p?.notifications_enabled && p?.tips_enabled) { tokens.push(p.push_token); userIds.push(m.user_id); }
  }
  if (tokens.length === 0) return 0;
  const dead = await sendPush(tokens, payload);
  await recordSends(supabase, userIds, householdId, type, now);
  await nullDeadTokens(supabase, dead);
  return tokens.length;
}
