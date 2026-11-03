import { useCallback, useState } from "react";

import { DayActivity, getDayActivity } from "@/repositories/insightsRepository";

/** The day sheet (home week strip, Insights wins): the tapped day, and its activity once loaded. */
export function useDaySheet(householdId: string | undefined, userId: string | undefined) {
  const [openDay, setOpenDay] = useState<{ date: Date; activity: DayActivity | null } | null>(null);

  const showDay = useCallback(
    async (date: Date) => {
      if (!householdId) return;
      setOpenDay({ date, activity: null });
      const until = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      let activity: DayActivity = { cooked: [], used: [], moneySaved: 0 };
      try {
        activity = await getDayActivity(householdId, date.toISOString(), until.toISOString(), userId);
      } catch {
        // A failed load reads as an empty day; tapping the day again retries.
      }
      // Ignore a late answer for a day the user already moved on from.
      setOpenDay((current) => (current?.date === date ? { date, activity } : current));
    },
    [householdId, userId],
  );

  const closeDay = useCallback(() => setOpenDay(null), []);

  return { openDay, showDay, closeDay };
}
