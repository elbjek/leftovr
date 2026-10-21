import { describe, expect, it } from "vitest";
import { ingredientSignature, recipeSignature } from "./recipeSignature";

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

describe("recipeSignature", () => {
  it("matches across languages when the same fridge lots are used", () => {
    const savedSerbian = recipeSignature(["lot-b", "lot-a"], [{ name: "Piletina" }, { name: "Pirinač" }]);
    const freshCard = recipeSignature(["lot-a", "lot-b"], [{ name: "chicken" }, { name: "rice" }]);
    expect(savedSerbian).toBe(freshCard);
  });
  it("differs when different lots are used", () => {
    expect(recipeSignature(["lot-a"], [])).not.toBe(recipeSignature(["lot-a", "lot-c"], []));
  });
  it("falls back to ingredient names without lot ids", () => {
    expect(recipeSignature([], [{ name: "Egg" }])).toBe(ingredientSignature([{ name: "egg" }]));
  });
});
