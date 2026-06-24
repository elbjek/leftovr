import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createRecipe,
  createRecipeSession,
  CookingMode,
  listCookedEventRows,
  listHouseholdRecipes,
  listUserFavoriteRecipeIds,
  RecipeRow,
  toggleRecipeFavorite,
} from "@/repositories/recipeRepository";
import {
  matchRecipes,
  RecipeMatch,
} from "@/services/recipeService";
import { generateRecipeMatches, RecipeGenerationFilters, RecipeMonthlyLimitError } from "@/services/recipeGenerationService";
import { useTranslation } from "react-i18next";
import { ingredientSignature } from "@/lib";
import { InventoryLot, resolveUrgency } from "@/services/inventoryRules";
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
  /** True once a session was created this app session (free taste consumed). */
  consumedFreeGeneration: boolean;
  error: string | null;
};

export function useRecipes(
  householdId: string | null | undefined,
  options: {
    inventory: InventoryLot[];
    avoidances: string[];
    isPremium: boolean;
    /** Profile flag: the user's one-time free generation is already spent. */
    freeGenerationUsed: boolean;
    servings?: number;
    userId?: string;
  },
) {
  const { inventory, avoidances, isPremium, freeGenerationUsed, servings, userId } = options;
  const { t } = useTranslation();
  const generationInFlightRef = useRef(false);
  // Mirrors saved recipes so a generation can dedupe against them without the
  // callback closing over a stale state snapshot.
  const savedRecipesRef = useRef<RecipeRow[]>([]);

  const [state, setState] = useState<RecipesState>({
    loading: Boolean(householdId),
    generating: false,
    suggestions: [],
    currentSessionId: null,
    savedRecipes: [],
    cookedRecipes: [],
    cookedSummaries: {},
    consumedFreeGeneration: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (!householdId) {
      setState((s) => ({
        loading: false,
        generating: false,
        suggestions: [],
        currentSessionId: null,
        savedRecipes: [],
        cookedRecipes: [],
        cookedSummaries: {},
        consumedFreeGeneration: s.consumedFreeGeneration,
        error: null,
      }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const [recipes, favoriteIds, cookedEventRows] = await Promise.all([
        listHouseholdRecipes(householdId),
        listUserFavoriteRecipeIds(),
        listCookedEventRows(householdId),
      ]);

      // One cooked_events fetch feeds counts, summaries, and the cooked tab
      // (used to be three separate queries).
      const cookedSummaries: Record<string, CookedSummary> = {};
      const myCookedCounts = new Map<string, number>();
      for (const row of cookedEventRows) {
        const summary = (cookedSummaries[row.recipe_id] ??= { count: 0, cookedBy: [] });
        summary.count += 1;
        if (!summary.cookedBy.includes(row.cooked_by)) summary.cookedBy.push(row.cooked_by);
        if (!userId || row.cooked_by === userId) {
          myCookedCounts.set(row.recipe_id, (myCookedCounts.get(row.recipe_id) ?? 0) + 1);
        }
      }

      const savedRecipes = recipes.map((row) => ({
        ...row,
        is_favorite: favoriteIds.has(row.id),
        cooked_count: cookedSummaries[row.id]?.count ?? 0,
      }));

      // Cooked tab: recipes the current user has cooked, most recent first
      // (event rows arrive newest-first), with their per-user cook count.
      const recipesById = new Map(savedRecipes.map((row) => [row.id, row]));
      const cookedRecipes: RecipeRow[] = [];
      for (const row of cookedEventRows) {
        if (userId && row.cooked_by !== userId) continue;
        const recipe = recipesById.get(row.recipe_id);
        if (!recipe || cookedRecipes.some((r) => r.id === recipe.id)) continue;
        cookedRecipes.push({ ...recipe, cooked_count: myCookedCounts.get(recipe.id) ?? 0 });
      }

      setState((s) => ({
        ...s,
        loading: false,
        savedRecipes,
        cookedRecipes,
        cookedSummaries,
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

  useEffect(() => {
    savedRecipesRef.current = state.savedRecipes;
  }, [state.savedRecipes]);

  // One-time free taste: free users get exactly one generation, ever. The
  // profile flag covers past sessions; the local flag covers the one just
  // created (profile refetch lags the DB trigger).
  const canGenerate = isPremium || (!freeGenerationUsed && !state.consumedFreeGeneration);

  const actions = useMemo(
    () => ({
      refresh: load,

      generateSession: async (cookingMode: CookingMode, filters?: RecipeGenerationFilters) => {
        if (!householdId) return null;
        if (generationInFlightRef.current) {
          return { recipes: [], matches: [] };
        }

        generationInFlightRef.current = true;
        setState((s) => ({ ...s, generating: true, error: null }));

        try {
          const { matches, source } = await generateRecipeMatches({
            householdId,
            inventory,
            avoidances,
            isPremium,
            servings,
            cookingMode,
            filters,
          });
          if (__DEV__) {
            console.info("[recipes] generation result", {
              source,
              matchCount: matches.length,
            });
          }
          // Premium sees two distinct options; free gets the single best pick
          // (fewer cards also keeps complex generations fast).
          const candidates = matches.slice(0, isPremium ? 2 : 1);

          // Drop recipes whose ingredient set already exists — saved in a past
          // generation, or duplicated across this run's premium variants — so
          // the recipe list doesn't accumulate same-dish-different-title dupes.
          const existingSignatures = new Set(
            savedRecipesRef.current.map((recipe) =>
              ingredientSignature(recipe.ingredients as { name?: string }[]),
            ),
          );
          const runSignatures = new Set<string>();
          const top = candidates.filter((match) => {
            const signature = ingredientSignature(match.ingredients);
            if (!signature || existingSignatures.has(signature) || runSignatures.has(signature)) {
              return false;
            }
            runSignatures.add(signature);
            return true;
          });

          // Nothing new makeable (all duplicates or empty): don't create a
          // session (so it doesn't burn a weekly count) and signal empty.
          if (top.length === 0) {
            setState((s) => ({ ...s, generating: false }));
            return { recipes: [], matches: [] };
          }

          const session = await createRecipeSession({
            householdId,
            cookingMode,
            avoidancesUsed: avoidances,
            fridgeSnapshot: inventory.map((lot) => ({
              normalized_name: lot.normalized_name,
              category: lot.category,
              quantity: lot.quantity,
              unit: lot.unit,
              urgency: resolveUrgency(lot),
            })),
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
            consumedFreeGeneration: true,
            savedRecipes: [...savedRecipes, ...s.savedRecipes],
          }));

          return { recipes: savedRecipes, matches: top };
        } catch (err) {
          if (err instanceof RecipeMonthlyLimitError) {
            setState((s) => ({ ...s, generating: false, error: t("recipes.monthlyLimit") }));
            return null;
          }
          if (__DEV__) console.warn("[recipes] generation persistence failed", err);
          setState((s) => ({
            ...s,
            generating: false,
            error: err instanceof Error ? err.message : "Could not generate recipes.",
          }));
          return null;
        } finally {
          generationInFlightRef.current = false;
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
    ...actions,
  };
}
