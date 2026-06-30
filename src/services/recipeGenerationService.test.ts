import { describe, expect, it } from "vitest";
import {
  AiRecipeCard,
  AiRecipeCardLite,
  buildRecipeGenerationPrompt,
  generateRecipeMatches,
  mapAiCardsToMatches,
  mapAiRecipesToMatches,
  RecipeGenerationInput,
} from "./recipeGenerationService";

const input: RecipeGenerationInput = {
  inventory: [
    {
      id: "spinach-1",
      name: "Spinach",
      normalized_name: "spinach",
      brand_name: null,
      category: "vegetables",
      quantity: 1,
      unit: "bag",
      net_amount: 200,
      net_unit: "g",
      partial_state: "full",
      shelf_life_range: "2-4 days",
      source: "receipt",
      added_by: "user-1",
      added_by_name: "Test User",
      added_at: "2026-06-01T12:00:00.000Z",
      removed_at: null,
      expires_at: null,
      purchase_price: null,
      purchase_amount: null,
    },
  ],
  avoidances: ["dairy"],
  isPremium: false,
  cookingMode: "household" as const,
  servings: 2,
  filters: {
    mealType: "dinner" as const,
    maxMinutes: 45,
    minMinutes: 20,
    vibe: "healthy",
  },
};

describe("recipe generation service", () => {
  it("includes cook prompt form choices in the future AI prompt", () => {
    const prompt = buildRecipeGenerationPrompt(input);

    expect(prompt).toContain("meal type: dinner");
    expect(prompt).toContain("max time: 45 minutes");
    expect(prompt).toContain("min time: 20 minutes");
    expect(prompt).toContain("vibe/tag: healthy");
    expect(prompt).toContain("Hard serving constraint: recipe servings MUST equal 2");
    expect(prompt).toContain("Hard dietary constraints: avoid dairy");
    expect(prompt).toContain("Do not include these in ingredients");
    expect(prompt).toContain("Spinach (spinach)");
    expect(prompt).toContain("Culinary judgment");
    expect(prompt).toContain("Do not force unrelated household items");
    expect(prompt).toContain("Sweet fruit can be used when it belongs naturally");
  });

  it("uses the same filters for current mock generation", async () => {
    const result = await generateRecipeMatches(input);

    expect(result.source).toBe("mock");
    expect(result.matches.every((match) => match.mealType === "dinner")).toBe(true);
    expect(result.matches.every((match) => match.timeMinutes <= 45)).toBe(true);
    expect(result.matches.every((match) => match.timeMinutes >= 20)).toBe(true);
    expect(result.matches.every((match) => match.tags.includes("healthy"))).toBe(true);
  });
});

describe("mapAiRecipesToMatches", () => {
  const unfilteredInput: RecipeGenerationInput = {
    ...input,
    filters: undefined,
  };

  const fridgeCard: AiRecipeCard = {
    title: "Garlic spinach saute",
    description: "Quick wilted spinach with garlic.",
    timeMinutes: 15,
    complexity: "simple",
    servings: 2,
    mealType: "dinner",
    category: "dinner",
    tags: ["healthy", "quick"],
    avoidanceTags: [],
    ingredients: [
      { name: "Spinach", amount: "200 g", required: true, countable: false },
      { name: "Garlic", amount: "2 cloves", required: false, countable: true },
    ],
    steps: ["Heat pan.", "Wilt spinach with garlic."],
  };

  const noFridgeCard: AiRecipeCard = {
    ...fridgeCard,
    title: "Beef stew",
    ingredients: [{ name: "Beef", amount: "500 g", required: true, countable: false }],
  };

  it("keeps only recipes that use at least one household item", () => {
    const matches = mapAiRecipesToMatches([fridgeCard, noFridgeCard], unfilteredInput);

    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe("Garlic spinach saute");
    expect(matches[0].matchCount).toBe(1);
    expect(
      matches[0].matchedItems.some((m) => m.inFridge && m.inventoryLot?.id === "spinach-1"),
    ).toBe(true);
  });

  it("maps card fields onto the RecipeMatch shape", () => {
    const [match] = mapAiRecipesToMatches([fridgeCard], unfilteredInput);

    expect(match.servingsBaseline).toBe(2);
    expect(match.complexity).toBe("simple");
    expect(match.steps).toHaveLength(2);
    expect(match.key).toContain("garlic-spinach-saute");
  });

  it("drops recipes that violate avoidances or active filters", () => {
    const dairyCard: AiRecipeCard = {
      ...fridgeCard,
      title: "Creamed spinach",
      avoidanceTags: ["dairy"],
    };
    const slowCard: AiRecipeCard = { ...fridgeCard, title: "Slow spinach bake", timeMinutes: 90 };

    expect(mapAiRecipesToMatches([dairyCard], input)).toHaveLength(0);
    expect(mapAiRecipesToMatches([slowCard], input)).toHaveLength(0);
  });

  it("keeps AI recipes when model uses different tag wording for requested vibe", () => {
    const aiCard: AiRecipeCard = {
      ...fridgeCard,
      tags: ["protein-rich"],
      timeMinutes: 30,
    };

    const [match] = mapAiRecipesToMatches([aiCard], input);

    expect(match.title).toBe("Garlic spinach saute");
    expect(match.tags).toContain("healthy");
  });
});

describe("mapAiCardsToMatches", () => {
  const unfilteredInput: RecipeGenerationInput = { ...input, filters: undefined };

  const card: AiRecipeCardLite = {
    title: "Garlic spinach saute",
    description: "Quick wilted spinach with garlic.",
    usedIngredientIds: ["spinach-1"],
    tags: ["healthy"],
    mealType: "dinner",
    category: "dinner",
    timeMinutes: 15,
  };

  it("builds ingredients from used fridge items and leaves steps empty", () => {
    const [match] = mapAiCardsToMatches([card], unfilteredInput);

    expect(match.title).toBe("Garlic spinach saute");
    expect(match.steps).toEqual([]);
    // Ingredient is the used item, addressed by canonical name so the matcher
    // links it back to inventory (used for the green "from fridge" linkage).
    expect(match.ingredients).toHaveLength(1);
    expect(match.ingredients[0].name).toBe("spinach");
    expect(match.ingredients[0].required).toBe(true);
    expect(
      match.matchedItems.some((m) => m.inFridge && m.inventoryLot?.id === "spinach-1"),
    ).toBe(true);
  });

  it("ignores usedIngredientIds that are not in inventory", () => {
    const ghost: AiRecipeCardLite = { ...card, usedIngredientIds: ["spinach-1", "missing-9"] };
    const [match] = mapAiCardsToMatches([ghost], unfilteredInput);

    expect(match.ingredients).toHaveLength(1);
    expect(match.ingredients[0].name).toBe("spinach");
  });
});
