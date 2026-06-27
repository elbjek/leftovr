import {
  getCatalogNet,
  getShelfLifeRange,
  InventoryCategory,
  normalizeFoodName,
} from "./inventoryRules";

const HIGH_CONFIDENCE_THRESHOLD = 0.75;

// The model often expands cryptic OCR text into a plausible food at high
// confidence, so confidence alone misses junk names. Flag deterministically
// when the canonical name doesn't read like a real food word — digits,
// mostly-symbols, too short, or a vowel-less consonant code ("mlko", "brd").
export function looksUnnamed(rawName: string): boolean {
  const n = rawName.trim().toLowerCase();
  if (n.length < 2) return true;
  if (/\d/.test(n)) return true;
  const letters = n.replace(/[^a-záčćđšžćčöäüé]/gi, "");
  if (letters.length / n.length < 0.6) return true;
  const tokens = n.split(/\s+/).filter(Boolean);
  // A real food word has a vowel; a 3+ letter token with none is an OCR code.
  return tokens.some((token) => /^[a-z]{3,}$/.test(token) && !/[aeiouy]/.test(token));
}

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
    lowConfidence:
      line.confidence < HIGH_CONFIDENCE_THRESHOLD ||
      looksUnnamed(line.item.normalizedName) ||
      looksUnnamed(line.item.name),
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
