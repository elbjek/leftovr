import { i18n } from "@/i18n";
import { MockRecipe, RECIPE_LIBRARY } from "@/mocks/recipeLibrary";
import { canonicalFoodName, InventoryLot, resolveUrgency } from "./inventoryRules";

export type RecipeMatch = MockRecipe & {
  matchedItems: MatchedItem[];
  matchCount: number;
  totalRequired: number;
  urgentItemCount: number;
  /** Share of required ingredients present in the fridge (0..1). */
  coverage: number;
};

export type MatchedItem = {
  ingredientName: string;
  inventoryLot: InventoryLot | null;
  inFridge: boolean;
  isUrgent: boolean;
};

export type RecipeMatcherInput = {
  inventory: InventoryLot[];
  avoidances: string[];
  isPremium: boolean;
  servings?: number;
  filters?: {
    mealType?: "breakfast" | "lunch" | "dinner" | "snack";
    maxMinutes?: number;
    minMinutes?: number;
    vibe?: string;
  };
};

export function matchRecipes(
  input: RecipeMatcherInput,
  library: MockRecipe[] = RECIPE_LIBRARY,
): RecipeMatch[] {
  const { inventory, avoidances, isPremium } = input;
  const inventoryByNorm = new Map<string, { lot: InventoryLot; key: string }>();
  for (const lot of inventory) {
    const key = canonicalFoodName(lot.normalized_name);
    if (!inventoryByNorm.has(key)) {
      inventoryByNorm.set(key, { lot, key });
    }
  }

  const filters = input.filters;
  const filtered = library.filter((recipe) => {
    if (violatesAvoidances(recipe, avoidances)) return false;
    if (filters?.mealType && recipe.mealType !== filters.mealType) return false;
    if (filters?.maxMinutes != null && recipe.timeMinutes > filters.maxMinutes) return false;
    if (filters?.minMinutes != null && recipe.timeMinutes < filters.minMinutes) return false;
    if (filters?.vibe && !recipe.tags.includes(filters.vibe)) return false;
    return true;
  });

  const scored = filtered.map((recipe) => {
    const matchedItems: MatchedItem[] = recipe.ingredients.map((ing) => {
      const lot = findInventoryLotForIngredient(ing.name, inventoryByNorm);
      // Resolve urgency from expiry/age — the stored column is stale (CODE_REVIEW #2).
      const lotUrgency = lot ? resolveUrgency(lot) : null;
      const isUrgent = lotUrgency === "urgent" || lotUrgency === "use_soon";
      return {
        ingredientName: ing.name,
        inventoryLot: lot,
        inFridge: lot !== null,
        isUrgent,
      };
    });

    const matchCount = matchedItems.filter((m) => m.inFridge).length;
    const totalRequired = recipe.ingredients.filter((i) => i.required).length;
    const urgentItemCount = matchedItems.filter((m) => m.isUrgent).length;

    const required = recipe.ingredients.filter((i) => i.required);
    const matchedRequired = required.filter((i) =>
      findInventoryLotForIngredient(i.name, inventoryByNorm) !== null,
    ).length;
    const coverage =
      required.length === 0
        ? matchCount > 0
          ? 1
          : 0
        : matchedRequired / required.length;

    return { ...recipe, matchedItems, matchCount, totalRequired, urgentItemCount, coverage };
  });

  scored.sort((a, b) => {
    if (isPremium) {
      const urgDiff = b.urgentItemCount - a.urgentItemCount;
      if (urgDiff !== 0) return urgDiff;
    }
    const matchDiff = b.matchCount - a.matchCount;
    if (matchDiff !== 0) return matchDiff;
    return a.timeMinutes - b.timeMinutes;
  });

  return scored;
}

function violatesAvoidances(recipe: MockRecipe, avoidances: string[]) {
  if (avoidances.length === 0) return false;
  const normalizedAvoidances = avoidances.map((avoidance) => avoidance.toLowerCase().trim());
  const searchable = [
    ...recipe.avoidanceTags,
    ...recipe.ingredients.map((ingredient) => ingredient.name),
  ].map((value) => value.toLowerCase());

  return normalizedAvoidances.some((avoidance) =>
    searchable.some((value) => value.includes(avoidance)),
  );
}

function findInventoryLotForIngredient(
  ingredientName: string,
  inventoryByNorm: Map<string, { lot: InventoryLot; key: string }>,
) {
  const ingredientKey = simplifyFoodKey(canonicalFoodName(ingredientName));
  const exact = inventoryByNorm.get(ingredientKey);
  if (exact) return exact.lot;

  for (const { lot, key } of inventoryByNorm.values()) {
    const lotKey = simplifyFoodKey(key);
    if (
      lotKey === ingredientKey ||
      lotKey.includes(ingredientKey) ||
      ingredientKey.includes(lotKey)
    ) {
      return lot;
    }
  }

  return null;
}

function simplifyFoodKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(fresh|cooked|raw|mixed|chopped|sliced|diced)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ies\b/g, "y")
    .replace(/oes\b/g, "o")
    .replace(/s\b/g, "");
}

/**
 * Keep only recipes you can mostly cook from the fridge (>= minCoverage of the
 * required ingredients, and at least one fridge item), best first.
 */
export function selectMakeableRecipes(
  matches: RecipeMatch[],
  opts: { isPremium: boolean; minCoverage?: number },
): RecipeMatch[] {
  const minCoverage = opts.minCoverage ?? 0.5;
  const makeable = matches.filter((m) => m.matchCount >= 1 && m.coverage >= minCoverage);

  makeable.sort((a, b) => {
    if (opts.isPremium) {
      const urgDiff = b.urgentItemCount - a.urgentItemCount;
      if (urgDiff !== 0) return urgDiff;
    }
    const covDiff = b.coverage - a.coverage;
    if (covDiff !== 0) return covDiff;
    const matchDiff = b.matchCount - a.matchCount;
    if (matchDiff !== 0) return matchDiff;
    return a.timeMinutes - b.timeMinutes;
  });

  return makeable;
}

export function formatComplexity(complexity: string): string {
  const key = complexity === "simple" ? "simple" : complexity === "medium" ? "medium" : "involved";
  return i18n.t(`recipes.complexity.${key}`);
}

export function formatTimeLabel(minutes: number): string {
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0
      ? i18n.t("recipes.time.hoursMinutes", { hours: hrs, mins })
      : i18n.t("recipes.time.hours", { count: hrs });
  }
  return i18n.t("recipes.time.minutes", { count: minutes });
}
