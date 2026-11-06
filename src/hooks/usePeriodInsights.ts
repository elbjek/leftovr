import { useCallback, useEffect, useState } from "react";

import { getFoodHistory, getInsightsData, getKitchenRaw } from "@/repositories/insightsRepository";
import { computeInsightsSummary, InsightsSummary } from "@/services/insightsService";
import {
  buildKitchenInsights,
  foodsGoingOff,
  FoodHistoryRow,
  GoingOffFood,
  KitchenInsights,
  Period,
  periodWindow,
  PeriodWindow,
} from "@/services/kitchenInsights";

type State = {
  window: PeriodWindow;
  summary: InsightsSummary;
  prevSummary: InsightsSummary;
  kitchen: KitchenInsights;
  prevKitchen: KitchenInsights;
  goingOff: GoingOffFood[];
  /** Foods used up in the window, newest first, one tile per food. */
  usedFoods: { name: string; category: string }[];
};

/**
 * The distinct foods used up inside the window, newest first. Taken from the
 * history already fetched, so no extra query; it only reaches back 120 days,
 * so a Year can show fewer foods than it counted.
 */
function usedFoodsIn(history: FoodHistoryRow[], span: PeriodWindow) {
  const seen = new Set<string>();
  const foods: { name: string; category: string }[] = [];
  for (const row of history) {
    const at = new Date(row.at).getTime();
    if (row.outcome !== "used" || at < span.start.getTime() || at >= span.until.getTime()) continue;
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    foods.push({ name: row.name, category: row.category });
  }
  return foods;
}

/**
 * Everything Insights shows for one period and scope: money and cooks
 * (`getInsightsData`), used vs tossed and food groups (`getKitchenRaw`), each
 * for the period and its comparison window, plus foods that keep going off.
 * `enabled` false (the Premium week on a free account) loads nothing.
 */
export function usePeriodInsights(
  householdId: string | undefined,
  userId: string | undefined,
  period: Period,
  scope: "you" | "household",
  enabled = true,
) {
  const [state, setState] = useState<State | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${period}:${scope}`;

  const load = useCallback(async () => {
    if (!enabled || !householdId || !userId) return;
    const span = periodWindow(period);
    const who = scope === "you" ? userId : undefined;
    const iso = (date: Date) => date.toISOString();
    try {
      const [summary, prevSummary, kitchen, prevKitchen, history] = await Promise.all([
        getInsightsData(householdId, iso(span.start), who, iso(span.until)),
        getInsightsData(householdId, iso(span.prevStart), who, iso(span.prevUntil)),
        getKitchenRaw(householdId, iso(span.start), iso(span.until), who),
        getKitchenRaw(householdId, iso(span.prevStart), iso(span.prevUntil), who),
        getFoodHistory(householdId, who),
      ]);
      setState({
        window: span,
        summary: computeInsightsSummary(summary),
        prevSummary: computeInsightsSummary(prevSummary),
        kitchen: buildKitchenInsights(kitchen, span.buckets),
        prevKitchen: buildKitchenInsights(prevKitchen, span.buckets),
        goingOff: foodsGoingOff(history),
        usedFoods: usedFoodsIn(history, span),
      });
      setLoadedKey(`${period}:${scope}`);
    } catch {
      // Keep the last figures; the next focus refresh retries.
    }
  }, [enabled, householdId, period, scope, userId]);

  useEffect(() => {
    // setState happens after the awaits — the rule can't see through the call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Figures from another period or scope are never shown while the new ones load.
  return { data: loadedKey === key ? state : null, refresh: load };
}
