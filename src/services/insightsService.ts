import { InsightsRawData, WinsRaw } from "@/repositories/insightsRepository";

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
  cookedRecipes: { recipeId: string; title: string; count: number }[];
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


export type WinDay = {
  /** Local midnight of the day. */
  date: Date;
  itemsUsed: number;
  /** Distinct dishes cooked that day. */
  cooked: string[];
  moneySaved: number;
};

/** The wins list: one entry per local day that used something up or cooked, newest first. */
export function groupWinsByDay(raw: WinsRaw): WinDay[] {
  const days = new Map<string, WinDay>();
  const day = (iso: string) => {
    const at = new Date(iso);
    const date = new Date(at.getFullYear(), at.getMonth(), at.getDate());
    const key = date.toDateString();
    let entry = days.get(key);
    if (!entry) {
      entry = { date, itemsUsed: 0, cooked: [], moneySaved: 0 };
      days.set(key, entry);
    }
    return entry;
  };
  for (const at of raw.used) day(at).itemsUsed += 1;
  for (const { at, title } of raw.cooked) {
    const entry = day(at);
    if (!entry.cooked.includes(title)) entry.cooked.push(title);
  }
  // Money alone doesn't make a day a win, but it rides along on one.
  for (const { at, value } of raw.saved) {
    const entry = days.get(new Date(new Date(at).setHours(0, 0, 0, 0)).toDateString());
    if (entry) entry.moneySaved += value;
  }
  return [...days.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Most items today's goal ever asks for, however much is going off. */
export const MAX_DAILY_GOAL = 3;

/**
 * Today's goal, set by the fridge rather than a constant: rescue what is
 * actually going off today, capped so a big clear-out stays achievable. With
 * nothing at risk the goal is a single item, which is also what keeps a streak.
 */
export function dailyGoal(atRiskCount: number): number {
  return Math.max(1, Math.min(atRiskCount, MAX_DAILY_GOAL));
}
