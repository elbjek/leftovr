import { describe, expect, it } from "vitest";
import { ingredientSignature } from "./recipeSignature";

describe("ingredientSignature", () => {
  it("matches same ingredients regardless of title or order", () => {
    const sourdoughToast = [
      { name: "Sourdough" },
      { name: "Spinach" },
      { name: "Egg" },
      { name: "Cheddar" },
    ];
    const plainToast = [
      { name: "Egg" },
      { name: "Cheddar" },
      { name: "Sourdough" },
      { name: "Spinach" },
    ];
    expect(ingredientSignature(sourdoughToast)).toBe(ingredientSignature(plainToast));
  });

  it("normalizes case and whitespace", () => {
    expect(ingredientSignature([{ name: "  Greek  Yogurt " }])).toBe(
      ingredientSignature([{ name: "greek yogurt" }]),
    );
  });

  it("differs when the ingredient set differs", () => {
    expect(ingredientSignature([{ name: "Egg" }])).not.toBe(
      ingredientSignature([{ name: "Egg" }, { name: "Bacon" }]),
    );
  });

  it("ignores empty and missing names", () => {
    expect(ingredientSignature([{ name: "Egg" }, { name: "" }, {}])).toBe("egg");
    expect(ingredientSignature(null)).toBe("");
  });
});
