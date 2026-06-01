import { describe, expect, it } from "vitest";
import { matchRecipes } from "./recipeService";

const base = { inventory: [], avoidances: [], isPremium: false };

describe("matchRecipes filters", () => {
  it("returns all (avoidance-filtered) recipes when no filters given", () => {
    const all = matchRecipes(base);
    expect(all.length).toBeGreaterThan(0);
  });

  it("filters by mealType", () => {
    const res = matchRecipes({ ...base, filters: { mealType: "breakfast" } });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.mealType === "breakfast")).toBe(true);
  });

  it("filters by maxMinutes", () => {
    const res = matchRecipes({ ...base, filters: { maxMinutes: 15 } });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.timeMinutes <= 15)).toBe(true);
  });

  it("filters by vibe tag", () => {
    const res = matchRecipes({ ...base, filters: { vibe: "comfort" } });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.tags.includes("comfort"))).toBe(true);
  });

  it("returns empty when filters match nothing", () => {
    const res = matchRecipes({ ...base, filters: { mealType: "snack", maxMinutes: 1 } });
    expect(res).toEqual([]);
  });
});
