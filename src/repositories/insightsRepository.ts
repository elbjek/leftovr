import { getSupabaseClient } from "@/lib/supabase";
import type { FoodHistoryRow, KitchenRaw } from "@/services/kitchenInsights";
import type { InventoryCategory } from "@/services/inventoryRules";

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
  /** The food used up most often in the window (its inventory key), if any. */
  topUsedFood: { name: string; count: number } | null;
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
    .select("id, category, normalized_name", { count: "exact" })
    .eq("household_id", householdId)
    .gte("used_at", since);
  if (until) usedQuery = usedQuery.lt("used_at", until);
  if (userId) usedQuery = usedQuery.eq("used_by", userId);

  let valueQuery = supabase
    .from("value_events")
    .select("kind, value, currency, households!inner(currency_code)")
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
  // Only the household's current currency counts: after a currency change,
  // older amounts stay in the export but don't mix into totals (C16).
  type ValueRow = { kind: string; value: number; currency: string | null; households: { currency_code: string } };
  for (const row of (value.data ?? []) as unknown as ValueRow[]) {
    if (row.currency != null && row.currency !== row.households.currency_code) continue;
    if (row.kind === "spend") moneySpent += row.value;
    else if (row.kind === "saved") moneySaved += row.value;
    else if (row.kind === "wasted") moneyWasted += row.value;
  }

  const categoryBreakdown: Record<string, number> = {};
  const foodCounts = new Map<string, number>();
  if (used.data) {
    for (const row of used.data as { id: string; category: string; normalized_name: string }[]) {
      categoryBreakdown[row.category] = (categoryBreakdown[row.category] ?? 0) + 1;
      foodCounts.set(row.normalized_name, (foodCounts.get(row.normalized_name) ?? 0) + 1);
    }
  }
  const [topFood] = [...foodCounts.entries()].sort((a, b) => b[1] - a[1]);

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
    topUsedFood: topFood ? { name: topFood[0], count: topFood[1] } : null,
    moneySpent,
    moneySaved,
    moneyWasted,
  };
}

export type WinsRaw = {
  /** When each item was used up (cooked with or marked used). */
  used: string[];
  cooked: { at: string; title: string }[];
  /** Money saved, household currency only. */
  saved: { at: string; value: number }[];
};

/**
 * Everything used up, cooked and saved since `since` — the Insights wins
 * list. With userId: yours; without: the whole household's.
 */
export async function getWinsRaw(householdId: string, since: string, userId?: string): Promise<WinsRaw> {
  const supabase = getSupabaseClient();
  let usedQuery = supabase.from("item_usage_events").select("used_at").eq("household_id", householdId).gte("used_at", since);
  if (userId) usedQuery = usedQuery.eq("used_by", userId);
  let cookedQuery = supabase.from("cooked_events").select("created_at, recipes(title)").eq("household_id", householdId).gte("created_at", since);
  if (userId) cookedQuery = cookedQuery.eq("cooked_by", userId);
  let valueQuery = supabase
    .from("value_events")
    .select("occurred_at, value, currency, households!inner(currency_code)")
    .eq("household_id", householdId)
    .eq("kind", "saved")
    .gte("occurred_at", since);
  if (userId) valueQuery = valueQuery.eq("created_by", userId);
  const [used, cooked, value] = await Promise.all([usedQuery, cookedQuery, valueQuery]);
  if (used.error) throw used.error;
  if (cooked.error) throw cooked.error;
  if (value.error) throw value.error;

  type CookedRow = { created_at: string; recipes?: { title?: string } | { title?: string }[] | null };
  type ValueRow = { occurred_at: string; value: number; currency: string | null; households: { currency_code: string } };
  return {
    used: (used.data ?? []).map((row: { used_at: string }) => row.used_at),
    cooked: ((cooked.data ?? []) as unknown as CookedRow[]).flatMap((row) => {
      const title = Array.isArray(row.recipes) ? row.recipes[0]?.title : row.recipes?.title;
      return title ? [{ at: row.created_at, title }] : [];
    }),
    // Same rule as every money total: only the household's current currency.
    saved: ((value.data ?? []) as unknown as ValueRow[])
      .filter((row) => row.currency == null || row.currency === row.households.currency_code)
      .map((row) => ({ at: row.occurred_at, value: row.value })),
  };
}

/**
 * The kitchen side of Insights for a window: items added (and how each
 * ended), when things were used up, when things were tossed. With userId:
 * yours (items you added, uses you logged); without: the household's.
 */
export async function getKitchenRaw(householdId: string, since: string, until: string, userId?: string): Promise<KitchenRaw> {
  const supabase = getSupabaseClient();
  let addedQuery = supabase
    .from("inventory_items")
    .select("category, removed_at, removal_reason")
    .eq("household_id", householdId)
    .gte("added_at", since)
    .lt("added_at", until);
  if (userId) addedQuery = addedQuery.eq("added_by", userId);
  let usedQuery = supabase.from("item_usage_events").select("used_at").eq("household_id", householdId).gte("used_at", since).lt("used_at", until);
  if (userId) usedQuery = usedQuery.eq("used_by", userId);
  let tossedQuery = supabase
    .from("inventory_items")
    .select("removed_at")
    .eq("household_id", householdId)
    .eq("removal_reason", "discarded")
    .gte("removed_at", since)
    .lt("removed_at", until);
  if (userId) tossedQuery = tossedQuery.eq("added_by", userId);
  const [added, used, tossed] = await Promise.all([addedQuery, usedQuery, tossedQuery]);
  if (added.error) throw added.error;
  if (used.error) throw used.error;
  if (tossed.error) throw tossed.error;
  type AddedRow = { category: InventoryCategory; removed_at: string | null; removal_reason: string | null };
  return {
    // Removed without a "discarded" reason counts as used, as in the weekly totals.
    added: ((added.data ?? []) as AddedRow[]).map((row) => ({
      category: row.category,
      outcome: row.removed_at == null ? null : row.removal_reason === "discarded" ? "tossed" : "used",
    })),
    usedAt: (used.data ?? []).map((row: { used_at: string }) => row.used_at),
    tossedAt: (tossed.data ?? []).map((row: { removed_at: string }) => row.removed_at),
  };
}

/** Every item finished (used or tossed) in the last 120 days — for "keeps going off". */
export async function getFoodHistory(householdId: string, userId?: string): Promise<FoodHistoryRow[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("inventory_items")
    .select("normalized_name, category, removed_at, removal_reason")
    .eq("household_id", householdId)
    .not("removed_at", "is", null)
    .gte("removed_at", new Date(Date.now() - 120 * 86_400_000).toISOString())
    .order("removed_at", { ascending: false })
    .limit(1000);
  if (userId) query = query.eq("added_by", userId);
  const { data, error } = await query;
  if (error) throw error;
  type Row = { normalized_name: string; category: InventoryCategory; removed_at: string; removal_reason: string | null };
  return ((data ?? []) as Row[]).map((row) => ({
    name: row.normalized_name,
    category: row.category,
    outcome: row.removal_reason === "discarded" ? "tossed" : "used",
    at: row.removed_at,
  }));
}

export type StreakDayState = "used" | "frozen" | "none";

export type StreakState = {
  /** Days in a row with something used up; frozen days keep it alive without adding. */
  streak: number;
  /** Banked streak freezes (0–2). */
  freezes: number;
  /** Items used up today — the daily goal's progress. */
  today: number;
  /** The last seven local days, oldest first, today last. */
  days: { date: Date; state: StreakDayState }[];
};

/**
 * The signed-in member's streak in this kitchen. Server-side (`sync_streak`):
 * it also spends banked freezes on missed days and pays out new ones, so it
 * is the only place a streak is computed.
 */
export async function syncStreak(householdId: string, timeZone: string): Promise<StreakState> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("sync_streak", { p_household_id: householdId, p_tz: timeZone });
  if (error) throw error;
  const raw = data as { streak: number; freezes: number; today: number; days: { date: string; state: StreakDayState }[] };
  return {
    streak: raw.streak,
    freezes: raw.freezes,
    today: raw.today,
    days: raw.days.map(({ date, state }) => {
      // "YYYY-MM-DD" is a local day, not a UTC instant.
      const [y, m, d] = date.split("-").map(Number);
      return { date: new Date(y, m - 1, d), state };
    }),
  };
}

export type DayActivity = {
  cooked: { recipeId: string; title: string }[];
  /** Distinct foods used up (cooked with or marked used). */
  used: { name: string; category: string }[];
  /** Money saved that day, household currency only. */
  moneySaved: number;
};

/** One day's cooking and using up, for the home week strip's day sheet. */
export async function getDayActivity(
  householdId: string,
  from: string,
  until: string,
  userId?: string,
): Promise<DayActivity> {
  const supabase = getSupabaseClient();

  let cookedQuery = supabase
    .from("cooked_events")
    .select("recipe_id, recipes(title)")
    .eq("household_id", householdId)
    .not("recipe_id", "is", null)
    .gte("created_at", from)
    .lt("created_at", until)
    .order("created_at", { ascending: true });
  if (userId) cookedQuery = cookedQuery.eq("cooked_by", userId);

  let usedQuery = supabase
    .from("item_usage_events")
    .select("normalized_name, category")
    .eq("household_id", householdId)
    .gte("used_at", from)
    .lt("used_at", until)
    .order("used_at", { ascending: true });
  if (userId) usedQuery = usedQuery.eq("used_by", userId);

  let valueQuery = supabase
    .from("value_events")
    .select("value, currency, households!inner(currency_code)")
    .eq("household_id", householdId)
    .eq("kind", "saved")
    .gte("occurred_at", from)
    .lt("occurred_at", until);
  if (userId) valueQuery = valueQuery.eq("created_by", userId);

  const [cooked, used, value] = await Promise.all([cookedQuery, usedQuery, valueQuery]);
  if (cooked.error) throw cooked.error;
  if (used.error) throw used.error;
  if (value.error) throw value.error;

  type CookedRow = { recipe_id: string; recipes?: { title?: string } | { title?: string }[] | null };
  const cookedList: DayActivity["cooked"] = [];
  for (const row of (cooked.data ?? []) as unknown as CookedRow[]) {
    const title = Array.isArray(row.recipes) ? row.recipes[0]?.title : row.recipes?.title;
    if (title && !cookedList.some((c) => c.recipeId === row.recipe_id)) cookedList.push({ recipeId: row.recipe_id, title });
  }

  const usedList: DayActivity["used"] = [];
  for (const row of (used.data ?? []) as { normalized_name: string; category: string }[]) {
    if (!usedList.some((u) => u.name === row.normalized_name)) usedList.push({ name: row.normalized_name, category: row.category });
  }

  // Same rule as the weekly totals: only the household's current currency counts.
  type ValueRow = { value: number; currency: string | null; households: { currency_code: string } };
  let moneySaved = 0;
  for (const row of (value.data ?? []) as unknown as ValueRow[]) {
    if (row.currency == null || row.currency === row.households.currency_code) moneySaved += row.value;
  }

  return { cooked: cookedList, used: usedList, moneySaved };
}
