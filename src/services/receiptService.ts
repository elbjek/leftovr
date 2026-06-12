import { mockReceiptTemplates, MockReceiptItem } from "@/mocks";
import {
  getCatalogNet,
  getShelfLifeRange,
  normalizeFoodName,
} from "./inventoryRules";

const HIGH_CONFIDENCE_THRESHOLD = 0.75;

export type ReceiptConfirmItem = {
  id: string;
  name: string;
  category: MockReceiptItem["category"];
  quantity: number;
  unit: string;
  confidence: number;
  lowConfidence: boolean;
  included: boolean;
};

export type ReceiptInventoryRowInput = {
  householdId: string;
  scanId: string;
  userId: string;
  addedAt: string;
};

export function getMockReceiptTemplate(key: string) {
  return mockReceiptTemplates.find((template) => template.key === key) ?? mockReceiptTemplates[0];
}

export function buildReceiptConfirmItems(templateKey: string): ReceiptConfirmItem[] {
  const template = getMockReceiptTemplate(templateKey);

  return template.items.map((item, index) => ({
    id: `${template.key}-${index}`,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    confidence: item.confidence,
    lowConfidence: item.confidence < HIGH_CONFIDENCE_THRESHOLD,
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
        source: "receipt" as const,
        source_scan_id: input.scanId,
        confidence: item.confidence,
        added_by: input.userId,
        added_at: input.addedAt,
      };
    });
}
