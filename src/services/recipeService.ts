import { MockRecipe, RECIPE_LIBRARY } from "@/mocks/recipeLibrary";
import { InventoryLot, normalizeFoodName, UrgencyBand } from "./inventoryRules";

export type RecipeMatch = MockRecipe & {
  matchedItems: MatchedItem[];
  matchCount: number;
  totalRequired: number;
  urgentItemCount: number;
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
};

export function matchRecipes(input: RecipeMatcherInput): RecipeMatch[] {
  const { inventory, avoidances, isPremium } = input;
  const inventoryByNorm = new Map<string, InventoryLot>();
  for (const lot of inventory) {
    if (!inventoryByNorm.has(lot.normalized_name)) {
      inventoryByNorm.set(lot.normalized_name, lot);
    }
  }

  const filtered = RECIPE_LIBRARY.filter((recipe) => {
    return !recipe.avoidanceTags.some((tag) => avoidances.includes(tag));
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

    return { ...recipe, matchedItems, matchCount, totalRequired, urgentItemCount };
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
