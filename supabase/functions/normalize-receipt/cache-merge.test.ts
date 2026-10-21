import { describe, expect, it } from "vitest";

import {
  mergeWithCache,
  NormalizedLine,
  ReceiptLineCacheRow,
} from "./cache-merge";

const line = (overrides: Partial<NormalizedLine> & { rawText: string }): NormalizedLine => ({
  confidence: 0.9,
  item: {
    name: "Milk",
    normalizedName: "milk",
    category: "dairy_eggs",
    quantity: 1,
    unit: "carton",
    netAmount: 1000,
    netUnit: "ml",
    price: 2,
    priceApproximate: false,
  },
  ...overrides,
});

const cacheRow = (
  overrides: Partial<ReceiptLineCacheRow> & { raw_line_text: string },
): ReceiptLineCacheRow => ({
  store_chain: "rema-1000",
  name: "Whole milk",
  normalized_name: "milk",
  category: "dairy_eggs",
  quantity: 1,
  unit: "carton",
  net_amount: 1000,
  net_unit: "ml",
  confidence: 0.97,
  ...overrides,
});

describe("mergeWithCache", () => {
  it("overrides model output with the cached canonical item on a hit", () => {
    const result = mergeWithCache(
      "rema-1000",
      [line({ rawText: "TINE LETTML 1L", confidence: 0.6 })],
      [cacheRow({ raw_line_text: "TINE LETTML 1L" })],
    );

    expect(result.lines[0].item.name).toBe("Whole milk");
    expect(result.lines[0].confidence).toBe(0.97);
    expect(result.hits).toEqual(["TINE LETTML 1L"]);
    expect(result.writes).toHaveLength(0);
  });

  it("keeps the live scan's price on a cache hit (price is never cached)", () => {
    const result = mergeWithCache(
      "rema-1000",
      [line({ rawText: "TINE LETTML 1L", confidence: 0.6, item: {
        name: "Milk", normalizedName: "milk", category: "dairy_eggs",
        quantity: 1, unit: "carton", netAmount: 1000, netUnit: "ml",
        price: 1.79, priceApproximate: false,
      } })],
      [cacheRow({ raw_line_text: "TINE LETTML 1L" })],
    );

    expect(result.lines[0].item.name).toBe("Whole milk");
    expect(result.lines[0].item.price).toBe(1.79);
  });

  it("writes back confident misses only", () => {
    const result = mergeWithCache(
      "rema-1000",
      [
        line({ rawText: "TINE LETTML 1L", confidence: 0.95 }),
        line({ rawText: "GR.SAK XX", confidence: 0.4 }),
      ],
      [],
    );

    expect(result.writes).toHaveLength(1);
    expect(result.writes[0]).toMatchObject({
      store_chain: "rema-1000",
      raw_line_text: "TINE LETTML 1L",
      normalized_name: "milk",
      confidence: 0.95,
    });
    expect(result.hits).toHaveLength(0);
    // Low-confidence line still returned to the user, just not cached.
    expect(result.lines).toHaveLength(2);
  });

  it("keeps model output untouched on a miss", () => {
    const result = mergeWithCache(
      "lidl",
      [line({ rawText: "MILCH 1L" })],
      [cacheRow({ raw_line_text: "OTHER LINE" })],
    );

    expect(result.lines[0]).toEqual(line({ rawText: "MILCH 1L" }));
  });

  it("dedupes repeated raw lines in write-back", () => {
    const result = mergeWithCache(
      "rema-1000",
      [line({ rawText: "TINE LETTML 1L" }), line({ rawText: "TINE LETTML 1L" })],
      [],
    );

    expect(result.writes).toHaveLength(1);
    expect(result.lines).toHaveLength(2);
  });

  it("keeps the live scan's quantity and unit on a hit (B8)", () => {
    const result = mergeWithCache(
      "rema-1000",
      [line({ rawText: "JOGURT 180G", item: { ...line({ rawText: "x" }).item, quantity: 3, unit: "cup" } })],
      [cacheRow({ raw_line_text: "JOGURT 180G", quantity: 1, unit: "tub" })],
    );
    expect(result.lines[0].item).toMatchObject({ name: "Whole milk", quantity: 3, unit: "cup" });
  });

  it("never reads or writes the shared 'unknown' store bucket (B8)", () => {
    const result = mergeWithCache(
      "unknown",
      [line({ rawText: "MLEKO 1L", confidence: 0.95 })],
      [cacheRow({ raw_line_text: "MLEKO 1L", store_chain: "unknown", name: "Someone else's milk" })],
    );
    expect(result.lines[0].item.name).toBe("Milk");
    expect(result.hits).toHaveLength(0);
    expect(result.writes).toHaveLength(0);
  });
});
