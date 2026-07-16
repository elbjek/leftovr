import { describe, expect, it } from "vitest";

import { buildPantryConfirmItems, mergePantryLines } from "./pantryService";
import { NormalizedReceiptLine } from "./receiptService";

function line(overrides: {
  rawText?: string;
  confidence?: number;
  name?: string;
  normalizedName?: string;
  category?: string;
  quantity?: number | null;
  unit?: string | null;
}): NormalizedReceiptLine {
  return {
    rawText: overrides.rawText ?? "blue box of pasta",
    confidence: overrides.confidence ?? 0.9,
    item: {
      name: overrides.name ?? "Barilla spaghetti",
      normalizedName: overrides.normalizedName ?? "spaghetti",
      category: overrides.category ?? "pantry",
      quantity: overrides.quantity === undefined ? 1 : overrides.quantity,
      unit: overrides.unit === undefined ? null : overrides.unit,
      netAmount: null,
      netUnit: null,
    },
  };
}

describe("mergePantryLines", () => {
  it("keeps distinct foods untouched", () => {
    const lines = [
      line({ normalizedName: "spaghetti" }),
      line({ normalizedName: "baked beans", name: "Heinz beans", category: "pantry" }),
    ];
    expect(mergePantryLines(lines)).toHaveLength(2);
  });

  it("collapses the same food seen in overlapping photos", () => {
    const merged = mergePantryLines([
      line({ normalizedName: "spaghetti", quantity: 2, confidence: 0.6 }),
      line({ normalizedName: "Spaghetti ", quantity: 1, confidence: 0.95, name: "Barilla spaghetti n.5" }),
    ]);
    expect(merged).toHaveLength(1);
    // The most confident sighting wins the naming...
    expect(merged[0].item.name).toBe("Barilla spaghetti n.5");
    expect(merged[0].confidence).toBe(0.95);
    // ...but quantity is the max across sightings, never the sum.
    expect(merged[0].item.quantity).toBe(2);
  });

  it("treats a null quantity as one package when merging", () => {
    const merged = mergePantryLines([
      line({ normalizedName: "oat milk", quantity: null }),
      line({ normalizedName: "oat milk", quantity: 3, confidence: 0.5 }),
    ]);
    expect(merged[0].item.quantity).toBe(3);
  });
});

describe("buildPantryConfirmItems", () => {
  it("produces editable confirm rows from merged detections", () => {
    const items = buildPantryConfirmItems([
      line({ normalizedName: "spaghetti", quantity: 2 }),
      line({ normalizedName: "spaghetti", quantity: 1, confidence: 0.4 }),
      line({ normalizedName: "flour", name: "Flour", quantity: null, confidence: 0.3 }),
    ]);
    expect(items).toHaveLength(2);
    const spaghetti = items.find((item) => item.normalizedName === "spaghetti");
    expect(spaghetti?.quantity).toBe(2);
    expect(spaghetti?.lowConfidence).toBe(false);
    const flour = items.find((item) => item.normalizedName === "flour");
    // Null quantity falls back to 1; low model confidence flags it for review.
    expect(flour?.quantity).toBe(1);
    expect(flour?.lowConfidence).toBe(true);
  });
});
