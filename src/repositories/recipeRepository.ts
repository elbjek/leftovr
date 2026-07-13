import { getSupabaseClient } from "@/lib/supabase";
import { InventoryLot, UrgencyBand } from "@/services/inventoryRules";

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

// Trimmed snapshot shape: full InventoryLot rows duplicated household data
// outside the inventory lifecycle and grew unbounded (one copy per session).
// Urgency is resolved live at snapshot time (the stored column was dropped).
type FridgeSnapshotItem = Pick<
  InventoryLot,
  "normalized_name" | "category" | "quantity" | "unit"
> & { urgency: UrgencyBand };

export type CreateRecipeSessionInput = {
  householdId: string;
  cookingMode: CookingMode;
  avoidancesUsed: string[];
  fridgeSnapshot: FridgeSnapshotItem[];
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
      generated_by: userId,
    })
    .select("*")
    .single<RecipeRow>();

  if (error) throw error;
  // is_favorite lives in recipe_favorites; a fresh recipe is never a favorite.
  return { ...data, is_favorite: false };
}

export type UpdateRecipeDetailInput = {
  ingredients: unknown;
  steps: string[];
  timeMinutes: number;
  complexity: string;
  avoidanceTags: string[];
};

/** Fills a card-stage recipe (empty steps) with its expanded detail so the next
 *  open reads it straight from the DB instead of re-calling the model. */
export async function updateRecipeDetail(recipeId: string, input: UpdateRecipeDetailInput) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("recipes")
    .update({
      ingredients: input.ingredients,
      steps: input.steps,
      time_minutes: input.timeMinutes,
      complexity: input.complexity,
      avoidance_tags: input.avoidanceTags,
    })
    .eq("id", recipeId);
  if (error) throw error;
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
  return data ?? [];
}

type CookedEventRow = { recipe_id: string; cooked_by: string; created_at: string };

// Who cooked what, household-wide, newest first. Single source for cooked
// counts, the cooked tab, and the "cooked by" badges (was 3 separate queries).
export async function listCookedEventRows(householdId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("cooked_events")
    .select("recipe_id, cooked_by, created_at")
    .eq("household_id", householdId)
    .not("recipe_id", "is", null)
    .order("created_at", { ascending: false });

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

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userResult.user.id;

  if (isFavorite) {
    const { error } = await supabase
      .from("recipe_favorites")
      .upsert({ recipe_id: recipeId, user_id: userId });

    if (error) throw error;
    return;
  }

  // Scope the delete to the caller's own favorite — defense in depth beyond RLS (#16).
  const { error } = await supabase
    .from("recipe_favorites")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("user_id", userId);

  if (error) throw error;
}

