import { getSupabaseClient } from "@/lib/supabase";

export type InsightsRawData = {
  receiptScans: number;
  itemsAdded: number;
  cookedEvents: number;
  removedItems: number;
  itemsSaved: number;
  categoryBreakdown: Record<string, number>;
  cookedRecipes: { title: string; count: number }[];
};

// With userId: personal stats (your scans, items you added, meals you cooked).
// Without: whole-household stats. Removed/saved items are attributed via
// added_by since inventory rows don't record who removed them.
export async function getInsightsData(
  householdId: string,
  since: string,
  userId?: string,
): Promise<InsightsRawData> {
  const supabase = getSupabaseClient();

  let scansQuery = supabase
    .from("receipt_scans")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("status", "completed")
    .gte("processed_at", since);
  if (userId) scansQuery = scansQuery.eq("created_by", userId);

  let itemsQuery = supabase
    .from("inventory_items")
    .select("id, category", { count: "exact" })
    .eq("household_id", householdId)
    .gte("added_at", since);
  if (userId) itemsQuery = itemsQuery.eq("added_by", userId);

  let cookedQuery = supabase
    .from("cooked_events")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .gte("created_at", since);
  if (userId) cookedQuery = cookedQuery.eq("cooked_by", userId);

  let cookedRecipesQuery = supabase
    .from("cooked_events")
    .select("recipe_id, recipes(title)")
    .eq("household_id", householdId)
    .gte("created_at", since);
  if (userId) cookedRecipesQuery = cookedRecipesQuery.eq("cooked_by", userId);

  let removedQuery = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .not("removed_at", "is", null)
    .gte("removed_at", since);
  if (userId) removedQuery = removedQuery.eq("added_by", userId);

  let savedQuery = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("removal_reason", "cooked")
    .gte("removed_at", since);
  if (userId) savedQuery = savedQuery.eq("added_by", userId);

  const [scans, items, cooked, cookedRecipeRows, removed, saved] = await Promise.all([
    scansQuery,
    itemsQuery,
    cookedQuery,
    cookedRecipesQuery,
    removedQuery,
    savedQuery,
  ]);

  if (scans.error) throw scans.error;
  if (items.error) throw items.error;
  if (cooked.error) throw cooked.error;
  if (cookedRecipeRows.error) throw cookedRecipeRows.error;
  if (removed.error) throw removed.error;
  if (saved.error) throw saved.error;

  const categoryBreakdown: Record<string, number> = {};
  if (items.data) {
    for (const row of items.data as { id: string; category: string }[]) {
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
    itemsSaved: saved.count ?? 0,
    categoryBreakdown,
    cookedRecipes,
  };
}
