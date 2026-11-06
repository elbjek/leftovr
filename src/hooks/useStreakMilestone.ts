import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Day counts worth stopping for. Every seventh day also banks a freeze. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

const key = (householdId: string) => `streak-milestone:${householdId}`;

/** The biggest milestone this streak has reached, 0 below the first one. */
export function reachedMilestone(streak: number): number {
  return STREAK_MILESTONES.filter((m) => m <= streak).pop() ?? 0;
}

/**
 * The milestone still owed, or null. Any mismatch with the record counts: a
 * record above the current streak means the run broke, and the rebuilt run
 * earns its milestones again.
 */
export function pendingMilestone(streak: number, celebrated: number): number | null {
  const hit = reachedMilestone(streak);
  return hit > 0 && hit !== celebrated ? hit : null;
}

/**
 * Fires once per milestone per kitchen. The highest celebrated day count is
 * stored on the device, so a reset streak earns its milestones again and a
 * reinstall at worst repeats one.
 */
export function useStreakMilestone(householdId: string | undefined, streak: number) {
  const [celebrated, setCelebrated] = useState<number | null>(null);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    AsyncStorage.getItem(key(householdId))
      .then((stored) => {
        if (cancelled) return;
        setCelebrated(Number(stored) || 0);
      })
      .catch(() => {
        // Without the record we'd re-celebrate every open. Leaving it unread
        // keeps the hook quiet until the next focus retries.
      });
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const hit = reachedMilestone(streak);

  const dismiss = useCallback(() => {
    if (!householdId) return;
    setCelebrated(hit);
    AsyncStorage.setItem(key(householdId), String(hit)).catch(() => {});
  }, [householdId, hit]);

  return { milestone: celebrated == null ? null : pendingMilestone(streak, celebrated), dismiss };
}
