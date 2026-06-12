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
    vibe?: string;
  };
};

export function matchRecipes(
  input: RecipeMatcherInput,
  library: MockRecipe[] = RECIPE_LIBRARY,
): RecipeMatch[] {
  const { inventory, avoidances, isPremium } = input;
  // Key by canonical (alias-folded) name so a localized fridge item still
  // matches the English recipe library (CODE_REVIEW #7).
  const inventoryByNorm = new Map<string, InventoryLot>();
  for (const lot of inventory) {
    const key = canonicalFoodName(lot.normalized_name);
    if (!inventoryByNorm.has(key)) {
      inventoryByNorm.set(key, lot);
    }
  }

  const filters = input.filters;
  const filtered = library.filter((recipe) => {
    if (recipe.avoidanceTags.some((tag) => avoidances.includes(tag))) return false;
    if (filters?.mealType && recipe.mealType !== filters.mealType) return false;
    if (filters?.maxMinutes != null && recipe.timeMinutes > filters.maxMinutes) return false;
    if (filters?.vibe && !recipe.tags.includes(filters.vibe)) return false;
    return true;
  });

  const scored = filtered.map((recipe) => {
    const matchedItems: MatchedItem[] = recipe.ingredients.map((ing) => {
      const norm = canonicalFoodName(ing.name);
      const lot = inventoryByNorm.get(norm) ?? null;
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
      inventoryByNorm.has(canonicalFoodName(i.name)),
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

export function getRecipeFridgeLabel(match: RecipeMatch): string {
  if (match.matchCount === 0) return "";
  const urgentNames = match.matchedItems
    .filter((m) => m.isUrgent)
    .map((m) => m.ingredientName);
  if (urgentNames.length > 0) {
    return `Saves ${urgentNames[0]}`;
  }
  if (match.matchCount >= match.ingredients.length) {
    return "Have it all";
  }
  return `Uses ${match.matchCount} from fridge`;
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
