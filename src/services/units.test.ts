import { describe, expect, it } from "vitest";
import { addAmounts, dimensionOf, formatAmount, ingredientUse, parseIngredientAmount, toMetric } from "./units";

describe("toMetric", () => {
  it("converts volume units to ml", () => {
    expect(toMetric(1, "l")).toEqual({ value: 1000, dimension: "volume" });
    expect(toMetric(200, "ml")).toEqual({ value: 200, dimension: "volume" });
  });
  it("converts cooking units to ml", () => {
    expect(toMetric(1, "tbsp").value).toBeCloseTo(14.79, 2);
    expect(toMetric(1, "tsp").value).toBeCloseTo(4.93, 2);
    expect(toMetric(1, "cup")).toEqual({ value: 240, dimension: "volume" });
  });
  it("converts mass units to g", () => {
    expect(toMetric(1, "kg")).toEqual({ value: 1000, dimension: "mass" });
    expect(toMetric(100, "g")).toEqual({ value: 100, dimension: "mass" });
  });
  it("treats count units as count", () => {
    expect(toMetric(3, "item").dimension).toBe("count");
    expect(toMetric(2, "egg").dimension).toBe("count");
  });
  it("returns null dimension for unconvertible units", () => {
    expect(toMetric(1, "cloves").dimension).toBeNull();
    expect(toMetric(2, "slices").dimension).toBeNull();
    expect(toMetric(1, "handful").dimension).toBeNull();
  });
});

describe("dimensionOf", () => {
  it("maps net units to dimensions", () => {
    expect(dimensionOf("ml")).toBe("volume");
    expect(dimensionOf("g")).toBe("mass");
  });
});

describe("formatAmount", () => {
  it("formats metric volume", () => {
    expect(formatAmount(800, "ml", "metric")).toBe("800 ml");
    expect(formatAmount(1500, "ml", "metric")).toBe("1.5 l");
  });
  it("formats metric mass", () => {
    expect(formatAmount(200, "g", "metric")).toBe("200 g");
    expect(formatAmount(1200, "g", "metric")).toBe("1.2 kg");
  });
  it("formats imperial volume in fl oz", () => {
    expect(formatAmount(29.57, "ml", "imperial")).toBe("1 fl oz");
  });
  it("formats imperial mass in oz", () => {
    expect(formatAmount(28.35, "g", "imperial")).toBe("1 oz");
  });
});

describe("parseIngredientAmount", () => {
  const cases: [string, { value: number; unit: string | null; kind: string }][] = [
    ["250 grama", { value: 250, unit: "g", kind: "measure" }],
    ["400g rice", { value: 400, unit: "g", kind: "measure" }],
    ["0,5 kg", { value: 0.5, unit: "kg", kind: "measure" }],
    ["½ kg", { value: 0.5, unit: "kg", kind: "measure" }],
    ["1 cup", { value: 1, unit: "cup", kind: "measure" }],
    ["1/2 cup milk", { value: 0.5, unit: "cup", kind: "measure" }],
    ["1 1/2 tbsp", { value: 1.5, unit: "tbsp", kind: "measure" }],
    ["1½ tbsp", { value: 1.5, unit: "tbsp", kind: "measure" }],
    ["2 šolje", { value: 2, unit: "cup", kind: "measure" }],
    ["2 kašike ulja", { value: 2, unit: "tbsp", kind: "measure" }],
    ["1 kašičica soli", { value: 1, unit: "tsp", kind: "measure" }],
    ["2 dl mleka", { value: 200, unit: "ml", kind: "measure" }],
    ["100ml", { value: 100, unit: "ml", kind: "measure" }],
    ["1 l", { value: 1, unit: "l", kind: "measure" }],
    ["2 tomatoes", { value: 2, unit: null, kind: "count" }],
    ["3 jaja", { value: 3, unit: null, kind: "count" }],
    ["2 kom", { value: 2, unit: null, kind: "count" }],
    ["2-3 carrots", { value: 2, unit: null, kind: "count" }],
    ["", { value: 1, unit: null, kind: "count" }],
    ["2 cloves garlic", { value: 2, unit: "cloves", kind: "other" }],
    ["2 čena belog luka", { value: 2, unit: "čena", kind: "other" }],
    ["pinch of salt", { value: 1, unit: "pinch", kind: "other" }],
  ];
  it.each(cases)("parses %j", (input, expected) => {
    const parsed = parseIngredientAmount(input);
    expect(parsed.kind).toBe(expected.kind);
    expect(parsed.unit).toBe(expected.unit);
    expect(parsed.value).toBeCloseTo(expected.value, 3);
  });
  it("converts imperial mass to grams", () => {
    expect(parseIngredientAmount("8 oz cheese")).toMatchObject({ unit: "g", kind: "measure" });
    expect(parseIngredientAmount("8 oz cheese").value).toBeCloseTo(226.8, 1);
    expect(parseIngredientAmount("1 lb").value).toBeCloseTo(453.6, 1);
  });
});

describe("ingredientUse", () => {
  it("never reads a metric amount as an item count", () => {
    expect(ingredientUse("250 grama")).toEqual({ quantity: 250, unit: "g" });
    expect(ingredientUse("2 šolje")).toEqual({ quantity: 2, unit: "cup" });
  });
  it("counts whole items", () => {
    expect(ingredientUse("2 tomatoes")).toEqual({ quantity: 2, unit: "item" });
  });
  it("passes single-use units through (depletion takes one use)", () => {
    expect(ingredientUse("2 cloves garlic")).toEqual({ quantity: 2, unit: "cloves" });
    expect(toMetric(2, ingredientUse("2 cloves garlic").unit).dimension).toBeNull();
  });
});

describe("addAmounts (C18)", () => {
  it("adds same-dimension amounts in metric", () => {
    expect(addAmounts({ amount: 200, unit: "g" }, { amount: 1, unit: "kg" })).toEqual({ amount: 1200, unit: "g" });
    expect(addAmounts({ amount: 1, unit: "cup" }, { amount: 100, unit: "ml" })).toEqual({ amount: 340, unit: "ml" });
  });
  it("adds counts", () => {
    expect(addAmounts({ amount: 2, unit: "item" }, { amount: 1, unit: "item" })).toEqual({ amount: 3, unit: "item" });
  });
  it("never adds across dimensions (200 g + 1 cup is not 201 g)", () => {
    expect(addAmounts({ amount: 200, unit: "g" }, { amount: 1, unit: "cup" })).toEqual({ amount: 200, unit: "g" });
  });
});
