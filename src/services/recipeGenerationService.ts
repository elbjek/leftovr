import { CookingMode } from "@/repositories/recipeRepository";
import { InventoryLot } from "./inventoryRules";
import { matchRecipes, RecipeMatch, RecipeMatcherInput } from "./recipeService";

export type RecipeGenerationFilters = RecipeMatcherInput["filters"];

export type RecipeGenerationInput = {
  inventory: InventoryLot[];
  avoidances: string[];
  isPremium: boolean;
  cookingMode: CookingMode;
  servings?: number;
  filters?: RecipeGenerationFilters;
};

export type RecipeGenerationResult = {
  source: "mock";
  matches: RecipeMatch[];
  prompt: string;
};

export async function generateRecipeMatches(input: RecipeGenerationInput): Promise<RecipeGenerationResult> {
  return {
    source: "mock",
    matches: matchRecipes(input),
    prompt: buildRecipeGenerationPrompt(input),
  };
}

export function buildRecipeGenerationPrompt(input: RecipeGenerationInput) {
  const lines = [
    "Generate practical Chomp recipe ideas from household fridge contents.",
    "Tone: low-effort, approximate, useful, opportunity-framed. Avoid guilt, exact expiry dates, calories, and nutrition tracking.",
    `Cooking mode: ${input.cookingMode}.`,
    `Servings: ${input.servings ?? 2}.`,
    `Premium optimized: ${input.isPremium ? "yes" : "no"}.`,
    `Avoidances: ${input.avoidances.length > 0 ? input.avoidances.join(", ") : "none"}.`,
    "Fridge contents:",
    ...formatInventoryLines(input.inventory),
    "Prompt filters:",
    ...formatFilterLines(input.filters),
    "Return multiple recipe cards with title, description, timeMinutes, complexity, servings, ingredients, steps, usedInventoryItemIds, tags, and avoidanceTags.",
  ];

  return lines.join("\n");
}

function formatInventoryLines(inventory: InventoryLot[]) {
  if (inventory.length === 0) return ["- empty or unknown"];

  return inventory.map((lot) => {
    const amount =
      lot.net_amount != null && lot.net_unit
        ? `${lot.net_amount}${lot.net_unit}`
        : lot.quantity != null
          ? `${lot.quantity}`
          : "unknown amount";
    return `- ${lot.name} (${lot.normalized_name}); category=${lot.category}; urgency=${lot.urgency}; amount=${amount}; partial=${lot.partial_state}`;
  });
}

function formatFilterLines(filters: RecipeGenerationFilters | undefined) {
  return [
    `- meal type: ${filters?.mealType ?? "any"}`,
    `- max time: ${filters?.maxMinutes != null ? `${filters.maxMinutes} minutes` : "any"}`,
    `- vibe/tag: ${filters?.vibe ?? "any"}`,
  ];
}
