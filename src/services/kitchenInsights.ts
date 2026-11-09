import type { InventoryCategory } from "./inventoryRules";

// Rule-based Insights observations (no AI): what got used vs tossed, which
// food groups you finish, and which foods keep going off. Pure — the
// repository fetches, this decides.

export type Period = "week" | "month" | "year";
export type Outcome = "used" | "tossed";

export type PeriodWindow = {
  start: Date;
  /** End of the window; for a period still running, now. */
  until: Date;
  /** The comparison window, cut to the same length so "vs last week" is fair. */
  prevStart: Date;
  prevUntil: Date;
  /** Calendar cells: days of the week, days of the month, or months of the year. */
  buckets: { start: Date; end: Date }[];
};

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * The moment a period is seen from: now for the running one (offset 0), else
 * the last millisecond of the week / month / year `offset` periods back
 * (-1 = the previous one), so `periodWindow` returns that whole period.
 */
export function periodAnchor(period: Period, offset: number, now: Date = new Date()): Date {
  if (offset >= 0) return now;
  if (period === "week") {
    const weekday = now.getDay();
    const monday = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), weekday === 0 ? -6 : 1 - weekday);
    return new Date(addDays(monday, 7 * (offset + 1)).getTime() - 1);
  }
  if (period === "year") return new Date(new Date(now.getFullYear() + offset + 1, 0, 1).getTime() - 1);
  return new Date(new Date(now.getFullYear(), now.getMonth() + offset + 1, 1).getTime() - 1);
}

export function periodWindow(period: Period, now: Date = new Date()): PeriodWindow {
  if (period === "week") {
    const weekday = now.getDay();
    const start = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), weekday === 0 ? -6 : 1 - weekday);
    const prevStart = addDays(start, -7);
    return {
      start,
      until: now,
      prevStart,
      prevUntil: new Date(prevStart.getTime() + (now.getTime() - start.getTime())),
      buckets: Array.from({ length: 7 }, (_, i) => ({ start: addDays(start, i), end: addDays(start, i + 1) })),
    };
  }
  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const prevStart = new Date(now.getFullYear() - 1, 0, 1);
    return {
      start,
      until: now,
      prevStart,
      // Same stretch of last year, never past its end.
      prevUntil: new Date(Math.min(prevStart.getTime() + (now.getTime() - start.getTime()), start.getTime())),
      buckets: Array.from({ length: 12 }, (_, i) => ({ start: new Date(now.getFullYear(), i, 1), end: new Date(now.getFullYear(), i + 1, 1) })),
    };
  }
  // This month so far, against the same days of last month (never more than all of it).
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const until = now;
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const prevUntil = new Date(Math.min(prevStart.getTime() + (until.getTime() - start.getTime()), start.getTime()));
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const buckets: { start: Date; end: Date }[] = [];
  for (let day = start; day < monthEnd; day = addDays(day, 1)) buckets.push({ start: day, end: addDays(day, 1) });
  return { start, until, prevStart, prevUntil, buckets };
}

export type KitchenRaw = {
  /** Items added in the window and how each ended; null while still in the kitchen. */
  added: { category: InventoryCategory; outcome: Outcome | null }[];
  /** When something was used up (cooked with or marked used) in the window. */
  usedAt: string[];
  /** When something was tossed in the window. */
  tossedAt: string[];
};

export type FoodGroup = { category: InventoryCategory; used: number; tossed: number };

export type KitchenInsights = {
  used: number;
  tossed: number;
  chart: { used: number; tossed: number }[];
  /** Food groups with at least 2 finished items, most finished first, up to 4. */
  groups: FoodGroup[];
  /** The group you finish best (≥3 finished, ≥80% used), if any. */
  strongest: FoodGroup | null;
  /** The group losing the most (a toss, under 75% used), if any. */
  weakest: FoodGroup | null;
};

const rate = (group: FoodGroup) => group.used / (group.used + group.tossed);

export function buildKitchenInsights(raw: KitchenRaw, buckets: PeriodWindow["buckets"]): KitchenInsights {
  const inBucket = (iso: string, bucket: { start: Date; end: Date }) => {
    const at = new Date(iso).getTime();
    return at >= bucket.start.getTime() && at < bucket.end.getTime();
  };
  const chart = buckets.map((bucket) => ({
    used: raw.usedAt.filter((iso) => inBucket(iso, bucket)).length,
    tossed: raw.tossedAt.filter((iso) => inBucket(iso, bucket)).length,
  }));

  const byCategory = new Map<InventoryCategory, FoodGroup>();
  for (const item of raw.added) {
    if (!item.outcome) continue;
    const group = byCategory.get(item.category) ?? { category: item.category, used: 0, tossed: 0 };
    group[item.outcome] += 1;
    byCategory.set(item.category, group);
  }
  const groups = [...byCategory.values()]
    .filter((group) => group.used + group.tossed >= 2)
    .sort((a, b) => b.used + b.tossed - (a.used + a.tossed))
    .slice(0, 4);

  const strongest =
    [...groups].filter((g) => g.used + g.tossed >= 3 && rate(g) >= 0.8).sort((a, b) => rate(b) - rate(a) || b.used - a.used)[0] ?? null;
  const weakest =
    [...groups].filter((g) => g.tossed > 0 && rate(g) < 0.75).sort((a, b) => rate(a) - rate(b) || b.tossed - a.tossed)[0] ?? null;

  return { used: raw.usedAt.length, tossed: raw.tossedAt.length, chart, groups, strongest, weakest };
}

export type FoodHistoryRow = { name: string; category: InventoryCategory; outcome: Outcome; at: string };
export type GoingOffFood = { name: string; category: InventoryCategory; outcomes: Outcome[]; tossed: number };

/**
 * Foods that keep going off: of each food's last 5 finished, at least 2
 * tossed. Up to 3, most tossed first; outcomes run oldest → newest.
 */
export function foodsGoingOff(history: FoodHistoryRow[]): GoingOffFood[] {
  const byName = new Map<string, FoodHistoryRow[]>();
  for (const row of history) byName.set(row.name, [...(byName.get(row.name) ?? []), row]);
  const foods: GoingOffFood[] = [];
  for (const [name, rows] of byName) {
    const last = [...rows].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5).reverse();
    const tossed = last.filter((row) => row.outcome === "tossed").length;
    if (tossed >= 2) foods.push({ name, category: last[last.length - 1].category, outcomes: last.map((row) => row.outcome), tossed });
  }
  return foods.sort((a, b) => b.tossed - a.tossed || a.name.localeCompare(b.name)).slice(0, 3);
}

