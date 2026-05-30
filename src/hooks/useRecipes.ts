import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createRecipe,
  createRecipeSession,
  CookingMode,
  FREE_WEEKLY_SESSION_LIMIT,
  getWeeklySessionCount,
  listHouseholdRecipes,
  RecipeRow,
  toggleRecipeFavorite,
} from "@/repositories/recipeRepository";
import {
  matchRecipes,
  RecipeMatch,
} from "@/services/recipeService";
import { InventoryLot } from "@/services/inventoryRules";
import { recordCookedEventAndDepleteInventory } from "@/repositories/inventoryRepository";

type RecipesState = {
  loading: boolean;
  generating: boolean;
  suggestions: RecipeMatch[];
  savedRecipes: RecipeRow[];
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
  },
) {
  const { inventory, avoidances, isPremium, servings } = options;

  const [state, setState] = useState<RecipesState>({
    loading: Boolean(householdId),
    generating: false,
    suggestions: [],
    savedRecipes: [],
    weeklyCount: 0,
    error: null,
  });

  const load = useCallback(async () => {
    if (!householdId) {
      setState({ loading: false, generating: false, suggestions: [], savedRecipes: [], weeklyCount: 0, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const [recipes, count] = await Promise.all([
        listHouseholdRecipes(householdId),
        getWeeklySessionCount(householdId),
      ]);
      setState((s) => ({ ...s, loading: false, savedRecipes: recipes, weeklyCount: count }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Could not load recipes.",
      }));
    }
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const canGenerate = isPremium || state.weeklyCount < FREE_WEEKLY_SESSION_LIMIT;
  const remainingSessions = Math.max(0, FREE_WEEKLY_SESSION_LIMIT - state.weeklyCount);

  const actions = useMemo(
    () => ({
      refresh: load,

      generateSession: async (cookingMode: CookingMode) => {
        if (!householdId) return null;

        setState((s) => ({ ...s, generating: true, error: null }));

        try {
          const matches = matchRecipes({ inventory, avoidances, isPremium, servings });
          const top = matches.slice(0, 3);

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
            weeklyCount: s.weeklyCount + 1,
            savedRecipes: [...savedRecipes, ...s.savedRecipes],
          }));

          return { session, matches: top, recipes: savedRecipes };
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
        }));
      },

      cookRecipe: async (input: {
        recipeId: string;
        usedItemIds: string[];
        servings?: number;
      }) => {
        if (!householdId) return;
        await recordCookedEventAndDepleteInventory({
          householdId,
          recipeId: input.recipeId,
          servings: input.servings ?? null,
          usedItemIds: input.usedItemIds,
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
