import { describe, expect, it } from "vitest";
import { ingredientUse } from "./units";
import { planDepletion, PlanLot } from "./depletionPlan";

const lot = (over: Partial<PlanLot>): PlanLot => ({
  id: "x",
  quantity: 1,
  partial_state: "full",
  unit: "item",
  net_amount: null,
  net_unit: null,
  ...over,
});

describe("planDepletion - precise", () => {
  it("subtracts recipe ml from a single net lot", () => {
    const lots = [lot({ id: "a", net_amount: 1000, net_unit: "ml" })];
    const ops = planDepletion(lots, { amount: 200, unit: "ml" });
    expect(ops).toEqual([{ kind: "setNet", id: "a", netAmount: 800 }]);
  });
  it("removes a net lot when fully consumed", () => {
    const lots = [lot({ id: "a", net_amount: 200, net_unit: "ml" })];
    const ops = planDepletion(lots, { amount: 200, unit: "ml" });
    expect(ops).toEqual([{ kind: "remove", id: "a" }]);
  });
  it("spills across net lots, soonest first (caller pre-sorts)", () => {
    const lots = [
      lot({ id: "a", net_amount: 150, net_unit: "ml" }),
      lot({ id: "b", net_amount: 1000, net_unit: "ml" }),
    ];
    const ops = planDepletion(lots, { amount: 400, unit: "ml" });
    expect(ops).toEqual([
      { kind: "remove", id: "a" },
      { kind: "setNet", id: "b", netAmount: 750 },
    ]);
  });
});

describe("planDepletion - fallback", () => {
  it("dimension mismatch falls back to partial step", () => {
    const lots = [lot({ id: "a", net_amount: 200, net_unit: "g", partial_state: "full" })];
    const ops = planDepletion(lots, { amount: 200, unit: "ml" });
    expect(ops).toEqual([{ kind: "setPartial", id: "a", partialState: "some_used" }]);
  });
  it("no-net countable lot decrements count", () => {
    const lots = [lot({ id: "a", quantity: 12, unit: "egg" })];
    const ops = planDepletion(lots, { amount: 2, unit: "egg" });
    expect(ops).toEqual([{ kind: "setQuantity", id: "a", quantity: 10 }]);
  });
  it("no-net single unit advances partial state", () => {
    const lots = [lot({ id: "a", quantity: 1, unit: "bag", partial_state: "full" })];
    const ops = planDepletion(lots, { amount: 1, unit: "handful" });
    expect(ops).toEqual([{ kind: "setPartial", id: "a", partialState: "some_used" }]);
  });
});

describe("planDepletion - counted produce (onion problem)", () => {
  it("converts a recipe mass to an item count via gramsPerItem", () => {
    const lots = [lot({ id: "a", quantity: 3, unit: "item" })];
    // 200g / 110g per onion ≈ 1.8 → 2 onions
    const ops = planDepletion(lots, { amount: 200, unit: "g" }, { gramsPerItem: 110 });
    expect(ops).toEqual([{ kind: "setQuantity", id: "a", quantity: 1 }]);
  });

  it("consumes at least one item for a small mass need", () => {
    const lots = [lot({ id: "a", quantity: 3, unit: "item" })];
    // 50g / 110g ≈ 0.45 → rounds to 0 → clamped to 1 onion
    const ops = planDepletion(lots, { amount: 50, unit: "g" }, { gramsPerItem: 110 });
    expect(ops).toEqual([{ kind: "setQuantity", id: "a", quantity: 2 }]);
  });

  it("does not nuke a counted lot when a mass need has no conversion", () => {
    const lots = [lot({ id: "a", quantity: 3, unit: "item" })];
    // No gramsPerItem: must fall back to a single use, not Math.round(200) items
    const ops = planDepletion(lots, { amount: 200, unit: "g" });
    expect(ops).toEqual([{ kind: "setQuantity", id: "a", quantity: 2 }]);
  });
});

describe("planDepletion with parsed recipe amounts (FIXES B10)", () => {
  const threePack = [{ id: "a", quantity: 3, partial_state: "full" as const, unit: "item", net_amount: null, net_unit: null }];
  it("does not wipe a counted lot for a metric amount", () => {
    const need = ingredientUse("250 grama");
    expect(planDepletion(threePack, { amount: need.quantity, unit: need.unit })).toEqual([
      { kind: "setQuantity", id: "a", quantity: 2 },
    ]);
  });
  it("still counts whole items", () => {
    const need = ingredientUse("2 tomatoes");
    expect(planDepletion(threePack, { amount: need.quantity, unit: need.unit })).toEqual([
      { kind: "setQuantity", id: "a", quantity: 1 },
    ]);
  });
});
