import { i18n } from "@/i18n";

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
};

export type InventoryLot = {
  id: string;
  name: string;
  normalized_name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  display_quantity: string | null;
  partial_state: PartialState;
  urgency: UrgencyBand | null;
  shelf_life_range: string | null;
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
  category: InventoryCategory;
  urgency: UrgencyBand;
  urgencyLabel: string;
  shelfLifeRange: string;
  quantity: number;
  unit: string;
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
  { name: "Greek yogurt", category: "dairy_eggs", shelfLifeDays: [5, 8], unit: "tub" },
  { name: "Milk", category: "dairy_eggs", shelfLifeDays: [4, 7], unit: "carton" },
  { name: "Chicken breast", category: "meat", shelfLifeDays: [1, 2], unit: "pack" },
  { name: "Salmon", category: "fish", shelfLifeDays: [1, 2], unit: "fillet" },
  { name: "Spinach", category: "vegetables", shelfLifeDays: [2, 4], unit: "bag" },
  { name: "Tomatoes", category: "vegetables", shelfLifeDays: [4, 7], unit: "item" },
  { name: "Bananas", category: "fruit", shelfLifeDays: [3, 5], unit: "item" },
  { name: "Sourdough", category: "bakery", shelfLifeDays: [2, 4], unit: "loaf" },
  { name: "Rice", category: "pantry", shelfLifeDays: [60, 180], unit: "bag" },
  { name: "Frozen peas", category: "frozen", shelfLifeDays: [60, 120], unit: "bag" },
  { name: "Orange juice", category: "drinks", shelfLifeDays: [5, 10], unit: "bottle" },
  { name: "Hummus", category: "snacks", shelfLifeDays: [4, 7], unit: "tub" },
];

const catalogByName = new Map(demoFoodCatalog.map((item) => [normalizeFoodName(item.name), item]));

export function normalizeFoodName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getCatalogFood(name: string) {
  return catalogByName.get(normalizeFoodName(name));
}

export function inferCategory(name: string): InventoryCategory {
  return getCatalogFood(name)?.category ?? "other";
}

export function getShelfLifeRange(name: string, category: InventoryCategory) {
  const range = getCatalogFood(name)?.shelfLifeDays ?? categoryDefaults[category];
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

export function getNextPartialState(state: PartialState) {
  if (state === "full") return "some_used";
  if (state === "some_used") return "low";
  return "low";
}

export function getDepletionUpdate(lot: Pick<InventoryLot, "quantity" | "partial_state">, amount = 1) {
  if (lot.quantity > 1) {
    const nextQuantity = Math.max(0, lot.quantity - Math.max(1, amount));
    return { quantity: nextQuantity, partialState: lot.partial_state, shouldRemove: nextQuantity <= 0 };
  }

  if (lot.partial_state === "full") {
    return { quantity: lot.quantity, partialState: "some_used" as PartialState, shouldRemove: false };
  }

  if (lot.partial_state === "some_used") {
    return { quantity: lot.quantity, partialState: "low" as PartialState, shouldRemove: false };
  }

  return { quantity: 0, partialState: lot.partial_state, shouldRemove: true };
}

export function groupInventoryLots(lots: InventoryLot[]): InventoryGroup[] {
  const groups = new Map<string, InventoryGroup>();

  lots.forEach((lot) => {
    const urgency = lot.urgency ?? computeUrgency({ name: lot.name, category: lot.category, addedAt: lot.added_at });
    const key = `${lot.normalized_name}:${lot.category}:${urgency}`;
    const existing = groups.get(key);

    if (existing) {
      existing.quantity += Number(lot.quantity);
      existing.lotCount += 1;
      existing.lots.push(lot);
      existing.partialState = mergePartialState(existing.partialState, lot.partial_state);
      existing.partialLabel = formatPartialState(existing.partialState);
      existing.meta = formatGroupMeta(existing);
      return;
    }

    const group: InventoryGroup = {
      key,
      name: lot.name,
      normalizedName: lot.normalized_name,
      category: lot.category,
      urgency,
      urgencyLabel: formatUrgency(urgency),
      shelfLifeRange: lot.shelf_life_range ?? getShelfLifeRange(lot.name, lot.category),
      quantity: Number(lot.quantity),
      unit: lot.unit,
      partialState: lot.partial_state,
      partialLabel: formatPartialState(lot.partial_state),
      lotCount: 1,
      lots: [lot],
      meta: "",
    };

    group.meta = formatGroupMeta(group);
    groups.set(key, group);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const urgencyOrder = urgencyRank(b.urgency) - urgencyRank(a.urgency);
    if (urgencyOrder !== 0) return urgencyOrder;
    return a.name.localeCompare(b.name);
  });
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

function formatGroupMeta(group: Pick<InventoryGroup, "quantity" | "unit" | "lotCount" | "urgencyLabel" | "partialLabel">) {
  const quantity = Number.isInteger(group.quantity) ? group.quantity : Number(group.quantity.toFixed(1));
  const lotCopy = group.lotCount > 1 ? `, ${i18n.t("fridge.meta.lots", { count: group.lotCount })}` : "";
  return `${quantity} ${group.unit}${lotCopy} · ${group.urgencyLabel} · ${group.partialLabel}`;
}

function mergePartialState(a: PartialState, b: PartialState): PartialState {
  if (a === "low" || b === "low") return "low";
  if (a === "some_used" || b === "some_used") return "some_used";
  return "full";
}

function urgencyRank(urgency: UrgencyBand) {
  if (urgency === "urgent") return 3;
  if (urgency === "use_soon") return 2;
  return 1;
}
