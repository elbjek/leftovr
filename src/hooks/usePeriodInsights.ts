import { useCallback, useEffect, useState } from "react";

import { getFoodHistory, getInsightsData, getKitchenRaw } from "@/repositories/insightsRepository";
import { computeInsightsSummary, InsightsSummary } from "@/services/insightsService";
import {
  buildKitchenInsights,
  foodsGoingOff,
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
};

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
