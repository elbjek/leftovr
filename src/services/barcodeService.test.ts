import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inferOpenFoodFactsCategory,
  lookupBarcodeProduct,
  lookupOpenFoodFactsBarcode,
  parseOpenFoodFactsQuantity,
  searchOpenFoodFactsProducts,
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

  it("maps Open Food Facts search hits to products", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        hits: [
          {
            code: "0894700010137",
            product_name: "Nonfat Greek Yogurt",
            brands: ["Chobani"],
            quantity: "32 OZ",
            categories_tags: ["en:dairies", "en:yogurts"],
          },
          {
            code: "5901234123457",
            product_name: "Plain Yogurt",
            brands: "Local Farm",
            categories_tags: ["en:yogurts"],
          },
          { code: "123", product_name: "  " },
          { product_name: "No code product" },
        ],
      }),
    })));

    await expect(searchOpenFoodFactsProducts("greek yogurt")).resolves.toEqual([
      {
        barcode: "0894700010137",
        name: "Nonfat Greek Yogurt",
        brandName: "Chobani",
        category: "dairy_eggs",
        quantity: 1,
        unit: "package",
        netAmount: 907.18,
        netUnit: "g",
      },
      {
        barcode: "5901234123457",
        name: "Plain Yogurt",
        brandName: "Local Farm",
        category: "dairy_eggs",
        quantity: 1,
        unit: "item",
        netAmount: null,
        netUnit: null,
      },
    ]);
  });

  it("returns empty list when search fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    await expect(searchOpenFoodFactsProducts("milk")).resolves.toEqual([]);
  });

  it("returns empty list for blank queries without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchOpenFoodFactsProducts("   ")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
