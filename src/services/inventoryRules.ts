import { i18n } from "@/i18n";
import { formatAmount, MeasurementSystem } from "./units";

export const INVENTORY_CATEGORIES = [
  "dairy_eggs",
  "meat",
  "fish",
  "vegetables",
  "fruit",
  "bakery",
  "pantry",
  "frozen",
  "drinks",
  "snacks",
  "other",
] as const;

export const PARTIAL_STATES = ["full", "some_used", "low"] as const;
export const URGENCY_BANDS = ["safe", "use_soon", "urgent"] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
export type PartialState = (typeof PARTIAL_STATES)[number];
export type UrgencyBand = (typeof URGENCY_BANDS)[number];
export type InventorySource = "receipt" | "barcode" | "manual" | "moved_from_household";

export type CatalogFood = {
  name: string;
  category: InventoryCategory;
  shelfLifeDays: [number, number];
  unit?: string;
  netAmount?: number;
  netUnit?: "ml" | "g";
};

export type InventoryLot = {
  id: string;
  name: string;
  normalized_name: string;
  brand_name: string | null;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  net_amount: number | null;
  net_unit: "ml" | "g" | null;
  partial_state: PartialState;
  shelf_life_range: string | null;
  expires_at: string | null;
  source: InventorySource;
  added_at: string;
  removed_at: string | null;
  added_by: string | null;
  added_by_name: string | null;
};

export type InventoryGroup = {
  key: string;
  name: string;
  normalizedName: string;
  brandName: string | null;
  category: InventoryCategory;
  urgency: UrgencyBand;
  urgencyLabel: string;
  shelfLifeRange: string;
  quantity: number;
  unit: string;
  netAmount: number | null;
  netUnit: "ml" | "g" | null;
  partialState: PartialState;
  partialLabel: string;
  lotCount: number;
  lots: InventoryLot[];
  meta: string;
};

const categoryDefaults: Record<InventoryCategory, [number, number]> = {
  dairy_eggs: [5, 10],
  meat: [1, 3],
  fish: [1, 2],
  vegetables: [3, 7],
  fruit: [3, 7],
  bakery: [2, 5],
  pantry: [21, 90],
  frozen: [60, 180],
  drinks: [7, 30],
  snacks: [14, 60],
  other: [5, 14],
};

export const demoFoodCatalog: CatalogFood[] = [
  { name: "Eggs", category: "dairy_eggs", shelfLifeDays: [14, 21], unit: "egg" },
  { name: "Greek yogurt", category: "dairy_eggs", shelfLifeDays: [5, 8], unit: "tub", netAmount: 500, netUnit: "g" },
  { name: "Milk", category: "dairy_eggs", shelfLifeDays: [4, 7], unit: "carton", netAmount: 1000, netUnit: "ml" },
  { name: "Butter", category: "dairy_eggs", shelfLifeDays: [21, 45], unit: "block", netAmount: 250, netUnit: "g" },
  { name: "Feta", category: "dairy_eggs", shelfLifeDays: [7, 14], unit: "pack", netAmount: 200, netUnit: "g" },
  { name: "Chicken breast", category: "meat", shelfLifeDays: [1, 2], unit: "pack", netAmount: 400, netUnit: "g" },
  { name: "Ground beef", category: "meat", shelfLifeDays: [1, 2], unit: "pack", netAmount: 500, netUnit: "g" },
  { name: "Turkey slices", category: "meat", shelfLifeDays: [3, 5], unit: "pack", netAmount: 200, netUnit: "g" },
  { name: "Salmon", category: "fish", shelfLifeDays: [1, 2], unit: "fillet" },
  { name: "Tuna", category: "fish", shelfLifeDays: [90, 365], unit: "can", netAmount: 160, netUnit: "g" },
  { name: "Spinach", category: "vegetables", shelfLifeDays: [2, 4], unit: "bag", netAmount: 200, netUnit: "g" },
  { name: "Tomatoes", category: "vegetables", shelfLifeDays: [4, 7], unit: "item" },
  { name: "Carrots", category: "vegetables", shelfLifeDays: [14, 30], unit: "bag", netAmount: 1000, netUnit: "g" },
  { name: "Broccoli", category: "vegetables", shelfLifeDays: [3, 5], unit: "head" },
  { name: "Bell peppers", category: "vegetables", shelfLifeDays: [5, 8], unit: "item" },
  { name: "Zucchini", category: "vegetables", shelfLifeDays: [4, 7], unit: "item" },
  { name: "Mushrooms", category: "vegetables", shelfLifeDays: [2, 5], unit: "box", netAmount: 250, netUnit: "g" },
  { name: "Red onion", category: "vegetables", shelfLifeDays: [14, 30], unit: "item" },
  { name: "Garlic", category: "vegetables", shelfLifeDays: [21, 60], unit: "bulb" },
  { name: "Bananas", category: "fruit", shelfLifeDays: [3, 5], unit: "item" },
  { name: "Apples", category: "fruit", shelfLifeDays: [14, 30], unit: "item" },
  { name: "Lemons", category: "fruit", shelfLifeDays: [14, 30], unit: "item" },
  { name: "Blueberries", category: "fruit", shelfLifeDays: [3, 5], unit: "punnet", netAmount: 125, netUnit: "g" },
  { name: "Sourdough", category: "bakery", shelfLifeDays: [2, 4], unit: "loaf" },
  { name: "Tortillas", category: "bakery", shelfLifeDays: [7, 14], unit: "pack" },
  { name: "Pita bread", category: "bakery", shelfLifeDays: [3, 5], unit: "pack" },
  { name: "Rice", category: "pantry", shelfLifeDays: [60, 180], unit: "bag", netAmount: 1000, netUnit: "g" },
  { name: "Pasta", category: "pantry", shelfLifeDays: [180, 365], unit: "box", netAmount: 500, netUnit: "g" },
  { name: "Chickpeas", category: "pantry", shelfLifeDays: [180, 365], unit: "can", netAmount: 400, netUnit: "g" },
  { name: "Black beans", category: "pantry", shelfLifeDays: [180, 365], unit: "can", netAmount: 400, netUnit: "g" },
  { name: "Coconut milk", category: "pantry", shelfLifeDays: [180, 365], unit: "can", netAmount: 400, netUnit: "ml" },
  { name: "Olive oil", category: "pantry", shelfLifeDays: [180, 365], unit: "bottle", netAmount: 500, netUnit: "ml" },
  { name: "Oats", category: "pantry", shelfLifeDays: [90, 180], unit: "bag", netAmount: 1000, netUnit: "g" },
  { name: "Frozen peas", category: "frozen", shelfLifeDays: [60, 120], unit: "bag", netAmount: 500, netUnit: "g" },
  { name: "Frozen berries", category: "frozen", shelfLifeDays: [60, 120], unit: "bag", netAmount: 500, netUnit: "g" },
  { name: "Orange juice", category: "drinks", shelfLifeDays: [5, 10], unit: "bottle", netAmount: 1000, netUnit: "ml" },
  { name: "Sparkling water", category: "drinks", shelfLifeDays: [90, 365], unit: "can", netAmount: 330, netUnit: "ml" },
  { name: "Hummus", category: "snacks", shelfLifeDays: [4, 7], unit: "tub", netAmount: 200, netUnit: "g" },
  { name: "Almonds", category: "snacks", shelfLifeDays: [60, 180], unit: "bag", netAmount: 200, netUnit: "g" },
  { name: "Cheddar", category: "dairy_eggs", shelfLifeDays: [14, 30], unit: "block", netAmount: 200, netUnit: "g" },
];

const catalogByName = new Map(demoFoodCatalog.map((item) => [normalizeFoodName(item.name), item]));

// Localized aliases → canonical catalog name. The demo catalog and recipe
// library are English mock data, so non-English inventory names (e.g. the
// Serbian demo item "Grcki jogurt") miss the catalog and get a generic
// category/shelf life. This bounded alias table fixes the foods the app
// itself surfaces; full multilingual food intelligence is the eventual
// AI/OpenFoodFacts-taxonomy job (CODE_REVIEW #7). Keys are diacritic-folded.
const FOOD_ALIASES: Record<string, string> = {
  // Serbian
  "grcki jogurt": "greek yogurt",
  jogurt: "greek yogurt",
  mleko: "milk",
  jaja: "eggs",
  "pileca prsa": "chicken breast",
  losos: "salmon",
  spanac: "spinach",
  paradajz: "tomatoes",
  banane: "bananas",
  pirinac: "rice",
  "smrznuti grasak": "frozen peas",
  "sok od pomorandze": "orange juice",
  humus: "hummus",
  kackavalj: "cheddar",
};

function foldDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeFoodName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Only salt, pepper, and cooking oil are assumed owned — recipes treat them
// as universal. Other seasonings (herbs, spices, sauces) are real ingredients
// people may not have, so they keep the missing-ingredient flow. Keyword
// match on the normalized name ("extra virgin olive oil" → "oil").
const PANTRY_STAPLE_KEYWORDS = [
  "salt",
  "black pepper",
  "white pepper",
  "peppercorn",
  "oil",
];

export function isPantryStaple(name: string): boolean {
  const normalized = normalizeFoodName(name);
  // Bare "pepper" in a recipe means seasoning; "bell/red pepper" is produce
  // and must NOT match, so the keyword list spells out pepper variants.
  if (normalized === "pepper") return true;
  return PANTRY_STAPLE_KEYWORDS.some(
    (keyword) =>
      normalized === keyword ||
      normalized.endsWith(` ${keyword}`) ||
      (keyword.includes(" ") && normalized.includes(keyword)),
  );
}

export function getCatalogFood(name: string) {
  const normalized = normalizeFoodName(name);
  const direct = catalogByName.get(normalized);
  if (direct) return direct;

  const canonical = FOOD_ALIASES[foldDiacritics(normalized)];
  return canonical ? catalogByName.get(canonical) : undefined;
}

// Normalized name folded through the alias table to a canonical (English)
// catalog key when one exists. Both the fridge and the English recipe library
// resolve through this so a localized inventory name still matches recipe
// ingredients (CODE_REVIEW #7).
export function canonicalFoodName(name: string) {
  const normalized = normalizeFoodName(name);
  if (catalogByName.has(normalized)) return normalized;
  return FOOD_ALIASES[foldDiacritics(normalized)] ?? normalized;
}

export function getCatalogNet(name: string): { netAmount: number; netUnit: "ml" | "g" } | null {
  const food = getCatalogFood(name);
  if (food?.netAmount && food.netUnit) {
    return { netAmount: food.netAmount, netUnit: food.netUnit };
  }
  return null;
}

export function inferCategory(name: string): InventoryCategory {
  return getCatalogFood(name)?.category ?? "other";
}

export function getShelfLifeDays(name: string, category: InventoryCategory): [number, number] {
  return getCatalogFood(name)?.shelfLifeDays ?? categoryDefaults[category];
}

export function getShelfLifeRange(name: string, category: InventoryCategory) {
  const range = getShelfLifeDays(name, category);
  return `${range[0]}-${range[1]} days`;
}

export function computeUrgency(input: {
  name: string;
  category: InventoryCategory;
  addedAt: string | Date;
  now?: Date;
}): UrgencyBand {
  const range = getCatalogFood(input.name)?.shelfLifeDays ?? categoryDefaults[input.category];
  const addedAt = input.addedAt instanceof Date ? input.addedAt : new Date(input.addedAt);
  const now = input.now ?? new Date();
  const ageDays = Math.max(0, (now.getTime() - addedAt.getTime()) / 86_400_000);
  const useSoonAt = Math.max(1, range[0] * 0.7);

  if (ageDays >= range[0]) return "urgent";
  if (ageDays >= useSoonAt) return "use_soon";
  return "safe";
}

export function urgencyFromExpiry(expiresAt: string, now: Date = new Date()): UrgencyBand {
  const expiry = new Date(`${expiresAt}T23:59:59`);
  const daysLeft = (expiry.getTime() - now.getTime()) / 86_400_000;
  if (daysLeft <= 2) return "urgent";
  if (daysLeft <= 5) return "use_soon";
  return "safe";
}

// Single source of truth for a lot's urgency. The stored `urgency` column is a
// snapshot taken at insert time (always "safe" for fresh items) and is never
// updated as the item ages, so it must NOT be trusted on read — always derive
// from the explicit expiry date or, failing that, the item's age + shelf life.
export function resolveUrgency(
  lot: Pick<InventoryLot, "name" | "category" | "expires_at" | "added_at">,
  now: Date = new Date(),
): UrgencyBand {
  return lot.expires_at
    ? urgencyFromExpiry(lot.expires_at, now)
    : computeUrgency({ name: lot.name, category: lot.category, addedAt: lot.added_at, now });
}

export function getNextPartialState(state: PartialState): PartialState {
  if (state === "full") return "some_used";
  if (state === "some_used") return "low";
  return "low";
}

export function getDepletionUpdate(lot: Pick<InventoryLot, "quantity" | "partial_state">, amount = 1) {
  if (lot.quantity > 1) {
    const nextQuantity = Math.max(0, lot.quantity - Math.max(1, amount));
    return { quantity: nextQuantity, partialState: lot.partial_state, shouldRemove: nextQuantity <= 0 };
  }

  // Last unit: walk the partial-state ladder (full → some_used → low), then remove.
  if (lot.partial_state === "low") {
    return { quantity: 0, partialState: lot.partial_state, shouldRemove: true };
  }

  return { quantity: lot.quantity, partialState: getNextPartialState(lot.partial_state), shouldRemove: false };
}

export function groupInventoryLots(
  lots: InventoryLot[],
  system: MeasurementSystem = "metric",
): InventoryGroup[] {
  const groups = new Map<string, InventoryGroup>();

  lots.forEach((lot) => {
    const urgency = resolveUrgency(lot);
    const key = `${lot.normalized_name}:${lot.category}:${urgency}`;
    const existing = groups.get(key);

    if (existing) {
      existing.quantity += Number(lot.quantity);
      if (lot.net_amount != null) {
        existing.netAmount = (existing.netAmount ?? 0) + lot.net_amount;
        existing.netUnit = lot.net_unit;
      }
      existing.lotCount += 1;
      existing.lots.push(lot);
      if (!existing.brandName && lot.brand_name) existing.brandName = lot.brand_name;
      existing.partialState = mergePartialState(existing.partialState, lot.partial_state);
      existing.partialLabel = formatPartialState(existing.partialState);
      existing.meta = formatGroupMeta(existing, system);
      return;
    }

    const group: InventoryGroup = {
      key,
      name: lot.name,
      normalizedName: lot.normalized_name,
      brandName: lot.brand_name,
      category: lot.category,
      urgency,
      urgencyLabel: formatUrgency(urgency),
      shelfLifeRange: lot.shelf_life_range ?? getShelfLifeRange(lot.name, lot.category),
      quantity: Number(lot.quantity),
      unit: lot.unit,
      netAmount: lot.net_amount,
      netUnit: lot.net_unit,
      partialState: lot.partial_state,
      partialLabel: formatPartialState(lot.partial_state),
      lotCount: 1,
      lots: [lot],
      meta: "",
    };

    group.meta = formatGroupMeta(group, system);
    groups.set(key, group);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const urgencyOrder = urgencyRank(b.urgency) - urgencyRank(a.urgency);
    if (urgencyOrder !== 0) return urgencyOrder;
    return a.name.localeCompare(b.name);
  });
}

export function isMetricAmountRunningLow(
  group: Pick<InventoryGroup, "normalizedName" | "quantity" | "netAmount" | "netUnit">,
) {
  if (group.netAmount == null || group.netUnit == null) return false;

  const catalogNet = getCatalogNet(group.normalizedName);
  if (!catalogNet || catalogNet.netUnit !== group.netUnit) return false;

  const fullAmount = catalogNet.netAmount * Math.max(1, group.quantity);
  return group.netAmount <= fullAmount * 0.25;
}

export function formatUrgency(urgency: UrgencyBand) {
  const key = urgency === "urgent" ? "urgent" : urgency === "use_soon" ? "useSoon" : "safe";
  return i18n.t(`fridge.meta.${key}`);
}

export function formatPartialState(state: PartialState) {
  const key = state === "some_used" ? "someUsed" : state === "low" ? "low" : "full";
  return i18n.t(`fridge.meta.${key}`);
}

export function toUiUrgency(urgency: UrgencyBand) {
  return urgency === "use_soon" ? "useSoon" : urgency;
}

export function toUiCategory(category: InventoryCategory) {
  return category.replace("_", "-");
}

function formatGroupMeta(
  group: Pick<InventoryGroup, "brandName" | "quantity" | "unit" | "lotCount" | "urgencyLabel" | "partialLabel" | "netAmount" | "netUnit">,
  system: MeasurementSystem = "metric",
) {
  const quantity = Number.isInteger(group.quantity) ? group.quantity : Number(group.quantity.toFixed(1));
  const amount =
    group.netAmount != null && group.netUnit
      ? formatAmount(group.netAmount, group.netUnit, system)
      : `${quantity} ${group.unit}`;
  const lotCopy = group.lotCount > 1 ? `, ${i18n.t("fridge.meta.lots", { count: group.lotCount })}` : "";
  const brandCopy = group.brandName ? `${group.brandName} · ` : "";
  return `${brandCopy}${amount}${lotCopy} · ${group.urgencyLabel} · ${group.partialLabel}`;
}

function mergePartialState(a: PartialState, b: PartialState): PartialState {
  if (a === "low" || b === "low") return "low";
  if (a === "some_used" || b === "some_used") return "some_used";
  return "full";
}

export function urgencyRank(urgency: UrgencyBand | null) {
  if (urgency === "urgent") return 3;
  if (urgency === "use_soon") return 2;
  return 1;
}
