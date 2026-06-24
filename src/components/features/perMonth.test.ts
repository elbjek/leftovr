import { describe, expect, it } from "vitest";
import { formatPerMonth } from "./perMonth";

describe("formatPerMonth", () => {
  it("divides an annual price into a monthly currency string", () => {
    const out = formatPerMonth({ product: { price: 69.99, currencyCode: "USD" } }, "$5.83");
    expect(out).toContain("5.83");
  });

  it("returns the fallback when there is no package", () => {
    expect(formatPerMonth(null, "$5.83")).toBe("$5.83");
  });

  it("returns the fallback when the currency code is invalid", () => {
    expect(formatPerMonth({ product: { price: 69.99, currencyCode: "ZZZZ" } }, "$5.83")).toBe("$5.83");
  });
});
