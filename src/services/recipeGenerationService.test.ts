import { describe, expect, it } from "vitest";
import {
  buildRecipeGenerationPrompt,
  generateRecipeMatches,
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
    },
  ],
  avoidances: ["dairy"],
  isPremium: false,
  cookingMode: "household" as const,
  servings: 2,
  filters: {
    mealType: "dinner" as const,
    maxMinutes: 45,
    vibe: "healthy",
  },
};

describe("recipe generation service", () => {
  it("includes cook prompt form choices in the future AI prompt", () => {
    const prompt = buildRecipeGenerationPrompt(input);

    expect(prompt).toContain("meal type: dinner");
    expect(prompt).toContain("max time: 45 minutes");
    expect(prompt).toContain("vibe/tag: healthy");
    expect(prompt).toContain("Avoidances: dairy");
    expect(prompt).toContain("Spinach (spinach)");
  });

  it("uses the same filters for current mock generation", async () => {
    const result = await generateRecipeMatches(input);

    expect(result.source).toBe("mock");
    expect(result.matches.every((match) => match.mealType === "dinner")).toBe(true);
    expect(result.matches.every((match) => match.timeMinutes <= 45)).toBe(true);
    expect(result.matches.every((match) => match.tags.includes("healthy"))).toBe(true);
  });
});
