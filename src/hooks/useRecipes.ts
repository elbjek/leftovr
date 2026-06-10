import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createRecipe,
  createRecipeSession,
  CookingMode,
  FREE_WEEKLY_SESSION_LIMIT,
  listCookedEventRows,
  listCookedRecipes,
  getWeeklySessionCount,
  listHouseholdRecipes,
  listUserFavoriteRecipeIds,
  RecipeRow,
  toggleRecipeFavorite,
} from "@/repositories/recipeRepository";
import {
  matchRecipes,
  RecipeMatch,
} from "@/services/recipeService";
import { generateRecipeMatches, RecipeGenerationFilters } from "@/services/recipeGenerationService";
import { InventoryLot } from "@/services/inventoryRules";
import { recordCookedEventAndDepleteInventory } from "@/repositories/inventoryRepository";

export type CookedSummary = { count: number; cookedBy: string[] };

type RecipesState = {
  loading: boolean;
  generating: boolean;
  suggestions: RecipeMatch[];
  /** Session backing the current suggestions, so lists can skip those rows. */
  currentSessionId: string | null;
  savedRecipes: RecipeRow[];
  cookedRecipes: RecipeRow[];
  /** Household-wide cooked counts and cooks, keyed by recipe id. */
  cookedSummaries: Record<string, CookedSummary>;
  weeklyCount: number;
  error: string | null;
};

export function useRecipes(
  householdId: string | null | undefined,
  options: {
    inventory: InventoryLot[];
    avoidances: string[];
    isPremium: boolean;
    servings?: number;
    userId?: string;
  },
) {
  const { inventory, avoidances, isPremium, servings, userId } = options;

  const [state, setState] = useState<RecipesState>({
    loading: Boolean(householdId),
    generating: false,
    suggestions: [],
    currentSessionId: null,
    savedRecipes: [],
    cookedRecipes: [],
    cookedSummaries: {},
    weeklyCount: 0,
    error: null,
  });

  const load = useCallback(async () => {
    if (!householdId) {
      setState({
        loading: false,
        generating: false,
        suggestions: [],
        currentSessionId: null,
        savedRecipes: [],
        cookedRecipes: [],
        cookedSummaries: {},
        weeklyCount: 0,
        error: null,
      });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const [recipes, cookedRecipes, count, favoriteIds, cookedEventRows] = await Promise.all([
        listHouseholdRecipes(householdId),
        listCookedRecipes(householdId, userId),
        getWeeklySessionCount(householdId),
        listUserFavoriteRecipeIds(),
        listCookedEventRows(householdId),
      ]);
      const withFavorites = (rows: RecipeRow[]) =>
        rows.map((row) => ({ ...row, is_favorite: favoriteIds.has(row.id) }));
      const cookedSummaries: Record<string, CookedSummary> = {};
      for (const row of cookedEventRows) {
        const summary = (cookedSummaries[row.recipe_id] ??= { count: 0, cookedBy: [] });
        summary.count += 1;
        if (!summary.cookedBy.includes(row.cooked_by)) summary.cookedBy.push(row.cooked_by);
      }
      setState((s) => ({
        ...s,
        loading: false,
        savedRecipes: withFavorites(recipes),
        cookedRecipes: withFavorites(cookedRecipes),
        cookedSummaries,
        weeklyCount: count,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Could not load recipes.",
      }));
    }
  }, [householdId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const canGenerate = isPremium || state.weeklyCount < FREE_WEEKLY_SESSION_LIMIT;
  const remainingSessions = Math.max(0, FREE_WEEKLY_SESSION_LIMIT - state.weeklyCount);

  const actions = useMemo(
    () => ({
      refresh: load,

      generateSession: async (cookingMode: CookingMode, filters?: RecipeGenerationFilters) => {
        if (!householdId) return null;

        setState((s) => ({ ...s, generating: true, error: null }));

        try {
          const { matches } = await generateRecipeMatches({
            inventory,
            avoidances,
            isPremium,
            servings,
            cookingMode,
            filters,
          });
          const top = matches.slice(0, 3);

          // Nothing makeable from the current fridge: don't create a session
          // (so it doesn't burn a weekly count) and signal the empty result.
          if (top.length === 0) {
            setState((s) => ({ ...s, generating: false }));
            return { recipes: [], matches: [] };
          }

          const session = await createRecipeSession({
            householdId,
            cookingMode,
            avoidancesUsed: avoidances,
            fridgeSnapshot: inventory,
            isPremiumOptimized: isPremium,
          });

          const savedRecipes: RecipeRow[] = [];
          for (const match of top) {
            const usedIds = match.matchedItems
              .filter((m) => m.inFridge && m.inventoryLot)
              .map((m) => m.inventoryLot!.id);

            const recipe = await createRecipe({
              householdId,
              sessionId: session.id,
              title: match.title,
              description: match.description,
              timeMinutes: match.timeMinutes,
              complexity: match.complexity,
              servings: match.servingsBaseline,
              ingredients: match.ingredients,
              steps: match.steps,
              usedInventoryItemIds: usedIds,
              tags: match.tags,
              avoidanceTags: match.avoidanceTags,
            });
            savedRecipes.push(recipe);
          }

          setState((s) => ({
            ...s,
            generating: false,
            suggestions: top,
            currentSessionId: session.id,
            weeklyCount: s.weeklyCount + 1,
            savedRecipes: [...savedRecipes, ...s.savedRecipes],
          }));

          return { recipes: savedRecipes, matches: top };
        } catch (err) {
          setState((s) => ({
            ...s,
            generating: false,
            error: err instanceof Error ? err.message : "Could not generate recipes.",
          }));
          return null;
        }
      },

      generateFromInventory: (cookingMode: CookingMode) => {
        const matches = matchRecipes({ inventory, avoidances, isPremium, servings });
        setState((s) => ({ ...s, suggestions: matches.slice(0, 3) }));
        return matches.slice(0, 3);
      },

      toggleFavorite: async (recipeId: string, current: boolean) => {
        await toggleRecipeFavorite(recipeId, !current);
        setState((s) => ({
          ...s,
          savedRecipes: s.savedRecipes.map((r) =>
            r.id === recipeId ? { ...r, is_favorite: !current } : r,
          ),
          cookedRecipes: s.cookedRecipes.map((r) =>
            r.id === recipeId ? { ...r, is_favorite: !current } : r,
          ),
        }));
      },

      cookRecipe: async (input: {
        recipeId: string;
        usedItems: { normalizedName: string; amount?: number }[];
        servings?: number;
      }) => {
        if (!householdId) return;
        await recordCookedEventAndDepleteInventory({
          householdId,
          recipeId: input.recipeId,
          servings: input.servings ?? null,
          usedItems: input.usedItems,
        });
      },
    }),
    [householdId, inventory, avoidances, isPremium, servings, load],
  );

  return {
    ...state,
    canGenerate,
    remainingSessions,
    freeLimit: FREE_WEEKLY_SESSION_LIMIT,
    ...actions,
  };
}
