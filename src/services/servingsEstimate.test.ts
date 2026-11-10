import { describe, expect, it } from "vitest";

import { estimateServings, ingredientCoverage, recipeFeeds } from "./servingsEstimate";

type Lot = Parameters<typeof estimateServings>[0][number];
const lot = (over: Partial<Lot>): Lot => ({
  normalized_name: "x",
  category: "other",
  quantity: 1,
  unit: "pcs",
  net_amount: null,
  net_unit: null,
  partial_state: "full",
  ...over,
});

describe("estimateServings", () => {
  it("feeds 3 from 450 g chicken alone, and stretches it with a carb", () => {
    const chicken = lot({ normalized_name: "chicken breast", category: "meat", net_amount: 450, net_unit: "g" });
    expect(estimateServings([chicken])).toBe(3);
    // One portion of bread stretches 3 chicken portions to 4.
    const bread = lot({ normalized_name: "bread", category: "bakery", net_amount: 100, net_unit: "g" });
    expect(estimateServings([chicken, bread])).toBe(4);
    // A whole pack of pasta could feed 5 on its own, so that wins.
    const pasta = lot({ normalized_name: "pasta", category: "pantry", unit: "pack" });
    expect(estimateServings([chicken, pasta])).toBe(5);
  });

  it("lets a single base feed on its own: 500 g pasta is 5 dinners", () => {
    expect(estimateServings([lot({ normalized_name: "spaghetti", category: "pantry", net_amount: 500, net_unit: "g" })])).toBe(5);
  });

  it("uses smaller plates for snacks", () => {
    const bread = lot({ normalized_name: "bread", category: "bakery", net_amount: 400, net_unit: "g" });
    expect(estimateServings([bread], { meal: "dinner" })).toBe(4);
    expect(estimateServings([bread], { meal: "snack" })).toBe(10);
  });

  it("counts eggs as half a portion each", () => {
    expect(estimateServings([lot({ normalized_name: "eggs", category: "dairy_eggs", quantity: 6 })])).toBe(3);
  });

  it("counts only the chosen base when building around one", () => {
    const rice = lot({ normalized_name: "rice", category: "pantry", quantity: 1, unit: "kg" });
    const potatoes = lot({ normalized_name: "potatoes", category: "vegetables", quantity: 2, unit: "kg", partial_state: "some_used" });
    expect(estimateServings([rice, potatoes], { base: "rice" })).toBe(13);
    // 2 kg, half used: 1000 g ÷ 250 g. Potatoes count as potatoes, not vegetables.
    expect(estimateServings([rice, potatoes], { base: "potatoes" })).toBe(4);
  });

  it("ignores liquids and an empty kitchen feeds nobody", () => {
    expect(estimateServings([lot({ normalized_name: "milk", category: "dairy_eggs", unit: "bottle", net_unit: "ml", net_amount: 1000 })])).toBe(0);
    expect(estimateServings([])).toBe(0);
  });
});

describe("ingredientCoverage / recipeFeeds", () => {
  it("finds 600 g chicken against 300 g half short, so 6 servings feed 3", () => {
    const c = ingredientCoverage("600 g", [lot({ normalized_name: "chicken", net_amount: 300, net_unit: "g" })], "chicken");
    expect(c).toEqual({ ratio: 0.5, short: 300, dimension: "mass" });
    expect(recipeFeeds([c], 6)).toBe(3);
  });

  it("counts eggs against eggs and says nothing when there's enough", () => {
    const c = ingredientCoverage("4 eggs", [lot({ normalized_name: "eggs", quantity: 10 })], "eggs");
    expect(c?.ratio).toBe(2.5);
    expect(recipeFeeds([c], 4)).toBeNull();
  });

  it("converts grams to items with the catalog weight (tomatoes 120 g)", () => {
    const c = ingredientCoverage("480 g", [lot({ normalized_name: "tomatoes", quantity: 2 })], "Tomatoes");
    expect(c?.ratio).toBeCloseTo(0.5);
  });

  it("can't compare liquids, spoonfuls or packs of unknown weight", () => {
    expect(ingredientCoverage("200 ml", [lot({})], "milk")).toBeNull();
    expect(ingredientCoverage("2 tbsp", [lot({})], "flour")).toBeNull();
    expect(ingredientCoverage("400 g", [lot({ normalized_name: "mince", unit: "pack" })], "mince")).toBeNull();
    expect(recipeFeeds([null, null], 4)).toBeNull();
  });
});
