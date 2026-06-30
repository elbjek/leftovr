import { describe, expect, it } from "vitest";
import { deriveUnitPrice, valueOfAmount, formatMoney, categoryAverageUnitPrice } from "./money";

describe("categoryAverageUnitPrice", () => {
  it("averages unit prices of priced lots in a category", () => {
    const lots = [
      { category: "dairy_eggs", purchase_price: 5, purchase_amount: 1000 }, // 0.005
      { category: "dairy_eggs", purchase_price: 3, purchase_amount: 1000 }, // 0.003
      { category: "meat", purchase_price: 8, purchase_amount: 400 },
    ];
    expect(categoryAverageUnitPrice(lots, "dairy_eggs")).toBe(0.004);
  });
  it("returns null when no priced lot in category", () => {
    expect(categoryAverageUnitPrice([], "meat")).toBeNull();
  });
});

describe("deriveUnitPrice", () => {
  it("divides total by basis amount", () => {
    expect(deriveUnitPrice(5, 1000)).toBe(0.005);
  });
  it("returns null when basis missing or zero", () => {
    expect(deriveUnitPrice(5, 0)).toBeNull();
    expect(deriveUnitPrice(null, 1000)).toBeNull();
  });
});

describe("valueOfAmount", () => {
  it("values consumed amount at unit price", () => {
    // 200g of a 1kg/$5 lot => $1
    expect(valueOfAmount(200, deriveUnitPrice(5, 1000))).toBe(1);
  });
  it("returns 0 when unit price null", () => {
    expect(valueOfAmount(200, null)).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats with currency code", () => {
    expect(formatMoney(1.5, "USD")).toBe("$1.50");
  });
  it("falls back to code prefix for unknown currency", () => {
    expect(formatMoney(1.5, "ZZZ")).toContain("1.5");
  });
});
