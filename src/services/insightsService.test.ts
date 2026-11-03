import { describe, expect, it } from "vitest";
import { computeInsightsSummary, recapWindow } from "./insightsService";

const raw = {
  receiptScans: 0,
  itemsAdded: 0,
  cookedEvents: 0,
  removedItems: 0,
  itemsUsed: 0,
  categoryBreakdown: {},
  cookedRecipes: [],
  topUsedFood: null,
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

describe("recapWindow", () => {
  it("recaps the month that just ended during the first 3 days", () => {
    const w = recapWindow(new Date(2026, 10, 3, 22, 0));
    expect([w.start.getMonth(), w.start.getDate(), w.complete]).toEqual([9, 1, true]);
    expect(w.until?.getMonth()).toBe(10);
  });

  it("shows this month so far after that, across the new year too", () => {
    const w = recapWindow(new Date(2026, 10, 4));
    expect([w.start.getMonth(), w.until, w.complete]).toEqual([10, null, false]);
    expect(recapWindow(new Date(2027, 0, 2)).start.getFullYear()).toBe(2026);
  });
});
