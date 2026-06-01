import { describe, expect, it } from "vitest";
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
