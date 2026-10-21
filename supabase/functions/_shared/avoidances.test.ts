import { describe, expect, it } from "vitest";

import { mentionsAvoidance } from "./avoidances";

describe("mentionsAvoidance", () => {
  it.each([
    ["200 g sira", "dairy"],
    ["Mleko", "dairy"],
    ["kisela pavlaka", "dairy"],
    ["grated cheddar cheese", "dairy"],
    ["piletinom", "meat"],
    ["Pileća prsa", "meat"],
    ["dimljena slanina", "meat"],
    ["2 chicken thighs", "meat"],
    ["losos", "fish"],
    ["tunjevina iz konzerve", "fish"],
    ["integralno brašno", "gluten"],
    ["spaghetti", "gluten"],
    ["seckani orasi", "nuts"],
    ["toasted almonds", "nuts"],
  ])("%j is %s", (text, avoidance) => {
    expect(mentionsAvoidance(text, avoidance)).toBe(true);
  });

  it.each([
    ["jabukovo sirće", "dairy"],
    ["butternut squash", "dairy"],
    ["muškatni oraščić", "nuts"],
    ["nutmeg", "nuts"],
    ["2 tomatoes", "meat"],
    ["ripe banana", "gluten"],
  ])("%j is not %s", (text, avoidance) => {
    expect(mentionsAvoidance(text, avoidance)).toBe(false);
  });

  it("falls back to substring for unknown keys", () => {
    expect(mentionsAvoidance("Cilantro lime rice", "cilantro")).toBe(true);
  });
});
