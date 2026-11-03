import { useCallback, useEffect, useState } from "react";

import { getWinsRaw } from "@/repositories/insightsRepository";
import { groupWinsByDay, WinDay } from "@/services/insightsService";

const WINS_DAYS = 30;

/**
 * Wins, one entry per day of the last 30 that used something up or cooked:
 * yours, or the whole household's.
 */
export function useWins(householdId: string | undefined, userId: string | undefined, scope: "you" | "household" = "you") {
  const [wins, setWins] = useState<WinDay[]>([]);

  const load = useCallback(async () => {
    if (!householdId || !userId) return;
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WINS_DAYS - 1));
    try {
      setWins(groupWinsByDay(await getWinsRaw(householdId, since.toISOString(), scope === "you" ? userId : undefined)));
    } catch {
      // Keep the last list; the next focus refresh retries.
    }
  }, [householdId, scope, userId]);

  useEffect(() => {
    // setState happens after the await — the rule can't see through the call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { wins, refresh: load };
}
