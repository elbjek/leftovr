import { createClient } from "npm:@supabase/supabase-js@^2.46.1";

// GDPR-style data export. Returns every row tied to the requesting user
// (profile, memberships, and the households they belong to with inventory and
// recipes) as a single JSON document the client saves via the share sheet.
//
// Auth: the user's JWT (attached by supabase.functions.invoke) identifies them;
// the service-role client reads across RLS so the export is complete.

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "missing_server_config" }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "missing_authorization" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: userResult, error: userError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  const userId = userResult.user?.id;
  if (userError || !userId) {
    return Response.json({ error: "invalid_authorization" }, { status: 401 });
  }

  const [profile, memberships, notificationPrefs, favorites] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("household_members").select("*").eq("user_id", userId),
    supabase.from("notification_preferences").select("*").eq("user_id", userId),
    supabase.from("recipe_favorites").select("*").eq("user_id", userId),
  ]);

  const householdIds = (memberships.data ?? []).map((m) => m.household_id);
  const [households, inventory, recipes] = await Promise.all([
    householdIds.length
      ? supabase.from("households").select("*").in("id", householdIds)
      : Promise.resolve({ data: [] }),
    householdIds.length
      ? supabase.from("inventory_items").select("*").in("household_id", householdIds)
      : Promise.resolve({ data: [] }),
    householdIds.length
      ? supabase.from("recipes").select("*").in("household_id", householdIds)
      : Promise.resolve({ data: [] }),
  ]);

  return Response.json({
    exported_at: new Date().toISOString(),
    user_id: userId,
    email: userResult.user?.email ?? null,
    profile: profile.data ?? null,
    notification_preferences: notificationPrefs.data ?? [],
    recipe_favorites: favorites.data ?? [],
    households: households.data ?? [],
    inventory_items: inventory.data ?? [],
    recipes: recipes.data ?? [],
  });
});
