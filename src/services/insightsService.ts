import { InsightsRawData } from "@/repositories/insightsRepository";

export type InsightsSummary = {
  receiptScans: number;
  itemsAdded: number;
  cookedEvents: number;
  removedItems: number;
  itemsSaved: number;
  estimatedItemsSaved: number;
  estimatedMoneySaved: number;
  mostUsedCategory: string | null;
  isSparse: boolean;
  cookedRecipes: { title: string; count: number }[];
};

const ESTIMATED_VALUE_PER_ITEM = 1.5;

export function computeInsightsSummary(raw: InsightsRawData): InsightsSummary {
  // "Saved" means consumed — cooked or fully used up — not merely added to the
  // fridge. The money figure stays an estimate (flat value per item).
  const estimatedItemsSaved = raw.itemsUsed;
  const estimatedMoneySaved = estimatedItemsSaved * ESTIMATED_VALUE_PER_ITEM;

  let mostUsedCategory: string | null = null;
  let maxCount = 0;
  for (const [category, count] of Object.entries(raw.categoryBreakdown)) {
    if (count > maxCount) {
      maxCount = count;
      mostUsedCategory = category;
    }
  }

  const isSparse = raw.itemsUsed === 0 && raw.cookedEvents === 0;

  return {
    receiptScans: raw.receiptScans,
    itemsAdded: raw.itemsAdded,
    cookedEvents: raw.cookedEvents,
    removedItems: raw.removedItems,
    itemsSaved: raw.itemsUsed,
    estimatedItemsSaved,
    estimatedMoneySaved,
    mostUsedCategory,
    isSparse,
    cookedRecipes: raw.cookedRecipes,
  };
}

export function formatCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    dairy_eggs: "Dairy & eggs",
    meat: "Meat",
    fish: "Fish",
    vegetables: "Vegetables",
    fruit: "Fruit",
    bakery: "Bakery",
    pantry: "Pantry",
    frozen: "Frozen",
    drinks: "Drinks",
    snacks: "Snacks",
    other: "Other",
  };
  return labels[category] ?? category;
}
