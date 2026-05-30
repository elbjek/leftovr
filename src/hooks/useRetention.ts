import { useEffect, useState } from "react";

import { getSuccessfulReceiptScanCount } from "@/repositories/notificationRepository";
import { InventoryGroup } from "@/services/inventoryRules";
import { DailySuggestion, previewDailySuggestion } from "@/services/notificationService";

export type RetentionState = {
  day1Suggestion: DailySuggestion | null;
  showDay5Nudge: boolean;
  day7Recap: { estimatedItemsSaved: number; estimatedMoneySaved: number } | null;
};

export function useRetention(
  prototypeDay: number,
  householdId: string | undefined,
  groups: InventoryGroup[],
  primaryGoal: string | null,
) {
  const [state, setState] = useState<RetentionState>({
    day1Suggestion: null,
    showDay5Nudge: false,
    day7Recap: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function compute() {
      let day1Suggestion: DailySuggestion | null = null;
      let showDay5Nudge = false;
      let day7Recap: RetentionState["day7Recap"] = null;

      if (prototypeDay >= 1) {
        day1Suggestion = previewDailySuggestion(groups, primaryGoal);
      }

      if (prototypeDay >= 5 && householdId) {
        try {
          const scanCount = await getSuccessfulReceiptScanCount(householdId);
          showDay5Nudge = scanCount < 2;
        } catch {
          // If query fails, don't show nudge
        }
      }

      if (prototypeDay >= 7) {
        const totalItems = groups.reduce((sum, g) => sum + g.lots.length, 0);
        const estimatedSaved = Math.max(1, Math.round(totalItems * 0.4));
        day7Recap = {
          estimatedItemsSaved: estimatedSaved,
          estimatedMoneySaved: estimatedSaved * 1.5,
        };
      }

      if (!cancelled) {
        setState({ day1Suggestion, showDay5Nudge, day7Recap });
      }
    }

    compute();
    return () => { cancelled = true; };
  }, [prototypeDay, householdId, groups, primaryGoal]);

  return state;
}
