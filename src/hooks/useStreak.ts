import { useCallback, useEffect, useState } from "react";
import { getCalendars } from "expo-localization";

import { StreakState, syncStreak } from "@/repositories/insightsRepository";

function emptyWeek(): StreakState["days"] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i),
    state: "none" as const,
  }));
}

/** The signed-in member's streak, freezes and daily-goal progress in this kitchen. */
export function useStreak(householdId: string | undefined) {
  const [state, setState] = useState<StreakState>(() => ({ streak: 0, freezes: 0, today: 0, days: emptyWeek() }));

  const load = useCallback(async () => {
    if (!householdId) return;
    // The device's day, so "today" matches the week strip the user sees.
    const timeZone = getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      setState(await syncStreak(householdId, timeZone));
    } catch {
      // Keep the last numbers; the next focus refresh retries.
    }
  }, [householdId]);

  useEffect(() => {
    // setState happens after the await — the rule can't see through the call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { ...state, refresh: load };
}
