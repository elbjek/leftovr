import { describe, expect, it } from "vitest";
import {
  buildConfirmedReceiptInventoryRows,
  ReceiptConfirmItem,
} from "./receiptService";

const baseItems: ReceiptConfirmItem[] = [
  {
    id: "row-1",
    name: "  Greek yogurt  ",
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
