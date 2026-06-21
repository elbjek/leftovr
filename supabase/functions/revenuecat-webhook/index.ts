import { createClient } from "npm:@supabase/supabase-js@^2.46.1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2.46.1";

// RevenueCat webhook → server-authoritative tier sync.
//
// Security: this function runs with verify_jwt = false (RevenueCat is not a
// Supabase user), so it authenticates by matching the Authorization header
// against REVENUECAT_WEBHOOK_SECRET — the "Authorization header value" you set
// in the RevenueCat dashboard webhook config. Tier columns are otherwise locked
// to clients; this is the only path that writes them in production.
//
// app_user_id is the Supabase user id (the client calls Purchases.logIn with it).

type Tier = "free" | "premium" | "household_premium";

type RevenueCatEvent = {
  type: string;
  app_user_id?: string;
  product_id?: string;
  // TRANSFER events carry no app_user_id/product_id — just the ids the
  // entitlement moved between.
  transferred_to?: string[];
  transferred_from?: string[];
};

// Events that mean the entitlement is currently active.
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);

// Events that mean access has ended. (CANCELLATION is NOT here: the sub stays
// active until it actually expires.)
const REVOKE_EVENTS = new Set(["EXPIRATION", "REFUND"]);

function tierFromProduct(productId: string | undefined): Tier {
  return productId?.includes("household") ? "household_premium" : "premium";
}

// Resolve a user's current tier from RevenueCat's own records. Used for TRANSFER
// (which omits product_id) — we ask RevenueCat what the user actually has now.
async function resolveTierFromRevenueCat(appUserId: string, apiKey: string): Promise<Tier> {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) {
    console.log("[rc-webhook] subscriber fetch failed", { appUserId, status: res.status });
    return "free";
  }
  const data = await res.json().catch(() => null) as
    | { subscriber?: { entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string }> } }
    | null;
  const entitlements = data?.subscriber?.entitlements ?? {};
  const now = Date.now();

  let active = false;
  let household = false;
  for (const ent of Object.values(entitlements)) {
    const expires = ent?.expires_date ? Date.parse(ent.expires_date) : null;
    const isActive = expires === null || expires > now;
    if (!isActive) continue;
    active = true;
    if (ent?.product_identifier?.includes("household")) household = true;
  }

  if (!active) return "free";
  return household ? "household_premium" : "premium";
}

// Write the tier to the profile and mirror it onto the active household
// (one payer covers members). Returns false if no profile matches the id.
async function applyTier(supabase: SupabaseClient, appUserId: string, tier: Tier): Promise<boolean> {
  const householdPlanTier: Tier = tier === "household_premium" ? "household_premium" : "free";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({ tier })
    .eq("id", appUserId)
    .select("active_household_id")
    .maybeSingle();

  if (profileError) throw new Error("profile_update_failed");
  if (!profile) return false;

  if (profile.active_household_id) {
    const { error: householdError } = await supabase
      .from("households")
      .update({ plan_tier: householdPlanTier })
      .eq("id", profile.active_household_id);
    if (householdError) throw new Error("household_update_failed");
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "missing_server_config" }, { status: 500 });
  }

  if (req.headers.get("Authorization") !== webhookSecret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { event?: RevenueCatEvent } | null;
  const event = body?.event;
  if (!event?.type) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  console.log("[rc-webhook] event", {
    type: event.type,
    app_user_id: event.app_user_id,
    product_id: event.product_id,
    transferred_to: event.transferred_to,
    transferred_from: event.transferred_from,
  });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // TRANSFER: the entitlement moved between app_user_ids. Re-resolve the tier
    // for every affected id from RevenueCat (the event itself has no product).
    if (event.type === "TRANSFER") {
      const apiKey = Deno.env.get("REVENUECAT_API_KEY");
      if (!apiKey) {
        console.log("[rc-webhook] transfer skipped — REVENUECAT_API_KEY unset");
        return Response.json({ ok: true, transfer_skipped: "no_api_key" });
      }
      const ids = [...(event.transferred_to ?? []), ...(event.transferred_from ?? [])];
      for (const id of ids) {
        const tier = await resolveTierFromRevenueCat(id, apiKey);
        await applyTier(supabase, id, tier);
      }
      return Response.json({ ok: true, transferred: ids.length });
    }

    const grant = GRANT_EVENTS.has(event.type);
    const revoke = REVOKE_EVENTS.has(event.type);
    // Ignore events that don't change access (CANCELLATION, TEST, etc.).
    if (!grant && !revoke) {
      return Response.json({ ok: true, ignored: event.type });
    }
    if (!event.app_user_id) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    const tier: Tier = grant ? tierFromProduct(event.product_id) : "free";
    const existed = await applyTier(supabase, event.app_user_id, tier);
    if (!existed) {
      // Unknown user — acknowledge so RevenueCat doesn't retry forever.
      console.log("[rc-webhook] unknown_user", { app_user_id: event.app_user_id });
      return Response.json({ ok: true, unknown_user: true });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "update_failed" },
      { status: 500 },
    );
  }
});
