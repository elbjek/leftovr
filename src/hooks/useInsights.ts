import { useCallback, useEffect, useState } from "react";

import { getInsightsData } from "@/repositories/insightsRepository";
import { computeInsightsSummary, InsightsSummary } from "@/services/insightsService";

function startOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function startOfPreviousWeek(): string {
  const monday = new Date(startOfCurrentWeek());
  monday.setDate(monday.getDate() - 7);
  return monday.toISOString();
}

function startOfCurrentMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function useInsights(
  householdId: string | undefined,
  options: { userId?: string; includeHousehold?: boolean } = {},
) {
  const { userId, includeHousehold } = options;
  const [weeklySummary, setWeeklySummary] = useState<InsightsSummary | null>(null);
  const [lastWeekSummary, setLastWeekSummary] = useState<InsightsSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<InsightsSummary | null>(null);
  const [householdWeeklySummary, setHouseholdWeeklySummary] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!householdId) return;

    try {
      const [weeklyRaw, lastWeekRaw, monthlyRaw, householdWeeklyRaw] = await Promise.all([
        getInsightsData(householdId, startOfCurrentWeek(), userId),
        // Real previous-week window for the trend copy.
        getInsightsData(householdId, startOfPreviousWeek(), userId, startOfCurrentWeek()),
        getInsightsData(householdId, startOfCurrentMonth(), userId),
        includeHousehold ? getInsightsData(householdId, startOfCurrentWeek()) : null,
      ]);

      setWeeklySummary(computeInsightsSummary(weeklyRaw));
      setLastWeekSummary(computeInsightsSummary(lastWeekRaw));
      setMonthlySummary(computeInsightsSummary(monthlyRaw));
      setHouseholdWeeklySummary(
        householdWeeklyRaw ? computeInsightsSummary(householdWeeklyRaw) : null,
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [householdId, includeHousehold, userId]);

  useEffect(() => {
    // All setState in load() happens after the first await (async, not sync) —
    // the rule can't see through the call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return {
    weeklySummary,
    lastWeekSummary,
    monthlySummary,
    householdWeeklySummary,
    loading,
    error,
    // Call on tab focus so cooking on another tab shows up without an app restart.
    // Refetches keep showing the previous numbers (no spinner flash) until data lands.
    refresh: load,
  };
}
