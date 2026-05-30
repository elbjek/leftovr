import { InsightsRawData } from "@/repositories/insightsRepository";

export type InsightsSummary = {
  receiptScans: number;
  itemsAdded: number;
  cookedEvents: number;
  removedItems: number;
  estimatedItemsSaved: number;
  estimatedMoneySaved: number;
  mostUsedCategory: string | null;
  isSparse: boolean;
};

const ESTIMATED_VALUE_PER_ITEM = 1.5;

export function computeInsightsSummary(raw: InsightsRawData): InsightsSummary {
  const estimatedItemsSaved = Math.max(0, raw.itemsAdded - raw.removedItems);
  const estimatedMoneySaved = estimatedItemsSaved * ESTIMATED_VALUE_PER_ITEM;

  let mostUsedCategory: string | null = null;
  let maxCount = 0;
  for (const [category, count] of Object.entries(raw.categoryBreakdown)) {
    if (count > maxCount) {
      maxCount = count;
      mostUsedCategory = category;
    }
  }

  const isSparse = raw.itemsAdded < 3 && raw.cookedEvents === 0;

  return {
    receiptScans: raw.receiptScans,
    itemsAdded: raw.itemsAdded,
    cookedEvents: raw.cookedEvents,
    removedItems: raw.removedItems,
    estimatedItemsSaved,
    estimatedMoneySaved,
    mostUsedCategory,
    isSparse,
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
