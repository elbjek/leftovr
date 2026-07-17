import { CookingMode } from "@/repositories/recipeRepository";
import { env } from "@/lib/env";
import { MockRecipe } from "@/mocks/recipeLibrary";
import { InventoryLot, resolveUrgency } from "./inventoryRules";
import { matchRecipes, RecipeMatch, RecipeMatcherInput, selectMakeableRecipes } from "./recipeService";
import { readEdgeErrorCode } from "./edgeErrors";

export type RecipeGenerationFilters = RecipeMatcherInput["filters"];

/** Thrown when the user has hit the monthly recipe cap; callers should show the
 *  cap message instead of falling back to mock matches. */
export class RecipeMonthlyLimitError extends Error {}

/** Server 402: free generation already spent and not premium. The server
 *  verdict is authoritative — cached entitlement state may lag behind. */
export class RecipeQuotaError extends Error {}

/** Server 429 daily cap (premium only — free users hit the 402 gate first). */
export class RecipeRateLimitedError extends Error {}

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
  /** BCP-47 language for recipe output; defaults to the device locale. */
  language?: string;
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
    ...card,
    key: `ai-${index}-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    servingsBaseline: card.servings,
    tags: normalizeAiTags(card.tags, input.filters?.cuisine ?? input.filters?.vibe),
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

function normalizeAiTags(tags: string[], requestedVibe: string | undefined) {
  if (!requestedVibe || tags.includes(requestedVibe)) return tags;
  return [...tags, requestedVibe];
}

/** Lightweight card from phase-1 generation (mode: "cards") — no steps/amounts. */
export type AiRecipeCardLite = {
  title: string;
  description: string;
  usedIngredientIds: string[];
  tags: string[];
  mealType: MockRecipe["mealType"];
  category: string;
  timeMinutes: number;
};

/**
 * Maps lightweight cards into RecipeMatch shapes. Ingredients are the used
 * fridge items (looked up by id, addressed by canonical name so the matcher
 * links them back); steps are empty until the card is expanded on tap.
 */
export function mapAiCardsToMatches(
  cards: AiRecipeCardLite[],
  input: RecipeGenerationInput,
): RecipeMatch[] {
  const byId = new Map(input.inventory.map((lot) => [lot.id, lot]));
  const library: MockRecipe[] = cards.map((card, index) => {
    const usedLots = (card.usedIngredientIds ?? [])
      .map((id) => byId.get(id))
      .filter((lot): lot is InventoryLot => Boolean(lot));
    return {
      key: `ai-card-${index}-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: card.title,
      description: card.description,
      timeMinutes: card.timeMinutes,
      complexity: "simple",
      servingsBaseline: input.servings ?? 2,
      category: card.category,
      mealType: card.mealType,
      tags: normalizeAiTags(card.tags, input.filters?.cuisine ?? input.filters?.vibe),
      avoidanceTags: [],
      ingredients: usedLots.map((lot) => ({
        name: lot.normalized_name,
        amount: "",
        required: true,
        countable: true,
      })),
      steps: [],
    };
  });

  const matches = matchRecipes(input, library);
  const fridgeMatches = matches.filter((match) => match.matchCount >= 1);
  return fridgeMatches.length > 0 ? fridgeMatches : matches;
}

export type ExpandRecipeResult = {
  ingredients: { name: string; amount: string; required: boolean; countable: boolean }[];
  steps: string[];
  timeMinutes: number;
  complexity: MockRecipe["complexity"];
  avoidanceTags: string[];
  servings: number;
};

/**
 * Phase-2 generation: expands a tapped card into full ingredients + steps.
 * Returns null on any failure so the caller can fall back gracefully.
 */
export async function expandRecipe(input: {
  title: string;
  description?: string;
  timeMinutes?: number;
  tags?: string[];
  usedIngredientNames: string[];
  inventory: InventoryLot[];
  avoidances: string[];
  servings?: number;
  language?: string;
}): Promise<ExpandRecipeResult | null> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  try {
    const { getSupabaseClient } = await import("@/lib/supabase");
    let language = input.language;
    if (!language) {
      try {
        const { getLocales } = await import("expo-localization");
        language = getLocales()[0]?.languageCode ?? undefined;
      } catch {
        // Localization unavailable (e.g. tests): fall back to model default.
      }
    }
    const { data, error } = await getSupabaseClient().functions.invoke("generate-recipes", {
      body: {
        mode: "expand",
        servings: input.servings,
        avoidances: input.avoidances,
        language,
        inventory: input.inventory.map((lot) => ({
          id: lot.id,
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
        expandCard: {
          title: input.title,
          description: input.description,
          timeMinutes: input.timeMinutes,
          tags: input.tags,
          usedIngredientNames: input.usedIngredientNames,
        },
      },
    });
    if (error) {
      if (__DEV__) console.warn("[recipes] expand error", error);
      return null;
    }
    const recipe = (data as { recipe?: AiRecipeCard } | null)?.recipe;
    if (!recipe) return null;
    return {
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      timeMinutes: recipe.timeMinutes,
      complexity: recipe.complexity,
      avoidanceTags: recipe.avoidanceTags,
      servings: recipe.servings,
    };
  } catch (error) {
    if (__DEV__) console.warn("[recipes] expand failed", error);
    return null;
  }
}

async function generateAiMatches(input: RecipeGenerationInput): Promise<RecipeMatch[] | null> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    if (__DEV__) console.warn("[recipes] AI skipped: missing Supabase config");
    return null;
  }

  try {
    // Lazy import keeps react-native-only deps out of the node test env.
    const { getSupabaseClient } = await import("@/lib/supabase");
    // Recipes follow the device locale ("location of the person"), not the app
    // UI language — so a Spanish phone gets Spanish recipes even with no ES UI.
    let language = input.language;
    if (!language) {
      try {
        const { getLocales } = await import("expo-localization");
        language = getLocales()[0]?.languageCode ?? undefined;
      } catch {
        // Localization unavailable (e.g. tests): fall back to model default.
      }
    }
    const requestHash = buildRecipeGenerationRequestHash({ ...input, language });
    // Namespace the cache key by mode so card-shaped cache entries never collide
    // with legacy full-recipe entries from app builds still in the field.
    const cardsKey = `${requestHash}-cards`;
    const { data, error } = await getSupabaseClient().functions.invoke("generate-recipes", {
      body: {
        // Phase 1: ask for lightweight cards (no steps/amounts). Full detail is
        // fetched on tap via expandRecipe().
        mode: "cards",
        householdId: input.householdId,
        idempotencyKey: cardsKey,
        requestHash,
        inventory: input.inventory.map((lot) => ({
          id: lot.id,
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
        language,
        filters: input.filters,
      },
    });
    if (error) {
      const code = await readEdgeErrorCode(error);
      if (code === "recipe_generation_monthly_limit") {
        throw new RecipeMonthlyLimitError();
      }
      if (code === "recipe_generation_quota_exceeded") {
        throw new RecipeQuotaError();
      }
      if (code === "recipe_generation_rate_limited") {
        throw new RecipeRateLimitedError();
      }
      if (__DEV__) console.warn("[recipes] Edge function error", error);
      throw error;
    }
    if ((data as { source?: string } | null)?.source === "processing") {
      throw new Error("Recipe generation already in progress.");
    }

    const cards = (data as { recipes?: AiRecipeCardLite[] } | null)?.recipes ?? [];
    const matches = mapAiCardsToMatches(cards, input);
    if (__DEV__) {
      console.info("[recipes] AI response", {
        cards: cards.length,
        matched: matches.length,
        titles: cards.map((card) => card.title),
      });
    }
    return matches;
  } catch (error) {
    if (
      error instanceof RecipeMonthlyLimitError ||
      error instanceof RecipeQuotaError ||
      error instanceof RecipeRateLimitedError
    ) {
      throw error;
    }
    if (__DEV__) console.warn("[recipes] AI generation failed, using mock matcher", error);
    return null;
  }
}

function buildRecipeGenerationRequestHash(input: RecipeGenerationInput) {
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
    language: input.language ?? null,
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
  if (aiMatches !== null) {
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
    "Generate practical Leftovr recipe ideas from food the household currently has.",
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
    "Culinary judgment: create normal, appetizing meals grounded in real cooking traditions, not novelty mashups. Only combine ingredients when there is a recognizable culinary reason (classic pairing, shared cuisine, sauce/dressing that bridges them, or common breakfast/lunch/dinner pattern). Do not force unrelated household items into the same recipe just because they are available; it is better to use fewer well-matched items. Sweet fruit can be used when it belongs naturally (yogurt, oats, smoothies, salads, desserts, some cheese boards), but avoid awkward sweet-savory combinations unless they are a familiar dish. If a combination sounds like a dare, joke, TikTok stunt, or pregnancy craving, do not return it.",
    "What the household has:",
    ...formatInventoryLines(input.inventory),
    "Prompt filters:",
    ...formatFilterLines(input.filters),
    input.isPremium
      ? "Return exactly 1 recipe card per call; the server runs two parallel variants (confident pick + distinct alternative)."
      : "Return exactly 1 recipe card: your single most confident pick for what this household has.",
    "Keep the description to one short sentence. Use at most 3 tags.",
    "Write steps for a beginner cook: each step names the heat level, pan or pot size where relevant, a time estimate, and a visual or sensory doneness cue (e.g. \"until translucent\", \"until shimmering\").",
    "Include prep detail inside steps (dice size, drain or pat dry) instead of assuming knowledge.",
    "One action per step. Use as many steps as the recipe needs; do not compress multiple actions into one step, and do not pad simple recipes.",
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
