import { createClient } from "npm:@supabase/supabase-js@^2.46.1";
import { sendPush } from "../_shared/sendPush.ts";
import { secretsMatch } from "../_shared/secrets.ts";
import { copy, Lang, Payload, toLang } from "../_shared/pushCopy.ts";
import {
  isWithinSendWindow, isRecapDay, sentToday, buildDailySuggestion, toUrgencyGroups,
  isStreakReminderHour, buildStreakReminder, isShoppingReminderTime,
} from "../_shared/notificationRules.ts";

// Hourly cron entrypoint. Guarded by CRON_SECRET (shared with the Vault
// `cron_secret` used by invoke_edge_fn) so a logged-in user can't trigger the
// whole dispatch batch on demand. Not the service-role key: that env var's
// format changed under us once (JWT → sb_secret) and silently broke the
// compare; a dedicated secret has no such coupling.
Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!secretsMatch(req.headers.get("Authorization"), cronSecret && `Bearer ${cronSecret}`)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );
  const now = new Date();
  const results: Record<string, number> = { daily: 0, recap: 0, eatfirst: 0, topup: 0, reengagement: 0, streak: 0, shopping: 0 };

  // --- Household premium rules: daily + recap ---
  const { data: households } = await supabase
    .from("household_notification_settings")
    .select("household_id, daily_suggestion_enabled, recap_enabled, send_window_start, send_window_end, timezone, households!inner(plan_tier)")
    .or("daily_suggestion_enabled.eq.true,recap_enabled.eq.true");

  for (const h of households ?? []) {
    const householdPremium = (h as any).households?.plan_tier === "household_premium";
    if (!isWithinSendWindow(now, h.send_window_start, h.send_window_end, h.timezone)) continue;

    const recap = isRecapDay(now, h.timezone);
    // Daily and weekly recap are independently opt-out-able.
    if (recap && !h.recap_enabled) continue;
    if (!recap && !h.daily_suggestion_enabled) continue;
    const type = recap ? "recap" : "daily";

    const { data: members } = await supabase
      .from("household_members")
      .select("user_id, profiles!inner(primary_goal, tier, language), notification_preferences!inner(push_token, notifications_enabled)")
      .eq("household_id", h.household_id)
      .eq("status", "active");
    // Premium feature: a member qualifies through the household plan or their
    // own individual Premium (households.plan_tier is never 'premium').
    const eligible = (members ?? []).filter(
      (m) => householdPremium || isPremiumTier((m as any).profiles?.tier),
    );
    if (eligible.length === 0) continue;

    // One suggestion per household, not per person.
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("name, expires_at")
      .eq("household_id", h.household_id)
      .is("removed_at", null);
    const groups = toUrgencyGroups(inv ?? [], now);
    const goal = (eligible[0] as any)?.profiles?.primary_goal ?? null;

    const recipients: Recipient[] = [];
    for (const m of eligible) {
      const prefs = (m as any).notification_preferences;
      if (!prefs?.push_token || !prefs?.notifications_enabled) continue;
      const { data: rows } = await supabase
        .from("notification_sends")
        .select("sent_at")
        .eq("user_id", m.user_id)
        .in("type", CAPPED_TYPES)
        .gte("sent_at", startOfDayUtcFloor(now));
      if (sentToday(rows ?? [], now, h.timezone)) continue; // 1/user/day cap
      recipients.push({ token: prefs.push_token, userId: m.user_id, lang: toLang((m as any).profiles?.language) });
    }
    if (recipients.length === 0) continue;

    // One send per language: the suggestion is the household's, the wording
    // is each member's.
    for (const [lang, group] of byLanguage(recipients)) {
      const payload = recap
        ? { ...copy(lang).recap(), data: { type } }
        : buildDailyPayload(groups, goal, lang);
      if (!payload) continue;
      const dead = await sendPush(group.map((r) => r.token), payload);
      await recordSends(supabase, group.map((r) => r.userId), h.household_id, type, now);
      await nullDeadTokens(supabase, dead);
      results[type] += group.length;
    }
  }

  // --- Smart "eat first" pushes (per-user opt-in) ---
  results.eatfirst = await runEatFirst(supabase, now);

  // --- Free rules: top-up + re-engagement ---
  results.topup = await runTopUp(supabase, now);
  results.reengagement = await runReengagement(supabase, now);

  // --- Evening streak reminder (free, own opt-out) ---
  results.streak = await runStreak(supabase, now);

  // --- Shopping list reminder (free, household schedule, own opt-out) ---
  results.shopping = await runShopping(supabase, now);

  return Response.json({ ok: true, results });
});

// The 1-notification/user/day cap covers the suggestion pushes only. Member
// activity, top-up and re-engagement have their own dedup and must not block
// the daily suggestion (B20).
const CAPPED_TYPES = ["daily", "eatfirst", "recap"];

function isPremiumTier(tier: string | null | undefined) {
  return tier === "premium" || tier === "household_premium";
}

function buildDailyPayload(groups: { name: string; urgency: string }[], goal: string | null, lang: Lang) {
  const s = buildDailySuggestion(groups, goal, lang);
  return s ? { title: s.title, body: s.body, data: { type: "daily", items: s.items } } : null;
}

type Recipient = { token: string; userId: string; lang: Lang };

/** Push payloads are per-language, so a mixed household sends once per language. */
function byLanguage(recipients: Recipient[]): Map<Lang, Recipient[]> {
  const out = new Map<Lang, Recipient[]>();
  for (const r of recipients) {
    const group = out.get(r.lang);
    if (group) group.push(r);
    else out.set(r.lang, [r]);
  }
  return out;
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
    .select("user_id, push_token, profiles!inner(active_household_id, tier, language)")
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
    const householdPremium = (hs as any).households?.plan_tier === "household_premium";
    if (!householdPremium && !isPremiumTier((p as any).profiles?.tier)) continue;
    if (!isWithinSendWindow(now, hs.send_window_start, hs.send_window_end, hs.timezone)) continue;

    // 1/user/day cap across daily + eat-first + recap (CAPPED_TYPES).
    const { data: rows } = await supabase
      .from("notification_sends")
      .select("sent_at")
      .eq("user_id", p.user_id)
      .in("type", CAPPED_TYPES)
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
      ...copy(toLang((p as any).profiles?.language)).eatFirst(names),
      data: { type: "eatfirst", items: names },
    });
    await recordSends(supabase, [p.user_id], householdId, "eatfirst", now);
    await nullDeadTokens(supabase, dead);
    count += 1;
  }
  return count;
}

// Evening "streak at risk" push: the 19:00 hour of the household's day, only
// when nothing has been used up today and the streak is ≥2. Free for
// everyone, its own opt-out, one per user per day, outside the suggestion cap.
async function runStreak(supabase: any, now: Date): Promise<number> {
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, push_token, profiles!inner(active_household_id, language)")
    .eq("streak_reminders_enabled", true)
    .eq("notifications_enabled", true)
    .not("push_token", "is", null);

  let count = 0;
  for (const p of prefs ?? []) {
    const householdId = (p as any).profiles?.active_household_id;
    if (!householdId) continue;

    const { data: hs } = await supabase
      .from("household_notification_settings")
      .select("timezone")
      .eq("household_id", householdId)
      .maybeSingle();
    const tz = hs?.timezone ?? "UTC";
    if (!isStreakReminderHour(now, tz)) continue;

    const { data: rows } = await supabase
      .from("notification_sends")
      .select("sent_at")
      .eq("user_id", p.user_id)
      .eq("type", "streak")
      .gte("sent_at", startOfDayUtcFloor(now));
    if (sentToday(rows ?? [], now, tz)) continue;

    // Read-only: spending and earning freezes happen when the app syncs.
    const { data: state, error } = await supabase.rpc("streak_state", {
      p_user: p.user_id, p_household: householdId, p_tz: tz, p_apply: false,
    });
    if (error) {
      console.error("streak_state failed:", error.message);
      continue;
    }
    if (!state || state.today > 0 || state.streak < 2) continue;

    const { data: inv } = await supabase
      .from("inventory_items")
      .select("name, expires_at")
      .eq("household_id", householdId)
      .is("removed_at", null);
    const urgent = toUrgencyGroups(inv ?? [], now).find((g) => g.urgency === "urgent");

    const dead = await sendPush(
      [p.push_token],
      buildStreakReminder(state.streak, state.freezes, urgent?.name ?? null, toLang((p as any).profiles?.language)),
    );
    await recordSends(supabase, [p.user_id], householdId, "streak", now);
    await nullDeadTokens(supabase, dead);
    count += 1;
  }
  return count;
}

// Shopping reminder: on the household's chosen weekdays at its chosen hour,
// to members who haven't opted out, when the list or "buy again" has
// something. Free, ignores the send window (the user picked the time), one
// per user per local day, outside the suggestion cap.
async function runShopping(supabase: any, now: Date): Promise<number> {
  const { data: households } = await supabase
    .from("household_notification_settings")
    .select("household_id, timezone, shopping_reminder_days, shopping_reminder_hour")
    .neq("shopping_reminder_days", "{}");

  let count = 0;
  for (const h of households ?? []) {
    const tz = h.timezone ?? "UTC";
    if (!isShoppingReminderTime(now, tz, h.shopping_reminder_days ?? [], h.shopping_reminder_hour)) continue;

    // Household items plus each member's own (owner_id): a personal item is
    // only ever named in its owner's push.
    const { data: listed } = await supabase
      .from("shopping_list_items")
      .select("name, owner_id")
      .eq("household_id", h.household_id)
      .is("checked_at", null)
      .order("created_at");
    const { data: again, error } = await supabase.rpc("buy_again", { p_household: h.household_id });
    if (error) console.error("buy_again failed:", error.message);
    const namesFor = (userId: string) =>
      [
        ...(listed ?? []).filter((r: { owner_id: string | null }) => !r.owner_id || r.owner_id === userId),
        ...(again ?? []),
      ].map((r: { name: string }) => r.name);
    if ((listed ?? []).length === 0 && (again ?? []).length === 0) continue;

    const { data: members } = await supabase
      .from("household_members")
      .select("user_id, profiles!inner(language), notification_preferences!inner(push_token, notifications_enabled, shopping_reminders_enabled)")
      .eq("household_id", h.household_id)
      .eq("status", "active");
    const recipients: Recipient[] = [];
    for (const m of members ?? []) {
      const p = (m as any).notification_preferences;
      if (!p?.push_token || !p?.notifications_enabled || !p?.shopping_reminders_enabled) continue;
      const { data: rows } = await supabase
        .from("notification_sends")
        .select("sent_at")
        .eq("user_id", m.user_id)
        .eq("type", "shopping")
        .gte("sent_at", startOfDayUtcFloor(now));
      if (sentToday(rows ?? [], now, tz)) continue;
      if (namesFor(m.user_id).length === 0) continue;
      recipients.push({ token: p.push_token, userId: m.user_id, lang: toLang((m as any).profiles?.language) });
    }

    // One push per recipient: the names differ by personal list.
    // ponytail: per-member sends; batch by identical name lists if households grow large.
    for (const r of recipients) {
      const names = namesFor(r.userId);
      const dead = await sendPush([r.token], {
        ...copy(r.lang).shopping(names.slice(0, 3), names.length - 3),
        data: { type: "shopping" },
      });
      await recordSends(supabase, [r.userId], h.household_id, "shopping", now);
      await nullDeadTokens(supabase, dead);
      count += 1;
    }
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
    if (!(await householdWindowOpen(supabase, h.id, now))) continue;
    count += await pushToHousehold(supabase, h.id, now, "topup",
      (lang) => ({ ...copy(lang).topUp(), data: { type: "topup" } }));
  }
  return count;
}

async function runReengagement(supabase: any, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - 5 * 86400000).toISOString();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, active_household_id, language, notification_preferences!inner(push_token, notifications_enabled, reengagement_enabled)")
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
    if (u.active_household_id && !(await householdWindowOpen(supabase, u.active_household_id, now))) continue;
    const dead = await sendPush([token], { ...copy(toLang(u.language)).reengagement(), data: { type: "reengagement" } });
    await recordSends(supabase, [u.id], null, "reengagement", now);
    await nullDeadTokens(supabase, dead);
    count += 1;
  }
  return count;
}

// Top-up and re-engagement respect the household's send window too (C11).
// No settings row → no window configured → allowed, as before.
async function householdWindowOpen(supabase: any, householdId: string, now: Date): Promise<boolean> {
  const { data: hs } = await supabase
    .from("household_notification_settings")
    .select("send_window_start, send_window_end, timezone")
    .eq("household_id", householdId)
    .maybeSingle();
  if (!hs) return true;
  return isWithinSendWindow(now, hs.send_window_start, hs.send_window_end, hs.timezone);
}

// Only used by top-up — gate by the master switch + the per-user tips opt-out.
async function pushToHousehold(
  supabase: any,
  householdId: string,
  now: Date,
  type: string,
  payloadFor: (lang: Lang) => Payload,
): Promise<number> {
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, profiles!inner(language), notification_preferences!inner(push_token, notifications_enabled, tips_enabled)")
    .eq("household_id", householdId).eq("status", "active");
  const recipients: Recipient[] = [];
  for (const m of members ?? []) {
    const p = (m as any).notification_preferences;
    if (p?.push_token && p?.notifications_enabled && p?.tips_enabled) {
      recipients.push({ token: p.push_token, userId: m.user_id, lang: toLang((m as any).profiles?.language) });
    }
  }
  if (recipients.length === 0) return 0;
  for (const [lang, group] of byLanguage(recipients)) {
    const dead = await sendPush(group.map((r) => r.token), payloadFor(lang));
    await recordSends(supabase, group.map((r) => r.userId), householdId, type, now);
    await nullDeadTokens(supabase, dead);
  }
  return recipients.length;
}
