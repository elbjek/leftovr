import { describe, expect, it } from "vitest";
import { availableBaseOptions, matchRecipes, selectMakeableRecipes } from "./recipeService";
import { InventoryCategory, InventoryLot } from "./inventoryRules";

const base = { inventory: [], avoidances: [], isPremium: false };

function lot(name: string, normalized_name: string): InventoryLot {
  return {
    id: `${normalized_name}-1`,
    name,
    normalized_name,
    brand_name: null,
    category: "other",
    quantity: 1,
    unit: "item",
    net_amount: null,
    net_unit: null,
    partial_state: "full",
    shelf_life_range: null,
    source: "receipt",
    added_by: "user-1",
    added_by_name: "Test User",
    // Fresh at test time — expired lots are excluded from matching entirely.
    added_at: new Date().toISOString(),
    removed_at: null,
    expires_at: null,
    purchase_price: null,
    purchase_amount: null,
  };
}

// Mirrors the "demo shop" receipt template.
const demoShop: InventoryLot[] = [
  lot("Eggs", "eggs"),
  lot("Milk", "milk"),
  lot("Greek yogurt", "greek yogurt"),
  lot("Cheddar", "cheddar"),
  lot("Chicken breast", "chicken breast"),
  lot("Spinach", "spinach"),
  lot("Tomatoes", "tomatoes"),
  lot("Bananas", "bananas"),
  lot("Sourdough", "sourdough"),
  lot("Rice", "rice"),
];

function catLot(name: string, category: InventoryCategory): InventoryLot {
  return { ...lot(name, name.toLowerCase()), category };
}

describe("availableBaseOptions", () => {
  it("derives bases from category and name, hides absent ones, orders by stock", () => {
    const bases = availableBaseOptions([
      catLot("Chicken breast", "meat"),
      catLot("Spaghetti", "pantry"),
      catLot("Penne", "pantry"),
      catLot("Spinach", "vegetables"),
    ]);
    expect(bases).toContain("protein");
    expect(bases).toContain("pasta");
    expect(bases).toContain("vegetables");
    expect(bases).not.toContain("rice"); // no rice in stock
    expect(bases[0]).toBe("pasta"); // two pasta items → most stocked first
  });

  it("falls back to a core set when the fridge is empty", () => {
    expect(availableBaseOptions([])).toEqual(["protein", "vegetables", "pasta", "rice"]);
  });
});

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

  it("matches simple AI-style ingredient names to more specific fridge names", () => {
    const res = matchRecipes({
      ...base,
      inventory: [lot("Greek yogurt", "greek yogurt")],
    }, [
      {
        key: "ai-yogurt-bowl",
        title: "Yogurt bowl",
        description: "Fast bowl.",
        timeMinutes: 5,
        complexity: "simple",
        servingsBaseline: 1,
        category: "breakfast",
        mealType: "breakfast",
        tags: ["healthy"],
        avoidanceTags: [],
        ingredients: [
          { name: "yogurt", amount: "1 bowl", required: true, countable: false },
        ],
        steps: ["Spoon yogurt into a bowl."],
      },
    ]);

    expect(res[0].matchCount).toBe(1);
    expect(res[0].coverage).toBe(1);
  });

  it("filters by maxMinutes", () => {
    const res = matchRecipes({ ...base, filters: { maxMinutes: 15 } });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.timeMinutes <= 15)).toBe(true);
  });

  it("filters by minMinutes", () => {
    const res = matchRecipes({ ...base, filters: { minMinutes: 60 } });
    expect(res.every((r) => r.timeMinutes >= 60)).toBe(true);
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

describe("coverage + selectMakeableRecipes", () => {
  it("coverage is 0 for every recipe when the fridge is empty", () => {
    const all = matchRecipes(base);
    expect(all.every((r) => r.coverage === 0)).toBe(true);
  });

  it("only keeps recipes you can mostly cook from the fridge", () => {
    const matches = matchRecipes({ ...base, inventory: demoShop });
    const makeable = selectMakeableRecipes(matches, { isPremium: false });

    expect(makeable.length).toBeGreaterThan(0);
    expect(makeable.every((r) => r.matchCount >= 1)).toBe(true);
    expect(makeable.every((r) => r.coverage >= 0.5)).toBe(true);
    // Sorted best-coverage first.
    for (let i = 1; i < makeable.length; i += 1) {
      expect(makeable[i - 1].coverage).toBeGreaterThanOrEqual(makeable[i].coverage);
    }
  });

  it("returns nothing makeable from an empty fridge", () => {
    const makeable = selectMakeableRecipes(matchRecipes(base), { isPremium: false });
    expect(makeable).toEqual([]);
  });

  it("surfaces a Greek-yogurt recipe when that is all you have", () => {
    const matches = matchRecipes({ ...base, inventory: [lot("Greek yogurt", "greek yogurt")] });
    const makeable = selectMakeableRecipes(matches, { isPremium: false });
    expect(makeable.length).toBeGreaterThan(0);
    expect(
      makeable.every((r) =>
        r.matchedItems.some((m) => m.inFridge && m.ingredientName.toLowerCase().includes("yogurt")),
      ),
    ).toBe(true);
  });

  it("never counts an expired lot as in the fridge", () => {
    // Same single-yogurt fridge, but the lot's explicit date is long past.
    const expired = { ...lot("Greek yogurt", "greek yogurt"), expires_at: "2026-01-01" };
    const matches = matchRecipes({ ...base, inventory: [expired] });
    expect(matches.every((r) => r.matchedItems.every((m) => !m.inFridge))).toBe(true);
    expect(selectMakeableRecipes(matches, { isPremium: false })).toEqual([]);
  });
});
