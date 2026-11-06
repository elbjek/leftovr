import { createClient } from "npm:@supabase/supabase-js@^2.46.1";
import { sendPush } from "../_shared/sendPush.ts";
import { secretsMatch } from "../_shared/secrets.ts";
import { coalesceOpen } from "../_shared/notificationRules.ts";
import { copy, Lang, toLang } from "../_shared/pushCopy.ts";

const COALESCE_MIN = 10;

// Invoked by the inventory_items AFTER INSERT statement trigger via pg_net —
// once per insert statement per household + actor (B19).
// Body: { household_id, actor_id, count }
Deno.serve(async (req) => {
  // Invoked by the inventory trigger via pg_net with the Vault `cron_secret`.
  // A valid user JWT alone is not enough — require the shared secret so users
  // can't spoof activity pushes. (Not the service-role key: its env format
  // changed once and silently broke the compare.)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!secretsMatch(req.headers.get("Authorization"), cronSecret && `Bearer ${cronSecret}`)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { household_id, actor_id, count, kind, dish } = await req.json();
  if (!household_id || !actor_id) return Response.json({ ok: false }, { status: 400 });
  // 'added' (the inventory trigger, which sends no kind), 'cooked', or a
  // membership change ('joined' / 'left' / 'removed').
  const cooked = kind === "cooked";
  const change = kind === "joined" || kind === "left" || kind === "removed";
  const sendType = change ? "member_change" : cooked ? "member_cooked" : "member_activity";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );
  const now = new Date();

  // Only shared (household_premium) households have an "other member" to
  // notify — except for membership changes, where the most important one (the
  // payer leaving) fires right after the plan has dropped to free.
  if (!change) {
    const { data: household } = await supabase
      .from("households").select("plan_tier").eq("id", household_id).single();
    if (household?.plan_tier !== "household_premium") return Response.json({ ok: true, skipped: "not_shared" });
  }

  // Coalesce per actor: two housemates unpacking shopping at the same time are
  // two different pieces of news, so only the same person's repeat adds are
  // folded together. Membership changes are one-offs — never coalesced.
  if (!change) {
    const { data: recent } = await supabase
      .from("notification_sends").select("sent_at")
      .eq("household_id", household_id).eq("type", sendType).eq("actor_id", actor_id)
      .order("sent_at", { ascending: false }).limit(1);
    if (!coalesceOpen(recent?.[0]?.sent_at ?? null, now, COALESCE_MIN)) {
      return Response.json({ ok: true, skipped: "coalesced" });
    }
  }

  const { data: actor } = await supabase
    .from("profiles").select("display_name").eq("id", actor_id).single();
  const name = actor?.display_name ?? "Someone";

  // Other members with a token + not muted.
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, profiles!inner(language), notification_preferences!inner(push_token, notifications_enabled, member_activity_enabled)")
    .eq("household_id", household_id).eq("status", "active").neq("user_id", actor_id);

  const targets: { token: string; userId: string; lang: Lang }[] = [];
  for (const m of members ?? []) {
    const p = (m as any).notification_preferences;
    if (p?.push_token && p?.notifications_enabled && p?.member_activity_enabled) {
      targets.push({ token: p.push_token, userId: m.user_id, lang: toLang((m as any).profiles?.language) });
    }
  }
  if (targets.length === 0) return Response.json({ ok: true, skipped: "no_targets" });
  const userIds = targets.map((target) => target.userId);

  // Record before sending: a near-simultaneous call (separate inserts seconds
  // apart) then sees this row in its coalesce check instead of also pushing.
  await supabase.from("notification_sends").insert(
    userIds.map((user_id) => ({ user_id, household_id, actor_id, type: sendType, sent_at: now.toISOString() })),
  );

  const n = Number(count) || 1;
  // One send per language — housemates can run the app in different ones.
  for (const lang of new Set(targets.map((target) => target.lang))) {
    const text = change
      ? copy(lang).memberChange(name, kind)
      : cooked
        ? copy(lang).memberCooked(name, typeof dish === "string" && dish ? dish : null)
        : copy(lang).memberActivity(name, n);
    const dead = await sendPush(
      targets.filter((target) => target.lang === lang).map((target) => target.token),
      { ...text, data: { type: sendType, household_id } },
    );
    for (const token of dead) {
      await supabase.from("notification_preferences").update({ push_token: null }).eq("push_token", token);
    }
  }
  return Response.json({ ok: true, sent: targets.length });
});
