import { getSupabaseClient } from "@/lib/supabase";

export type InsightsRawData = {
  receiptScans: number;
  itemsAdded: number;
  cookedEvents: number;
  removedItems: number;
  categoryBreakdown: Record<string, number>;
  cookedRecipes: { title: string; count: number }[];
};

export async function getInsightsData(
  householdId: string,
  since: string,
): Promise<InsightsRawData> {
  const supabase = getSupabaseClient();

  const [scans, items, cooked, cookedRecipeRows, removed] = await Promise.all([
    supabase
      .from("receipt_scans")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("status", "completed")
      .gte("processed_at", since),

    supabase
      .from("inventory_items")
      .select("id, category", { count: "exact" })
      .eq("household_id", householdId)
      .gte("added_at", since),

    supabase
      .from("cooked_events")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .gte("created_at", since),

    supabase
      .from("cooked_events")
      .select("recipe_id, recipes(title)")
      .eq("household_id", householdId)
      .gte("created_at", since),

    supabase
      .from("inventory_items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .not("removed_at", "is", null)
      .gte("removed_at", since),
  ]);

  if (scans.error) throw scans.error;
  if (items.error) throw items.error;
  if (cooked.error) throw cooked.error;
  if (cookedRecipeRows.error) throw cookedRecipeRows.error;
  if (removed.error) throw removed.error;

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
    categoryBreakdown,
    cookedRecipes,
  };
}
