import { createClient } from "npm:@supabase/supabase-js@^2.46.1";

// RevenueCat webhook → server-authoritative tier sync.
//
// Security: this function runs with verify_jwt = false (RevenueCat is not a
// Supabase user), so it authenticates by matching the Authorization header
// against REVENUECAT_WEBHOOK_SECRET — the "Authorization header value" you set
// in the RevenueCat dashboard webhook config. Tier columns are otherwise locked
// to clients; this is the only path that writes them in production.
//
// app_user_id is the Supabase user id (the client calls Purchases.logIn with it).

type RevenueCatEvent = {
  type: string;
  app_user_id?: string;
  product_id?: string;
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
  if (!event?.type || !event.app_user_id) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const grant = GRANT_EVENTS.has(event.type);
  const revoke = REVOKE_EVENTS.has(event.type);
  // Ignore events that don't change access (CANCELLATION, TEST, TRANSFER, etc.).
  if (!grant && !revoke) {
    return Response.json({ ok: true, ignored: event.type });
  }

  const isHousehold = Boolean(event.product_id?.includes("household"));
  const tier = !grant ? "free" : isHousehold ? "household_premium" : "premium";
  const householdPlanTier = grant && isHousehold ? "household_premium" : "free";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({ tier })
    .eq("id", event.app_user_id)
    .select("active_household_id")
    .maybeSingle();

  if (profileError) {
    return Response.json({ error: "profile_update_failed" }, { status: 500 });
  }
  if (!profile) {
    // Unknown user — acknowledge so RevenueCat doesn't retry forever.
    return Response.json({ ok: true, unknown_user: true });
  }

  // Mirror the tier onto the buyer's active household (one payer covers members).
  if (profile.active_household_id) {
    const { error: householdError } = await supabase
      .from("households")
      .update({ plan_tier: householdPlanTier })
      .eq("id", profile.active_household_id);

    if (householdError) {
      return Response.json({ error: "household_update_failed" }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
});
