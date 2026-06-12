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
});
