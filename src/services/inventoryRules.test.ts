import { describe, expect, it } from "vitest";
import {
  getShelfLifeDays,
  inferCategory,
  InventoryLot,
  isMetricAmountRunningLow,
  isPantryStaple,
  resolveUrgency,
  urgencyFromExpiry,
} from "./inventoryRules";

const baseGroup = {
  normalizedName: "milk",
  quantity: 1,
  netAmount: 1000,
  netUnit: "ml" as const,
};

describe("isMetricAmountRunningLow", () => {
  it("returns true when measured amount is at or below 25 percent of catalog net", () => {
    expect(isMetricAmountRunningLow({ ...baseGroup, netAmount: 250 })).toBe(true);
  });

  it("returns false when measured amount is above 25 percent of catalog net", () => {
    expect(isMetricAmountRunningLow({ ...baseGroup, netAmount: 300 })).toBe(false);
  });

  it("scales threshold by quantity", () => {
    expect(isMetricAmountRunningLow({ ...baseGroup, quantity: 2, netAmount: 500 })).toBe(true);
    expect(isMetricAmountRunningLow({ ...baseGroup, quantity: 2, netAmount: 600 })).toBe(false);
  });

  it("ignores items without known metric amount", () => {
    expect(isMetricAmountRunningLow({ ...baseGroup, netAmount: null, netUnit: null })).toBe(false);
  });
});

describe("getShelfLifeDays", () => {
  it("returns catalog days for known foods and category defaults otherwise", () => {
    expect(getShelfLifeDays("Salmon", "fish")).toEqual([1, 2]);
    expect(getShelfLifeDays("Mystery item", "meat")).toEqual([1, 3]);
  });

  it("resolves localized aliases to the canonical catalog entry", () => {
    // Serbian demo item maps to "Greek yogurt" (dairy_eggs, [5,8]).
    expect(getShelfLifeDays("Grcki jogurt", "other")).toEqual([5, 8]);
    expect(inferCategory("Grcki jogurt")).toBe("dairy_eggs");
    // Diacritic-folded match: "Spanać" → spinach.
    expect(inferCategory("Spanać")).toBe("vegetables");
  });
});

describe("urgencyFromExpiry", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("maps days left to urgency bands", () => {
    expect(urgencyFromExpiry("2026-06-11", now)).toBe("urgent");
    expect(urgencyFromExpiry("2026-06-14", now)).toBe("use_soon");
    expect(urgencyFromExpiry("2026-06-20", now)).toBe("safe");
  });

  it("treats past dates as urgent", () => {
    expect(urgencyFromExpiry("2026-06-01", now)).toBe("urgent");
  });
});

describe("resolveUrgency", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const lot = (over: Partial<InventoryLot>): Pick<InventoryLot, "name" | "category" | "expires_at" | "added_at"> => ({
    name: "Spinach",
    category: "vegetables",
    expires_at: null,
    added_at: now.toISOString(),
    ...over,
  });

  it("prefers explicit expiry over age-based estimation", () => {
    expect(resolveUrgency(lot({ expires_at: "2026-06-11" }), now)).toBe("urgent");
  });

  it("ages from added_at when there is no expiry", () => {
    // Spinach shelf life [2,4]; added 5 days ago → past the urgent threshold.
    const added = new Date("2026-06-05T12:00:00Z").toISOString();
    expect(resolveUrgency(lot({ added_at: added }), now)).toBe("urgent");
  });

  it("is safe for a freshly added item with no expiry", () => {
    expect(resolveUrgency(lot({}), now)).toBe("safe");
  });
});

describe("isPantryStaple", () => {
  it("treats only salt, pepper, and oil as owned", () => {
    expect(isPantryStaple("Salt")).toBe(true);
    expect(isPantryStaple("black pepper")).toBe(true);
    expect(isPantryStaple("pepper")).toBe(true);
    expect(isPantryStaple("extra virgin olive oil")).toBe(true);
  });

  it("treats other seasonings as real ingredients", () => {
    expect(isPantryStaple("dried oregano")).toBe(false);
    expect(isPantryStaple("paprika")).toBe(false);
    expect(isPantryStaple("soy sauce")).toBe(false);
    expect(isPantryStaple("honey")).toBe(false);
    expect(isPantryStaple("sugar")).toBe(false);
  });

  it("does not flag produce that shares staple words", () => {
    expect(isPantryStaple("bell pepper")).toBe(false);
    expect(isPantryStaple("red pepper")).toBe(false);
    expect(isPantryStaple("lemon")).toBe(false);
    expect(isPantryStaple("chicken breast")).toBe(false);
  });
});
