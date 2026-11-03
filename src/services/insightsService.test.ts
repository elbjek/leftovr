import { describe, expect, it } from "vitest";
import { computeInsightsSummary } from "./insightsService";

const raw = {
  receiptScans: 0,
  itemsAdded: 0,
  cookedEvents: 0,
  removedItems: 0,
  itemsUsed: 0,
  categoryBreakdown: {},
  cookedRecipes: [],
  moneySpent: 30,
  moneySaved: 12,
  moneyWasted: 4,
};

describe("computeInsightsSummary money", () => {
  it("passes through real money figures", () => {
    const s = computeInsightsSummary(raw);
    expect(s.moneySpent).toBe(30);
    expect(s.moneySaved).toBe(12);
    expect(s.moneyWasted).toBe(4);
  });
});
