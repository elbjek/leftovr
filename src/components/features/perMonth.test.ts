import { describe, expect, it } from "vitest";
import { formatPerMonth, savePercent } from "./perMonth";

describe("formatPerMonth", () => {
  it("divides an annual price into a monthly currency string", () => {
    const out = formatPerMonth({ product: { price: 54.99, currencyCode: "USD" } }, "$4.58");
    expect(out).toContain("4.58");
  });

  it("returns the fallback when there is no package", () => {
    expect(formatPerMonth(null, "$4.58")).toBe("$4.58");
  });

  it("returns the fallback when the currency code is invalid", () => {
    expect(formatPerMonth({ product: { price: 54.99, currencyCode: "ZZZZ" } }, "$4.58")).toBe("$4.58");
  });
});

describe("savePercent", () => {
  it("computes the yearly discount vs 12 monthly payments", () => {
    // household: $9.99/mo * 12 = $119.88 full vs $79.99 yearly → 33%
    expect(savePercent({ product: { price: 9.99 } }, { product: { price: 79.99 } })).toBe(33);
  });

  it("returns null when a package is missing", () => {
    expect(savePercent(null, { product: { price: 79.99 } })).toBeNull();
    expect(savePercent({ product: { price: 9.99 } }, null)).toBeNull();
  });

  it("returns null when there is no real saving", () => {
    expect(savePercent({ product: { price: 5 } }, { product: { price: 60 } })).toBeNull();
  });
});
