import { useEffect, useState } from "react";

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
  const [monthlySummary, setMonthlySummary] = useState<InsightsSummary | null>(null);
  const [householdWeeklySummary, setHouseholdWeeklySummary] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [weeklyRaw, monthlyRaw, householdWeeklyRaw] = await Promise.all([
          getInsightsData(householdId!, startOfCurrentWeek(), userId),
          getInsightsData(householdId!, startOfCurrentMonth(), userId),
          includeHousehold ? getInsightsData(householdId!, startOfCurrentWeek()) : null,
        ]);

        if (!cancelled) {
          setWeeklySummary(computeInsightsSummary(weeklyRaw));
          setMonthlySummary(computeInsightsSummary(monthlyRaw));
          setHouseholdWeeklySummary(
            householdWeeklyRaw ? computeInsightsSummary(householdWeeklyRaw) : null,
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load insights");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [householdId, includeHousehold, userId]);

  return { weeklySummary, monthlySummary, householdWeeklySummary, loading, error };
}
