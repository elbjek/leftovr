import {
  canonicalFoodName,
  getCatalogFood,
  getCatalogNet,
  getShelfLifeRange,
  InventoryCategory,
  normalizeFoodName,
} from "./inventoryRules";

// The model self-reports honestly only at the extremes: it parks anything it
// corrected, guessed, or stripped store-noise from at ~0.8 and reserves ~0.9
// for genuinely-clean reads. Gate at 0.85 so the 0.8 "fudged" tier gets flagged
// for a human look; raise toward 0.9 if junk still slips through.
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

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
  // Canonical English food name from the model — the key recipes match on.
  // Display `name` stays in the receipt's language; this does not.
  normalizedName: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  confidence: number;
  lowConfidence: boolean;
  included: boolean;
  // Raw OCR text the line was scanned from; shown as "scanned as" context.
  rawText?: string;
  // The model's display name before any user edit. When `name` differs, the
  // user corrected a misread and `normalizedName` no longer applies (B6).
  scannedName?: string;
  // Optional user-picked expiry (YYYY-MM-DD); falls back to shelf-life range.
  expiresAt?: string | null;
  // Per-line price (read or AI-estimated), in the receipt's currency.
  price?: number | null;
  // Metric size per pack as printed on the line/packaging (B7); the catalog
  // default is only the fallback.
  netAmount?: number | null;
  netUnit?: string | null;
};

export type ReceiptInventoryRowInput = {
  householdId: string;
  scanId: string;
  userId: string;
  addedAt: string;
  // Pantry-photo scans confirm through the same builder; rows they create are
  // sourced "pantry" so they never enter purchase/spend accounting.
  source?: "receipt" | "pantry";
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
    price?: number | null;
    priceApproximate?: boolean;
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
    normalizedName: line.item.normalizedName,
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
    rawText: line.rawText,
    scannedName: line.item.name,
    price: line.item.price ?? null,
    netAmount: line.item.netAmount,
    netUnit: line.item.netUnit,
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
      const printedNet =
        item.netAmount != null && item.netAmount > 0 && (item.netUnit === "ml" || item.netUnit === "g")
          ? { netAmount: item.netAmount, netUnit: item.netUnit as "ml" | "g" }
          : null;
      const packNet = printedNet ?? getCatalogNet(name);
      const netAmount = packNet ? packNet.netAmount * quantity : null;
      // Basis for proportional attribution: the amount the price covers.
      const purchaseAmount = netAmount ?? quantity;

      return {
        household_id: input.householdId,
        name,
        // A recognized or edited name wins — the user's correction is
        // authoritative, even for foods outside the catalog (B6). Otherwise
        // use the model's English canonical so a foreign receipt name still
        // matches English recipe ingredients; fall back to the raw name only
        // when neither is available.
        normalized_name:
          getCatalogFood(name) || (item.scannedName != null && name !== item.scannedName.trim())
            ? canonicalFoodName(name)
            : item.normalizedName?.trim() || normalizeFoodName(name),
        category: item.category,
        quantity,
        unit,
        net_amount: netAmount,
        net_unit: packNet?.netUnit ?? null,
        partial_state: "full" as const,
        shelf_life_range: getShelfLifeRange(name, item.category),
        expires_at: item.expiresAt ?? null,
        source: input.source ?? ("receipt" as const),
        source_scan_id: input.scanId,
        confidence: item.confidence,
        added_by: input.userId,
        added_at: input.addedAt,
        purchase_price: item.price ?? null,
        purchase_amount: item.price != null ? purchaseAmount : null,
      };
    });
}
