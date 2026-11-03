import { useCallback, useEffect, useState } from "react";

import { getInsightsData } from "@/repositories/insightsRepository";
import { computeInsightsSummary, InsightsSummary, recapWindow } from "@/services/insightsService";

/**
 * The Insights monthly recap: your figures for the recap month and, in a
 * shared kitchen, what the whole household saved. Not premium-gated.
 */
export function useMonthlyRecap(householdId: string | undefined, userId: string | undefined, includeHousehold: boolean) {
  const [period, setPeriod] = useState(() => recapWindow());
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [householdSaved, setHouseholdSaved] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!householdId || !userId) return;
    const next = recapWindow();
    const since = next.start.toISOString();
    const until = next.until?.toISOString();
    try {
      const [mine, household] = await Promise.all([
        getInsightsData(householdId, since, userId, until),
        includeHousehold ? getInsightsData(householdId, since, undefined, until) : null,
      ]);
      setPeriod(next);
      setSummary(computeInsightsSummary(mine));
      setHouseholdSaved(household ? household.moneySaved : null);
    } catch {
      // Keep the last recap; the next focus refresh retries.
    }
  }, [householdId, includeHousehold, userId]);

  useEffect(() => {
    // setState happens after the await — the rule can't see through the call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { period, summary, householdSaved, refresh: load };
}
