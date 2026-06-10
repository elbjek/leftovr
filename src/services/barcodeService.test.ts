import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inferOpenFoodFactsCategory,
  lookupBarcodeProduct,
  lookupOpenFoodFactsBarcode,
  parseOpenFoodFactsQuantity,
} from "./barcodeService";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("barcodeService", () => {
  it("maps Open Food Facts products into inventory items", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: "success",
        product: {
          product_name: "Whole milk",
          brands: "Dairy Best, Store brand",
          quantity: "1 L",
          categories_tags: ["en:dairies", "en:milks"],
        },
      }),
    })));

    await expect(lookupOpenFoodFactsBarcode("737628064502")).resolves.toEqual({
      barcode: "737628064502",
      name: "Whole milk",
      brandName: "Dairy Best",
      category: "dairy_eggs",
      quantity: 1,
      unit: "package",
      netAmount: 1000,
      netUnit: "ml",
    });
  });

  it("falls back to local mock products when Open Food Facts has no match", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "failure" }),
    })));

    await expect(lookupBarcodeProduct("5901234123457")).resolves.toMatchObject({
      name: "Milk",
      brandName: "Chomp Dairy",
      category: "dairy_eggs",
      unit: "carton",
      netAmount: 1000,
      netUnit: "ml",
    });
  });

  it("fills missing Open Food Facts amounts from known local products", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: "success",
        product: {
          product_name: "100% orange juice from concentrate, orange",
          brands: "Tropicana",
          categories_tags: ["en:beverages"],
        },
      }),
    })));

    await expect(lookupBarcodeProduct("0048500005729")).resolves.toMatchObject({
      name: "100% orange juice from concentrate, orange",
      brandName: "Tropicana",
      category: "drinks",
      unit: "bottle",
      netAmount: 1892.71,
      netUnit: "ml",
    });
  });

  it("returns null for unknown barcode misses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "failure" }),
    })));

    await expect(lookupBarcodeProduct("unknown-demo-code")).resolves.toBeNull();
  });

  it("infers app categories from Open Food Facts category tags", () => {
    expect(inferOpenFoodFactsCategory(["en:frozen-foods"])).toBe("frozen");
    expect(inferOpenFoodFactsCategory(["en:fruit-juices"])).toBe("drinks");
    expect(inferOpenFoodFactsCategory(["en:sodas"])).toBe("drinks");
    expect(inferOpenFoodFactsCategory(["en:unknown"])).toBe("other");
  });

  it("parses Open Food Facts package quantities", () => {
    expect(parseOpenFoodFactsQuantity("1 L")).toEqual({ netAmount: 1000, netUnit: "ml" });
    expect(parseOpenFoodFactsQuantity("52 fl oz")).toEqual({ netAmount: 1537.82, netUnit: "ml" });
    expect(parseOpenFoodFactsQuantity("500 g")).toEqual({ netAmount: 500, netUnit: "g" });
    expect(parseOpenFoodFactsQuantity("2 x 100g")).toEqual({ netAmount: 200, netUnit: "g" });
  });
});
