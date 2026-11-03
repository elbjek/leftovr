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

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Consecutive local days, ending today, on which something was used up or
 * cooked. A day with nothing yet today doesn't break the streak until it
 * ends: if today is empty, the count runs back from yesterday.
 */
export function usageStreak(usedAt: string[], now: Date = new Date()): number {
  const days = new Set(usedAt.map((iso) => dayKey(new Date(iso))));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** The last seven local days, oldest first (today last), each marked when something was used up or cooked. */
export function lastSevenDays(usedAt: string[], now: Date = new Date()): { date: Date; used: boolean }[] {
  const days = new Set(usedAt.map((iso) => dayKey(new Date(iso))));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
    return { date, used: days.has(dayKey(date)) };
  });
}
