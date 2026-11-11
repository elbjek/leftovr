import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import icons from "../../assets/food-icons/icons.json";
import { foodIconKey, foodMatchKey } from "./foodIcons";

describe("foodIconKey", () => {
  it("matches the item names in use today", () => {
    const expected: Record<string, string> = {
      "greek yogurt": "yogurt",
      "cream cheese": "cream_cheese",
      "sour cream": "cream",
      cheddar: "cheese",
      feta: "white_cheese",
      "fresh mozzarella": "mozzarella",
      "whole milk": "milk",
      "oat milk": "plant_milk",
      eggs: "eggs",
      "ground beef": "ground_meat",
      "pork chops": "pork",
      "turkey slices": "ham",
      sausages: "sausage",
      "salmon fillet": "salmon",
      "smoked mackerel": "fish",
      "tuna steak": "fish",
      "cherry tomatoes": "tomato",
      "bell peppers": "bell_pepper",
      "cayenne pepper": "spices",
      "dried oregano": "spices",
      carrots: "carrot",
      strawberries: "strawberries",
      "sourdough bread": "bread",
      bagels: "bread",
      "basmati rice": "rice",
      "black beans": "beans",
      "instant noodles": "noodles",
      "soy sauce": "sauce",
      ketchup: "sauce",
      "wine vinegar": "vinegar",
      "pickled vegetables": "pickles",
      "lemon juice": "lemon",
      "orange juice": "juice",
      "cold brew": "coffee",
      "sparkling water": "water",
      "cheddar crackers": "crackers",
      "rice cakes": "crackers",
      "frozen peas": "peas",
      "dark chocolate": "chocolate",
      "peanut butter": "peanut_butter",
      "beli sir": "white_cheese",
      "šargarepa": "carrot",
      "pileće belo meso": "chicken_breast",
    };
    for (const [name, id] of Object.entries(expected)) expect([name, foodIconKey(name)]).toEqual([name, id]);
  });

  it("falls back to the category icon, then to nothing", () => {
    expect(foodIconKey("vanilla pods xyz", "pantry")).toBe("spices");
    expect(foodIconKey("mystery item", "frozen")).toBe("category_frozen");
    expect(foodIconKey("mystery item")).toBeNull();
    expect(foodIconKey("category_meat")).toBe("category_meat");
  });

  it("has a bundled PNG and an image entry for every icon", () => {
    const map = readFileSync(new URL("../components/illustrations/foodIconImages.ts", import.meta.url), "utf8");
    for (const { id } of [...icons.foods, ...icons.categories]) {
      expect(existsSync(new URL(`../../assets/food-icons/${id}.png`, import.meta.url)), id).toBe(true);
      expect(map.includes(`  ${id}: require("../../../assets/food-icons/${id}.png"),`), id).toBe(true);
    }
  });
});

describe("foodMatchKey", () => {
  it("folds English plurals and Serbian endings to one food", () => {
    expect(foodMatchKey("Jaje")).toBe("eggs");
    expect(foodMatchKey("Jaja M 10/1")).toBe("eggs");
    expect(foodMatchKey("eggs")).toBe("eggs");
    expect(foodMatchKey("egg")).toBe("eggs");
    expect(foodMatchKey("Jabuke")).toBe("apple");
    expect(foodMatchKey("apples")).toBe("apple");
    expect(foodMatchKey("Mleko 2.8% 1L")).toBe("milk");
    expect(foodMatchKey("whole milk")).toBe("milk");
  });

  it("never matches through aliases that lump products together", () => {
    expect(foodMatchKey("ketchup")).toBeNull();
    expect(foodMatchKey("mustard")).toBeNull();
    expect(foodMatchKey("oregano")).toBeNull();
    expect(foodMatchKey("eggplant")).not.toBe("eggs");
  });

  it("doesn't turn short Serbian names into everyday words", () => {
    // "so" (salt) must not become "sa" / "se".
    expect(foodMatchKey("hleb sa semenkama")).toBe("bread");
    expect(foodMatchKey("pasta sa sirom")).not.toBe("salt");
  });
});
