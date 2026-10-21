import { describe, expect, it } from "vitest";
import { deriveUnitPrice, valueOfAmount, formatMoney, categoryAverageUnitPrice } from "./money";

describe("categoryAverageUnitPrice", () => {
  it("averages unit prices of priced lots in a category", () => {
    const lots = [
      { category: "dairy_eggs", purchase_price: 5, purchase_amount: 1000, net_unit: "ml" }, // 0.005
      { category: "dairy_eggs", purchase_price: 3, purchase_amount: 1000, net_unit: "ml" }, // 0.003
      { category: "meat", purchase_price: 8, purchase_amount: 400, net_unit: "g" },
    ];
    expect(categoryAverageUnitPrice(lots, "dairy_eggs", "ml")).toBe(0.004);
  });
  it("never mixes per-item and per-gram prices", () => {
    const lots = [
      { category: "dairy_eggs", purchase_price: 3, purchase_amount: 10, net_unit: null }, // 0.3 per egg
      { category: "dairy_eggs", purchase_price: 2, purchase_amount: 500, net_unit: "g" }, // 0.004 per g
    ];
    expect(categoryAverageUnitPrice(lots, "dairy_eggs", null)).toBe(0.3);
    expect(categoryAverageUnitPrice(lots, "dairy_eggs", "g")).toBe(0.004);
    expect(categoryAverageUnitPrice(lots, "dairy_eggs", "ml")).toBeNull();
  });
  it("returns null when no priced lot in category", () => {
    expect(categoryAverageUnitPrice([], "meat", null)).toBeNull();
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
