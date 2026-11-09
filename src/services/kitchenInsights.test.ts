import { describe, expect, it } from "vitest";
import { buildKitchenInsights, foodsGoingOff, periodWindow } from "./kitchenInsights";

describe("periodWindow", () => {
  it("runs the week from Monday and compares with the same stretch of last week", () => {
    const now = new Date(2026, 10, 4, 18, 0); // Wednesday
    const w = periodWindow("week", now);
    expect([w.start.getDate(), w.prevStart.getDate(), w.buckets.length]).toEqual([2, 26, 7]);
    expect(w.prevUntil.getTime() - w.prevStart.getTime()).toBe(now.getTime() - w.start.getTime());
  });

  it("compares a month so far with the same days of last month, in day buckets", () => {
    const now = new Date(2026, 10, 10, 12, 0);
    const w = periodWindow("month", now);
    expect([w.start.getMonth(), w.prevStart.getMonth()]).toEqual([10, 9]);
    expect(w.prevUntil.getDate()).toBe(10);
    expect(w.buckets.map((b) => b.start.getDate())).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(w.buckets[29].end.getDate()).toBe(1); // the 30th ends at 1 Dec
  });

  it("stays on this month in its first days, so a week never holds more than its month", () => {
    const w = periodWindow("month", new Date(2026, 10, 2, 9, 0));
    expect([w.start.getMonth(), w.start.getDate(), w.prevStart.getMonth(), w.prevUntil.getDate()]).toEqual([10, 1, 9, 2]);
  });
});

describe("periodWindow year", () => {
  it("runs from 1 January in month buckets, against the same stretch of last year", () => {
    const now = new Date(2026, 10, 3, 12, 0);
    const w = periodWindow("year", now);
    expect([w.start.getFullYear(), w.start.getMonth(), w.prevStart.getFullYear(), w.buckets.length]).toEqual([2026, 0, 2025, 12]);
    expect([w.prevUntil.getMonth(), w.prevUntil.getDate()]).toEqual([10, 3]);
    expect(w.buckets[11].end.getFullYear()).toBe(2027);
  });
});

describe("buildKitchenInsights", () => {
  const w = periodWindow("week", new Date(2026, 10, 8, 20, 0));
  const at = (day: number) => new Date(2026, 10, day, 12).toISOString();

  it("buckets uses and tosses by day and ranks the food groups", () => {
    const k = buildKitchenInsights(
      {
        added: [
          ...Array(5).fill({ category: "vegetables", outcome: "used" }),
          { category: "bakery", outcome: "used" },
          { category: "bakery", outcome: "tossed" },
          { category: "bakery", outcome: "tossed" },
          { category: "fish", outcome: "used" }, // one finished: too little to show
          { category: "dairy_eggs", outcome: null },
        ],
        usedAt: [at(2), at(2), at(8)],
        tossedAt: [at(3)],
      },
      w.buckets,
    );
    expect([k.used, k.tossed]).toEqual([3, 1]);
    expect(k.chart.map((d) => d.used)).toEqual([2, 0, 0, 0, 0, 0, 1]);
    expect(k.chart[1].tossed).toBe(1);
    expect(k.groups.map((g) => g.category)).toEqual(["vegetables", "bakery"]);
    expect(k.strongest?.category).toBe("vegetables");
    expect(k.weakest?.category).toBe("bakery");
  });

  it("names no strong or weak group without enough to go on", () => {
    const k = buildKitchenInsights({ added: [{ category: "fruit", outcome: "used" }, { category: "fruit", outcome: "used" }], usedAt: [], tossedAt: [] }, w.buckets);
    expect([k.strongest, k.weakest]).toEqual([null, null]);
  });
});

describe("foodsGoingOff", () => {
  const row = (name: string, outcome: "used" | "tossed", day: number) => ({ name, category: "bakery" as const, outcome, at: new Date(2026, 9, day).toISOString() });

  it("keeps foods with 2+ tosses in their last 5, oldest first", () => {
    const foods = foodsGoingOff([
      row("bread", "tossed", 1), // 6th-newest: out of the window
      row("bread", "used", 2),
      row("bread", "tossed", 3),
      row("bread", "tossed", 4),
      row("bread", "used", 5),
      row("bread", "tossed", 6),
      row("milk", "tossed", 2),
      row("milk", "used", 3),
    ]);
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ name: "bread", tossed: 3, outcomes: ["used", "tossed", "tossed", "used", "tossed"] });
  });
});
