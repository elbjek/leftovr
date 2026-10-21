import { getSupabaseClient } from "@/lib/supabase";

export type InsightsRawData = {
  receiptScans: number;
  itemsAdded: number;
  cookedEvents: number;
  removedItems: number;
  /** Items consumed (cooked or fully used up) in the window — the real "saved" signal. */
  itemsUsed: number;
  /** Category counts of the USED items, not the added ones. */
  categoryBreakdown: Record<string, number>;
  cookedRecipes: { title: string; count: number }[];
  /** Real money in the window, summed from value_events (household currency). */
  moneySpent: number;
  moneySaved: number;
  moneyWasted: number;
};

// With userId: personal stats (your scans, items you added, meals you cooked).
// Without: whole-household stats. Removed/used items are attributed via
// added_by since inventory rows don't record who removed them.
// `until` bounds the window so previous-week comparisons are real, not invented.
export async function getInsightsData(
  householdId: string,
  since: string,
  userId?: string,
  until?: string,
): Promise<InsightsRawData> {
  const supabase = getSupabaseClient();

  let scansQuery = supabase
    .from("receipt_scans")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("status", "completed")
    // receipt_scans is shared with pantry scans; this metric counts receipts only.
    .eq("scan_type", "receipt")
    .gte("processed_at", since);
  if (until) scansQuery = scansQuery.lt("processed_at", until);
  if (userId) scansQuery = scansQuery.eq("created_by", userId);

  let itemsQuery = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .gte("added_at", since);
  if (until) itemsQuery = itemsQuery.lt("added_at", until);
  if (userId) itemsQuery = itemsQuery.eq("added_by", userId);

  let cookedQuery = supabase
    .from("cooked_events")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .gte("created_at", since);
  if (until) cookedQuery = cookedQuery.lt("created_at", until);
  if (userId) cookedQuery = cookedQuery.eq("cooked_by", userId);

  let cookedRecipesQuery = supabase
    .from("cooked_events")
    .select("recipe_id, recipes(title)")
    .eq("household_id", householdId)
    .gte("created_at", since);
  if (until) cookedRecipesQuery = cookedRecipesQuery.lt("created_at", until);
  if (userId) cookedRecipesQuery = cookedRecipesQuery.eq("cooked_by", userId);

  // "Used up" only: tossed items must not count as eat-first hits.
  let removedQuery = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .not("removed_at", "is", null)
    .or("removal_reason.is.null,removal_reason.neq.discarded")
    .gte("removed_at", since);
  if (until) removedQuery = removedQuery.lt("removed_at", until);
  if (userId) removedQuery = removedQuery.eq("added_by", userId);

  // item_usage_events logs every item touched by a cook/use — partial
  // depletion included, which removal-based counting missed entirely.
  let usedQuery = supabase
    .from("item_usage_events")
    .select("id, category", { count: "exact" })
    .eq("household_id", householdId)
    .gte("used_at", since);
  if (until) usedQuery = usedQuery.lt("used_at", until);
  if (userId) usedQuery = usedQuery.eq("used_by", userId);

  let valueQuery = supabase
    .from("value_events")
    .select("kind, value")
    .eq("household_id", householdId)
    .gte("occurred_at", since);
  if (until) valueQuery = valueQuery.lt("occurred_at", until);
  if (userId) valueQuery = valueQuery.eq("created_by", userId);

  const [scans, items, cooked, cookedRecipeRows, removed, used, value] = await Promise.all([
    scansQuery,
    itemsQuery,
    cookedQuery,
    cookedRecipesQuery,
    removedQuery,
    usedQuery,
    valueQuery,
  ]);

  if (scans.error) throw scans.error;
  if (items.error) throw items.error;
  if (cooked.error) throw cooked.error;
  if (cookedRecipeRows.error) throw cookedRecipeRows.error;
  if (removed.error) throw removed.error;
  if (used.error) throw used.error;
  if (value.error) throw value.error;

  let moneySpent = 0;
  let moneySaved = 0;
  let moneyWasted = 0;
  for (const row of (value.data ?? []) as { kind: string; value: number }[]) {
    if (row.kind === "spend") moneySpent += row.value;
    else if (row.kind === "saved") moneySaved += row.value;
    else if (row.kind === "wasted") moneyWasted += row.value;
  }

  const categoryBreakdown: Record<string, number> = {};
  if (used.data) {
    for (const row of used.data as { id: string; category: string }[]) {
      categoryBreakdown[row.category] = (categoryBreakdown[row.category] ?? 0) + 1;
    }
  }

  const cookedRecipeCounts = new Map<string, number>();
  if (cookedRecipeRows.data) {
    for (const row of cookedRecipeRows.data as { recipes?: { title?: string } | { title?: string }[] | null }[]) {
      const title = Array.isArray(row.recipes) ? row.recipes[0]?.title : row.recipes?.title;
      if (title) cookedRecipeCounts.set(title, (cookedRecipeCounts.get(title) ?? 0) + 1);
    }
  }

  const cookedRecipes = [...cookedRecipeCounts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    receiptScans: scans.count ?? 0,
    itemsAdded: items.count ?? 0,
    cookedEvents: cooked.count ?? 0,
    removedItems: removed.count ?? 0,
    itemsUsed: used.count ?? 0,
    categoryBreakdown,
    cookedRecipes,
    moneySpent,
    moneySaved,
    moneyWasted,
  };
}
