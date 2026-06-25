import { describe, expect, it } from "vitest";
import { formatPerMonth } from "./perMonth";

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
