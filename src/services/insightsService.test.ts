import { describe, expect, it } from "vitest";
import { computeInsightsSummary, groupWinsByDay, recapWindow } from "./insightsService";

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

describe("groupWinsByDay", () => {
  const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();

  it("folds a day's uses, cooks and savings into one entry, newest first", () => {
    const days = groupWinsByDay({
      used: [at(3, 19), at(3, 19), at(3, 8), at(1, 12)],
      cooked: [{ at: at(3, 19), title: "Pasta" }, { at: at(3, 20), title: "Pasta" }],
      saved: [{ at: at(3, 19), value: 2.5 }, { at: at(3, 9), value: 1.7 }, { at: at(2, 9), value: 9 }],
    });
    expect(days.map((d) => d.date.getDate())).toEqual([3, 1]);
    expect(days[0]).toMatchObject({ itemsUsed: 3, cooked: ["Pasta"] });
    expect(days[0].moneySaved).toBeCloseTo(4.2);
    // Saved money with nothing used that day doesn't make a win on its own.
    expect(days.some((d) => d.date.getDate() === 2)).toBe(false);
  });
});
