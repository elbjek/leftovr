import { createClient } from "npm:@supabase/supabase-js@^2.46.1";

// Account deletion (Apple-required). Removes the user and all their personal
// data. Households are handled per the product rule:
//   - sole member  → delete the household (cascades its inventory/recipes/etc.)
//   - others remain → reassign ownership to the next member, keep the household
//
// households.created_by → profiles is RESTRICT, so households the user created
// MUST be reassigned or deleted BEFORE the profile/user can be removed.
// Personal rows (memberships, notification prefs, favorites…) cascade from the
// profile delete; shared household rows they authored (fridge items, scans,
// recipes, cook/usage history) are kept with the author set to NULL (B22).
//
// Auth: the user's JWT identifies them; the service-role client performs the
// privileged deletes (a client can never delete an auth user).

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

  try {
    // Anonymized retention snapshot (no name/email) — written before anything is
    // deleted so we keep aggregate analytics on churn.
    const [snapProfile, snapMemberships] = await Promise.all([
      supabase
        .from("profiles")
        .select("created_at, tier, language, primary_goal, shopping_style, onboarding_completed_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("household_members").select("household_id").eq("user_id", userId),
    ]);
    const snapHouseholdIds = (snapMemberships.data ?? []).map((m) => m.household_id);
    const [snapItems, snapRecipes] = await Promise.all([
      snapHouseholdIds.length
        ? supabase
            .from("inventory_items")
            .select("id", { count: "exact", head: true })
            .in("household_id", snapHouseholdIds)
        : Promise.resolve({ count: 0 }),
      snapHouseholdIds.length
        ? supabase
            .from("recipes")
            .select("id", { count: "exact", head: true })
            .in("household_id", snapHouseholdIds)
        : Promise.resolve({ count: 0 }),
    ]);
    await supabase.from("deleted_accounts").insert({
      user_id: userId,
      account_created_at: snapProfile.data?.created_at ?? null,
      tier: snapProfile.data?.tier ?? null,
      language: snapProfile.data?.language ?? null,
      primary_goal: snapProfile.data?.primary_goal ?? null,
      shopping_style: snapProfile.data?.shopping_style ?? null,
      onboarding_completed: snapProfile.data?.onboarding_completed_at != null,
      household_count: snapHouseholdIds.length,
      inventory_item_count: snapItems.count ?? 0,
      recipe_count: snapRecipes.count ?? 0,
    });

    // Households this user created — the only thing blocking deletion (RESTRICT).
    const { data: owned, error: ownedError } = await supabase
      .from("households")
      .select("id")
      .eq("created_by", userId);
    if (ownedError) throw ownedError;

    for (const household of owned ?? []) {
      // Other active members of this household, oldest first.
      const { data: others, error: othersError } = await supabase
        .from("household_members")
        .select("user_id, joined_at")
        .eq("household_id", household.id)
        .neq("user_id", userId)
        .is("removed_at", null)
        .order("joined_at", { ascending: true });
      if (othersError) throw othersError;

      const heir = others?.[0]?.user_id;
      if (!heir) {
        // Sole member → remove the whole household (cascades all its data).
        const { error } = await supabase.from("households").delete().eq("id", household.id);
        if (error) throw error;
      } else {
        // Hand the household to the next member so RESTRICT no longer blocks us.
        const { error: reassignError } = await supabase
          .from("households")
          .update({ created_by: heir })
          .eq("id", household.id);
        if (reassignError) throw reassignError;
        const { error: roleError } = await supabase
          .from("household_members")
          .update({ role: "owner" })
          .eq("household_id", household.id)
          .eq("user_id", heir);
        if (roleError) throw roleError;
      }
    }

    // Profile delete cascades personal rows; shared household rows keep, author → NULL.
    const { error: profileError } = await supabase.from("profiles").delete().eq("id", userId);
    if (profileError) throw profileError;

    // Finally remove the auth user.
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "delete_failed" },
      { status: 500 },
    );
  }
});
