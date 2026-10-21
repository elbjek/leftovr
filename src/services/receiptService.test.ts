import { describe, expect, it } from "vitest";
import {
  buildConfirmedReceiptInventoryRows,
  buildReceiptConfirmItemsFromLines,
  looksUnnamed,
  NormalizedReceiptLine,
  ReceiptConfirmItem,
} from "./receiptService";

function line(name: string, normalizedName: string, confidence: number): NormalizedReceiptLine {
  return {
    rawText: name,
    confidence,
    item: { name, normalizedName, category: "other", quantity: 1, unit: "item", netAmount: null, netUnit: null },
  };
}

const baseItems: ReceiptConfirmItem[] = [
  {
    id: "row-1",
    name: "  Greek yogurt  ",
    normalizedName: "greek yogurt",
    category: "dairy_eggs",
    quantity: 2,
    unit: " tub ",
    confidence: 0.96,
    lowConfidence: false,
    included: true,
  },
  {
    id: "row-2",
    name: "Avcado",
    normalizedName: "avocado",
    category: "fruit",
    quantity: 2,
    unit: "item",
    confidence: 0.58,
    lowConfidence: true,
    included: false,
  },
];

describe("receipt service", () => {
  it("turns confirmed receipt rows into inventory insert rows", () => {
    const rows = buildConfirmedReceiptInventoryRows(baseItems, {
      householdId: "household-1",
      scanId: "scan-1",
      userId: "user-1",
      addedAt: "2026-06-12T10:00:00.000Z",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      household_id: "household-1",
      source_scan_id: "scan-1",
      added_by: "user-1",
      added_at: "2026-06-12T10:00:00.000Z",
      name: "Greek yogurt",
      normalized_name: "greek yogurt",
      category: "dairy_eggs",
      quantity: 2,
      unit: "tub",
      net_amount: 1000,
      net_unit: "g",
      partial_state: "full",
      shelf_life_range: "5-8 days",
      source: "receipt",
      confidence: 0.96,
    });
  });

  it("applies edited names before normalization and catalog lookup", () => {
    const rows = buildConfirmedReceiptInventoryRows(
      [
        {
          ...baseItems[1],
          name: "Milk",
          category: "dairy_eggs",
          quantity: 1,
          unit: "carton",
          included: true,
        },
      ],
      {
        householdId: "household-1",
        scanId: "scan-1",
        userId: "user-1",
        addedAt: "2026-06-12T10:00:00.000Z",
      },
    );

    expect(rows[0]).toMatchObject({
      name: "Milk",
      normalized_name: "milk",
      net_amount: 1000,
      net_unit: "ml",
      shelf_life_range: "4-7 days",
    });
  });

  it("carries a user-picked expiry onto the inventory row", () => {
    const rows = buildConfirmedReceiptInventoryRows(
      [{ ...baseItems[0], included: true, expiresAt: "2026-07-01" }],
      {
        householdId: "household-1",
        scanId: "scan-1",
        userId: "user-1",
        addedAt: "2026-06-12T10:00:00.000Z",
      },
    );

    expect(rows[0]).toMatchObject({ expires_at: "2026-07-01" });
  });

  it("flags junk names even when the model is confident, keeps real food clean", () => {
    const items = buildReceiptConfirmItemsFromLines([
      line("Milk", "milk", 0.98),
      line("ART 4729", "art 4729", 0.95), // digits — high confidence but not a food
      line("BRD", "brd", 0.92), // vowel-less OCR code
      line("Greek yogurt", "greek yogurt", 0.9),
    ]);

    expect(items.map((i) => i.lowConfidence)).toEqual([false, true, true, false]);
  });

  it("looksUnnamed: digits, codes, and stubs are flagged; foods are not", () => {
    expect(looksUnnamed("milk")).toBe(false);
    expect(looksUnnamed("greek yogurt")).toBe(false);
    expect(looksUnnamed("art 4729")).toBe(true);
    expect(looksUnnamed("brd")).toBe(true);
    expect(looksUnnamed("x")).toBe(true);
    expect(looksUnnamed("**")).toBe(true);
  });

  it("defaults expiry to null when none is picked", () => {
    const rows = buildConfirmedReceiptInventoryRows(baseItems, {
      householdId: "household-1",
      scanId: "scan-1",
      userId: "user-1",
      addedAt: "2026-06-12T10:00:00.000Z",
    });

    expect(rows[0].expires_at).toBeNull();
  });
});

describe("confirmed rows from scanned lines", () => {
  const scanned = (overrides: Partial<NormalizedReceiptLine["item"]> = {}): NormalizedReceiptLine => ({
    rawText: "JOGURT 180G",
    confidence: 0.95,
    item: { name: "Jogurt", normalizedName: "yogurt", category: "dairy_eggs", quantity: 2, unit: "cup", netAmount: 180, netUnit: "g", ...overrides },
  });
  const input = { householdId: "h", scanId: "s", userId: "u", addedAt: "2026-10-21T10:00:00.000Z" };

  it("keeps the model's match key when the name wasn't edited", () => {
    const [row] = buildConfirmedReceiptInventoryRows(
      buildReceiptConfirmItemsFromLines([scanned({ name: "Ajvar", normalizedName: "roasted pepper relish" })]),
      input,
    );
    expect(row.normalized_name).toBe("roasted pepper relish");
  });

  it("re-derives the match key from an edited name (B6)", () => {
    const [item] = buildReceiptConfirmItemsFromLines([scanned({ name: "Pckl", normalizedName: "pickles" })]);
    const [row] = buildConfirmedReceiptInventoryRows([{ ...item, name: "Paradajz" }], input);
    expect(row.normalized_name).toBe("tomatoes");
  });

  it("uses the printed pack size over the catalog default (B7)", () => {
    const [row] = buildConfirmedReceiptInventoryRows(buildReceiptConfirmItemsFromLines([scanned()]), input);
    expect(row).toMatchObject({ net_amount: 360, net_unit: "g", purchase_amount: null });
  });

  it("falls back to the catalog size when nothing is printed", () => {
    const [row] = buildConfirmedReceiptInventoryRows(
      buildReceiptConfirmItemsFromLines([scanned({ name: "Greek yogurt", normalizedName: "greek yogurt", netAmount: null, netUnit: null })]),
      input,
    );
    expect(row).toMatchObject({ net_amount: 1000, net_unit: "g" });
  });
});
