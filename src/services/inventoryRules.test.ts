import { describe, expect, it } from "vitest";
import {
  daysLeft,
  getShelfLifeDays,
  hasExplicitExpiredLot,
  inferCategory,
  InventoryLot,
  isMetricAmountRunningLow,
  isPantryStaple,
  resolveUrgency,
  stillGoodExpiryDate,
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

  it("keeps items urgent through the 3-day grace window, then expired", () => {
    expect(urgencyFromExpiry("2026-06-08", now)).toBe("urgent");
    expect(urgencyFromExpiry("2026-06-01", now)).toBe("expired");
  });

  it("gives meat and fish no grace once the date has passed (B3)", () => {
    expect(urgencyFromExpiry("2026-06-09", now, "meat")).toBe("expired");
    expect(urgencyFromExpiry("2026-06-09", now, "fish")).toBe("expired");
    expect(urgencyFromExpiry("2026-06-10", now, "meat")).toBe("urgent"); // today is still fine
    expect(urgencyFromExpiry("2026-06-09", now, "dairy_eggs")).toBe("urgent");
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
    // Spinach shelf life [2,4]: 3 days old → urgent, 5 days old → expired.
    const urgentAdded = new Date("2026-06-07T12:00:00Z").toISOString();
    expect(resolveUrgency(lot({ added_at: urgentAdded }), now)).toBe("urgent");
    const expiredAdded = new Date("2026-06-05T12:00:00Z").toISOString();
    expect(resolveUrgency(lot({ added_at: expiredAdded }), now)).toBe("expired");
  });

  it("is safe for a freshly added item with no expiry", () => {
    expect(resolveUrgency(lot({}), now)).toBe("safe");
  });
});

describe("hasExplicitExpiredLot", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("is true only when a user-entered date has passed", () => {
    expect(hasExplicitExpiredLot([{ expires_at: "2026-06-01" }], now)).toBe(true);
    expect(hasExplicitExpiredLot([{ expires_at: "2026-06-11" }], now)).toBe(false);
  });

  it("is false for lots without an explicit date (band was our estimate)", () => {
    expect(hasExplicitExpiredLot([{ expires_at: null }], now)).toBe(false);
    expect(hasExplicitExpiredLot([{ expires_at: null }, { expires_at: "2026-06-01" }], now)).toBe(true);
  });
});

describe("stillGoodExpiryDate", () => {
  it("returns a local date 3 days out", () => {
    expect(stillGoodExpiryDate(new Date(2026, 5, 10, 12))).toBe("2026-06-13");
    // Rolls over month ends correctly.
    expect(stillGoodExpiryDate(new Date(2026, 5, 29, 12))).toBe("2026-07-02");
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

describe("daysLeft (FIXES B2)", () => {
  const now = new Date("2026-10-21T12:00:00");
  it("uses the explicit date when there is one", () => {
    expect(daysLeft({ name: "Milk", category: "dairy_eggs", expires_at: "2026-10-23", added_at: "2026-10-01T00:00:00Z" }, now))
      .toBeCloseTo(2.5, 1);
  });
  it("is negative past the date", () => {
    expect(daysLeft({ name: "Milk", category: "dairy_eggs", expires_at: "2026-10-19", added_at: "2026-10-01T00:00:00Z" }, now))
      .toBeLessThan(0);
  });
  it("estimates from the shelf-life range end without a date", () => {
    // Spinach: 2-4 days; added 1 day ago -> ~3 days left.
    expect(daysLeft({ name: "Spinach", category: "vegetables", expires_at: null, added_at: "2026-10-20T12:00:00" }, now))
      .toBeCloseTo(3, 1);
  });
  it("orders a dated item expiring tomorrow before an estimated one with 3 days", () => {
    const dated = daysLeft({ name: "Rice", category: "pantry", expires_at: "2026-10-22", added_at: "2026-01-01T00:00:00Z" }, now);
    const estimated = daysLeft({ name: "Spinach", category: "vegetables", expires_at: null, added_at: "2026-10-20T12:00:00" }, now);
    expect(dated).toBeLessThan(estimated);
  });
});
