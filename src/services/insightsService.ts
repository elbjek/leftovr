import { InsightsRawData } from "@/repositories/insightsRepository";

export type InsightsSummary = {
  receiptScans: number;
  itemsAdded: number;
  cookedEvents: number;
  removedItems: number;
  itemsSaved: number;
  estimatedItemsSaved: number;
  moneySpent: number;
  moneySaved: number;
  moneyWasted: number;
  mostUsedCategory: string | null;
  isSparse: boolean;
  cookedRecipes: { title: string; count: number }[];
  topUsedFood: { name: string; count: number } | null;
};

export function computeInsightsSummary(raw: InsightsRawData): InsightsSummary {
  // "Saved" means consumed — cooked or fully used up — not merely added to the
  // fridge. Money figures are real, summed from value_events.
  const estimatedItemsSaved = raw.itemsUsed;

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
    moneySpent: raw.moneySpent,
    moneySaved: raw.moneySaved,
    moneyWasted: raw.moneyWasted,
    mostUsedCategory,
    isSparse,
    cookedRecipes: raw.cookedRecipes,
    topUsedFood: raw.topUsedFood,
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

/**
 * The month the Insights recap covers. The first 3 days of a month still show
 * the month that just ended (complete); after that, this month so far.
 */
export function recapWindow(now: Date = new Date()): { start: Date; until: Date | null; complete: boolean } {
  const complete = now.getDate() <= 3;
  const start = new Date(now.getFullYear(), now.getMonth() - (complete ? 1 : 0), 1);
  return { start, until: complete ? new Date(now.getFullYear(), now.getMonth(), 1) : null, complete };
}

/** Items to use up per day for the home's daily goal; 1 already keeps the streak. */
export const DAILY_GOAL = 3;
