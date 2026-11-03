import { describe, expect, it } from "vitest";
import { computeInsightsSummary, lastSevenDays, usageStreak } from "./insightsService";

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

describe("usageStreak", () => {
  const now = new Date(2026, 10, 3, 19, 0);
  const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).toISOString();

  it("counts consecutive days ending today", () => {
    expect(usageStreak([at(3), at(2), at(2, 20), at(1)], now)).toBe(3);
  });

  it("keeps yesterday's streak alive while today is still empty", () => {
    expect(usageStreak([at(2), at(1)], now)).toBe(2);
  });

  it("breaks on a missed day", () => {
    expect(usageStreak([at(3), at(1)], now)).toBe(1);
    expect(usageStreak([at(1)], now)).toBe(0);
    expect(usageStreak([], now)).toBe(0);
  });
});

describe("lastSevenDays", () => {
  it("runs oldest to today and marks the days with use", () => {
    const now = new Date(2026, 10, 3, 19, 0);
    const days = lastSevenDays([new Date(2026, 10, 3, 8).toISOString(), new Date(2026, 9, 28, 21).toISOString()], now);
    expect(days.map((d) => d.date.getDate())).toEqual([28, 29, 30, 31, 1, 2, 3]);
    expect(days.map((d) => d.used)).toEqual([true, false, false, false, false, false, true]);
  });
});
