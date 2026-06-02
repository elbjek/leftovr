import { MockRecipe, RECIPE_LIBRARY } from "@/mocks/recipeLibrary";
import { InventoryLot, normalizeFoodName } from "./inventoryRules";

export type RecipeMatch = MockRecipe & {
  matchedItems: MatchedItem[];
  matchCount: number;
  totalRequired: number;
  urgentItemCount: number;
  /** Share of required, non-staple ingredients present in the fridge (0..1). */
  coverage: number;
};

/**
 * Ingredients assumed to be on hand, so they don't count against a recipe's
 * fridge coverage (you wouldn't avoid a recipe just because it needs salt).
 */
export const STAPLE_INGREDIENTS = new Set<string>([
  "olive oil",
  "garlic",
  "salt",
  "pepper",
  "butter",
  "water",
]);

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

export function matchRecipes(input: RecipeMatcherInput): RecipeMatch[] {
  const { inventory, avoidances, isPremium } = input;
  const inventoryByNorm = new Map<string, InventoryLot>();
  for (const lot of inventory) {
    if (!inventoryByNorm.has(lot.normalized_name)) {
      inventoryByNorm.set(lot.normalized_name, lot);
    }
  }

  const filters = input.filters;
  const filtered = RECIPE_LIBRARY.filter((recipe) => {
    if (recipe.avoidanceTags.some((tag) => avoidances.includes(tag))) return false;
    if (filters?.mealType && recipe.mealType !== filters.mealType) return false;
    if (filters?.maxMinutes != null && recipe.timeMinutes > filters.maxMinutes) return false;
    if (filters?.vibe && !recipe.tags.includes(filters.vibe)) return false;
    return true;
  });

  const scored = filtered.map((recipe) => {
    const matchedItems: MatchedItem[] = recipe.ingredients.map((ing) => {
      const norm = normalizeFoodName(ing.name);
      const lot = inventoryByNorm.get(norm) ?? null;
      const isUrgent = lot?.urgency === "urgent" || lot?.urgency === "use_soon";
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

    const requiredNonStaple = recipe.ingredients.filter(
      (i) => i.required && !STAPLE_INGREDIENTS.has(normalizeFoodName(i.name)),
    );
    const matchedRequiredNonStaple = requiredNonStaple.filter((i) =>
      inventoryByNorm.has(normalizeFoodName(i.name)),
    ).length;
    const coverage =
      requiredNonStaple.length === 0
        ? matchCount > 0
          ? 1
          : 0
        : matchedRequiredNonStaple / requiredNonStaple.length;

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
 * required non-staple ingredients, and at least one fridge item), best first.
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
  if (complexity === "simple") return "Simple";
  if (complexity === "medium") return "Medium";
  return "Involved";
}

export function formatTimeLabel(minutes: number): string {
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
  }
  return `${minutes} min`;
}
