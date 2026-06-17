import {
  getCatalogNet,
  getShelfLifeRange,
  InventoryCategory,
  normalizeFoodName,
} from "./inventoryRules";

const HIGH_CONFIDENCE_THRESHOLD = 0.75;

export type ReceiptConfirmItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  confidence: number;
  lowConfidence: boolean;
  included: boolean;
  // Optional user-picked expiry (YYYY-MM-DD); falls back to shelf-life range.
  expiresAt?: string | null;
};

export type ReceiptInventoryRowInput = {
  householdId: string;
  scanId: string;
  userId: string;
  addedAt: string;
};

export type NormalizedReceiptLine = {
  rawText: string;
  confidence: number;
  item: {
    name: string;
    normalizedName: string;
    category: string;
    quantity: number | null;
    unit: string | null;
    netAmount: number | null;
    netUnit: string | null;
  };
};

const VALID_CATEGORIES = new Set<string>([
  "dairy_eggs", "meat", "fish", "vegetables", "fruit", "bakery",
  "pantry", "frozen", "drinks", "snacks", "other",
]);

export function buildReceiptConfirmItemsFromLines(
  lines: NormalizedReceiptLine[],
): ReceiptConfirmItem[] {
  return lines.map((line, index) => ({
    id: `line-${index}`,
    name: line.item.name,
    category: (VALID_CATEGORIES.has(line.item.category)
      ? line.item.category
      : "other") as ReceiptConfirmItem["category"],
    quantity: line.item.quantity != null && line.item.quantity > 0 ? line.item.quantity : 1,
    unit: line.item.unit ?? "item",
    confidence: line.confidence,
    lowConfidence: line.confidence < HIGH_CONFIDENCE_THRESHOLD,
    included: true,
  }));
}

export function buildConfirmedReceiptInventoryRows(
  items: ReceiptConfirmItem[],
  input: ReceiptInventoryRowInput,
) {
  return items
    .filter((item) => item.included)
    .map((item) => {
      const name = item.name.trim();
      const unit = item.unit.trim() || "item";
      const quantity = item.quantity > 0 ? item.quantity : 1;
      const catalogNet = getCatalogNet(name);

      return {
        household_id: input.householdId,
        name,
        normalized_name: normalizeFoodName(name),
        category: item.category,
        quantity,
        unit,
        net_amount: catalogNet ? catalogNet.netAmount * quantity : null,
        net_unit: catalogNet?.netUnit ?? null,
        partial_state: "full" as const,
        shelf_life_range: getShelfLifeRange(name, item.category),
        expires_at: item.expiresAt ?? null,
        source: "receipt" as const,
        source_scan_id: input.scanId,
        confidence: item.confidence,
        added_by: input.userId,
        added_at: input.addedAt,
      };
    });
}
