import { CookingMode } from "@/repositories/recipeRepository";
import { env } from "@/lib/env";
import { MockRecipe } from "@/mocks/recipeLibrary";
import { InventoryLot, resolveUrgency } from "./inventoryRules";
import { matchRecipes, RecipeMatch, RecipeMatcherInput, selectMakeableRecipes } from "./recipeService";

export type RecipeGenerationFilters = RecipeMatcherInput["filters"];

export type AiRecipeCard = {
  title: string;
  description: string;
  timeMinutes: number;
  complexity: MockRecipe["complexity"];
  servings: number;
  mealType: MockRecipe["mealType"];
  category: string;
  tags: string[];
  avoidanceTags: string[];
  ingredients: { name: string; amount: string; required: boolean; countable: boolean }[];
  steps: string[];
};

export type RecipeGenerationInput = {
  householdId?: string;
  inventory: InventoryLot[];
  avoidances: string[];
  isPremium: boolean;
  cookingMode: CookingMode;
  servings?: number;
  filters?: RecipeGenerationFilters;
};

export type RecipeGenerationResult = {
  source: "ai" | "mock";
  matches: RecipeMatch[];
  prompt: string;
};

/**
 * Converts AI recipe cards into the existing RecipeMatch shape by scoring them
 * with the same matcher used for the curated library. Fridge linkage is computed
 * here via canonical-name matching rather than trusted from the model, and recipes
 * that use no fridge item are dropped (spec: every generated recipe must come from
 * the fridge inventory).
 */
export function mapAiRecipesToMatches(
  cards: AiRecipeCard[],
  input: RecipeGenerationInput,
): RecipeMatch[] {
  const library: MockRecipe[] = cards.map((card, index) => ({
    key: `ai-${index}-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: card.title,
    description: card.description,
    timeMinutes: card.timeMinutes,
    complexity: card.complexity,
    servingsBaseline: card.servings,
    category: card.category,
    mealType: card.mealType,
    tags: card.tags,
    avoidanceTags: card.avoidanceTags,
    ingredients: card.ingredients,
    steps: card.steps,
  }));

  const matches = matchRecipes(input, library);
  const fridgeMatches = matches.filter((match) => match.matchCount >= 1);

  // If Anthropic returned recipe cards but local name matching cannot link
  // them back to inventory, still keep the paid AI output instead of silently
  // falling back to curated mock recipes. The prompt already requires every
  // recipe to use fridge items; this preserves user-visible output while logs
  // expose the matching gap.
  return fridgeMatches.length > 0 ? fridgeMatches : matches;
}

async function generateAiMatches(input: RecipeGenerationInput): Promise<RecipeMatch[] | null> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    if (__DEV__) console.warn("[recipes] AI skipped: missing Supabase config");
    return null;
  }

  const prompt = buildRecipeGenerationPrompt(input);
  if (__DEV__) {
    console.info("[recipes] client prompt\n" + prompt);
  }

  try {
    // Lazy import keeps react-native-only supabase deps out of the node test env.
    const { getSupabaseClient } = await import("@/lib/supabase");
    const requestHash = buildRecipeGenerationRequestHash(input);
    const { data, error } = await getSupabaseClient().functions.invoke("generate-recipes", {
      body: {
        householdId: input.householdId,
        idempotencyKey: requestHash,
        requestHash,
        inventory: input.inventory.map((lot) => ({
          name: lot.name,
          normalized_name: lot.normalized_name,
          category: lot.category,
          urgency: resolveUrgency(lot),
          quantity: lot.quantity,
          unit: lot.unit,
          net_amount: lot.net_amount,
          net_unit: lot.net_unit,
          partial_state: lot.partial_state,
        })),
        avoidances: input.avoidances,
        isPremium: input.isPremium,
        cookingMode: input.cookingMode,
        servings: input.servings,
        filters: input.filters,
      },
    });
    if (error) {
      if (__DEV__) console.warn("[recipes] Edge function error", error);
      throw error;
    }
    if ((data as { source?: string } | null)?.source === "processing") {
      throw new Error("Recipe generation already in progress.");
    }

    const cards = (data as { recipes?: AiRecipeCard[] } | null)?.recipes ?? [];
    const matches = mapAiRecipesToMatches(cards, input);
    if (__DEV__) {
      console.info("[recipes] AI response", {
        cards: cards.length,
        matched: matches.length,
        titles: cards.map((card) => card.title),
      });
    }
    return matches.length > 0 ? matches : null;
  } catch (error) {
    if (__DEV__) console.warn("[recipes] AI generation failed, using mock matcher", error);
    return null;
  }
}

export function buildRecipeGenerationRequestHash(input: RecipeGenerationInput) {
  const stable = JSON.stringify({
    householdId: input.householdId ?? null,
    inventory: input.inventory
      .map((lot) => ({
        id: lot.id,
        name: lot.normalized_name,
        quantity: lot.quantity,
        unit: lot.unit,
        partial: lot.partial_state,
        netAmount: lot.net_amount,
        netUnit: lot.net_unit,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    avoidances: [...input.avoidances].sort(),
    cookingMode: input.cookingMode,
    servings: input.servings ?? 2,
    filters: input.filters ?? null,
  });

  return `recipe-${hashString(stable)}`;
}

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export async function generateRecipeMatches(input: RecipeGenerationInput): Promise<RecipeGenerationResult> {
  const aiMatches = await generateAiMatches(input);
  if (aiMatches) {
    if (__DEV__) console.info("[recipes] using ai matches", { count: aiMatches.length });
    return {
      source: "ai",
      matches: aiMatches,
      prompt: buildRecipeGenerationPrompt(input),
    };
  }

  const scored = matchRecipes(input);
  const makeable = selectMakeableRecipes(scored, { isPremium: input.isPremium });
  // Prefer recipes you can mostly cook; if none clear the bar, fall back to any
  // recipe that uses at least one fridge item so Generate is never a no-op when
  // the fridge has something. An empty fridge still yields nothing.
  const matches =
    makeable.length > 0
      ? makeable
      : selectMakeableRecipes(scored, { isPremium: input.isPremium, minCoverage: 0 });

  if (__DEV__) console.info("[recipes] using mock matches", { count: matches.length });

  return {
    source: "mock",
    matches,
    prompt: buildRecipeGenerationPrompt(input),
  };
}

export function buildRecipeGenerationPrompt(input: RecipeGenerationInput) {
  const lines = [
    "Generate practical Leftovr recipe ideas from household fridge contents.",
    "Tone: low-effort, approximate, useful, opportunity-framed. Avoid guilt, exact expiry dates, calories, and nutrition tracking.",
    `Cooking mode: ${input.cookingMode}.`,
    `Servings: ${input.servings ?? 2}.`,
    `Premium optimized: ${input.isPremium ? "yes" : "no"}.`,
    `Hard serving constraint: recipe servings MUST equal ${input.servings ?? 2}.`,
    `Hard dietary constraints: ${
      input.avoidances.length > 0
        ? `avoid ${input.avoidances.join(", ")}. Do not include these in ingredients, steps, substitutions, or optional toppings.`
        : "none"
    }`,
    "Culinary judgment: create normal, appetizing meals grounded in real cooking traditions, not novelty mashups. Only combine ingredients when there is a recognizable culinary reason (classic pairing, shared cuisine, sauce/dressing that bridges them, or common breakfast/lunch/dinner pattern). Do not force unrelated fridge items into the same recipe just because they are available; it is better to use fewer well-matched fridge items. Sweet fruit can be used when it belongs naturally (yogurt, oats, smoothies, salads, desserts, some cheese boards), but avoid awkward sweet-savory combinations unless they are a familiar dish. If a combination sounds like a dare, joke, TikTok stunt, or pregnancy craving, do not return it.",
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
    return `- ${lot.name} (${lot.normalized_name}); category=${lot.category}; urgency=${resolveUrgency(lot)}; amount=${amount}; partial=${lot.partial_state}`;
  });
}

function formatFilterLines(filters: RecipeGenerationFilters | undefined) {
  return [
    `- meal type: ${filters?.mealType ?? "any"}`,
    `- max time: ${filters?.maxMinutes != null ? `${filters.maxMinutes} minutes` : "any"}`,
    `- min time: ${filters?.minMinutes != null ? `${filters.minMinutes} minutes` : "any"}`,
    `- vibe/tag: ${filters?.vibe ?? "any"}`,
  ];
}
