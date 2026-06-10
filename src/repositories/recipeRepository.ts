import { getSupabaseClient } from "@/lib/supabase";
import { InventoryLot } from "@/services/inventoryRules";

export type CookingMode = "household" | "just_me";

export type RecipeSessionRow = {
  id: string;
  household_id: string;
  generated_by: string;
  cooking_mode: CookingMode;
  avoidances_used: string[];
  fridge_snapshot: unknown;
  is_premium_optimized: boolean;
  created_at: string;
};

export type RecipeRow = {
  id: string;
  household_id: string;
  session_id: string | null;
  title: string;
  description: string | null;
  time_minutes: number | null;
  complexity: string | null;
  servings: number;
  ingredients: unknown;
  steps: unknown;
  used_inventory_item_ids: string[];
  tags: string[];
  avoidance_tags: string[];
  is_favorite: boolean;
  generated_by: string;
  created_at: string;
  cooked_count?: number;
};

export type CreateRecipeSessionInput = {
  householdId: string;
  cookingMode: CookingMode;
  avoidancesUsed: string[];
  fridgeSnapshot: InventoryLot[];
  isPremiumOptimized: boolean;
};

export type CreateRecipeInput = {
  householdId: string;
  sessionId: string;
  title: string;
  description: string;
  timeMinutes: number;
  complexity: string;
  servings: number;
  ingredients: unknown;
  steps: string[];
  usedInventoryItemIds: string[];
  tags: string[];
  avoidanceTags: string[];
};

export async function createRecipeSession(input: CreateRecipeSessionInput) {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userResult.user?.id;
  if (!userId) throw new Error("No signed-in user.");

  const { data, error } = await supabase
    .from("recipe_sessions")
    .insert({
      household_id: input.householdId,
      generated_by: userId,
      cooking_mode: input.cookingMode,
      avoidances_used: input.avoidancesUsed,
      fridge_snapshot: input.fridgeSnapshot,
      is_premium_optimized: input.isPremiumOptimized,
    })
    .select("*")
    .single<RecipeSessionRow>();

  if (error) throw error;
  return data;
}

export async function createRecipe(input: CreateRecipeInput) {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userResult.user?.id;
  if (!userId) throw new Error("No signed-in user.");

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      household_id: input.householdId,
      session_id: input.sessionId,
      title: input.title,
      description: input.description,
      time_minutes: input.timeMinutes,
      complexity: input.complexity,
      servings: input.servings,
      ingredients: input.ingredients,
      steps: input.steps,
      used_inventory_item_ids: input.usedInventoryItemIds,
      tags: input.tags,
      avoidance_tags: input.avoidanceTags,
      is_favorite: false,
      generated_by: userId,
    })
    .select("*")
    .single<RecipeRow>();

  if (error) throw error;
  return data;
}

export async function listHouseholdRecipeSessions(householdId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("recipe_sessions")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .returns<RecipeSessionRow[]>();

  if (error) throw error;
  return data ?? [];
}

export async function listHouseholdRecipes(householdId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .returns<RecipeRow[]>();

  if (error) throw error;
  return withCookedCounts(householdId, data ?? []);
}

export async function listCookedRecipes(householdId: string, cookedBy?: string) {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("cooked_events")
    .select("recipes(*)")
    .eq("household_id", householdId)
    .not("recipe_id", "is", null)
    .order("created_at", { ascending: false });

  if (cookedBy) {
    query = query.eq("cooked_by", cookedBy);
  }

  const { data, error } = await query;

  if (error) throw error;

  const recipes: RecipeRow[] = [];
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    if (!recipe) continue;
    counts.set(recipe.id, (counts.get(recipe.id) ?? 0) + 1);
    if (seen.has(recipe.id)) continue;
    recipes.push({ ...(recipe as RecipeRow), cooked_count: 0 });
    seen.add(recipe.id);
  }

  return recipes.map((recipe) => ({
    ...recipe,
    cooked_count: counts.get(recipe.id) ?? 0,
  }));
}

export type CookedEventRow = { recipe_id: string; cooked_by: string };

// Who cooked what, household-wide — used to badge recipe lists.
export async function listCookedEventRows(householdId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("cooked_events")
    .select("recipe_id, cooked_by")
    .eq("household_id", householdId)
    .not("recipe_id", "is", null);

  if (error) throw error;
  return (data ?? []) as CookedEventRow[];
}

// Favorites are per user (recipe_favorites join table); RLS limits rows to auth.uid().
export async function listUserFavoriteRecipeIds() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("recipe_favorites")
    .select("recipe_id");

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.recipe_id as string));
}

export async function toggleRecipeFavorite(recipeId: string, isFavorite: boolean) {
  const supabase = getSupabaseClient();

  if (isFavorite) {
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const { error } = await supabase
      .from("recipe_favorites")
      .upsert({ recipe_id: recipeId, user_id: userResult.user.id });

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("recipe_favorites")
    .delete()
    .eq("recipe_id", recipeId);

  if (error) throw error;
}

export async function getWeeklySessionCount(householdId: string) {
  const supabase = getSupabaseClient();
  const weekStart = getCalendarWeekStart();

  const { count, error } = await supabase
    .from("recipe_sessions")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .gte("created_at", weekStart.toISOString());

  if (error) throw error;
  return count ?? 0;
}

function getCalendarWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function withCookedCounts(householdId: string, recipes: RecipeRow[]) {
  if (recipes.length === 0) return recipes;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cooked_events")
    .select("recipe_id")
    .eq("household_id", householdId)
    .not("recipe_id", "is", null);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const recipeId = row.recipe_id;
    if (typeof recipeId !== "string") continue;
    counts.set(recipeId, (counts.get(recipeId) ?? 0) + 1);
  }

  return recipes.map((recipe) => ({
    ...recipe,
    cooked_count: counts.get(recipe.id) ?? 0,
  }));
}

export const FREE_WEEKLY_SESSION_LIMIT = 3;
