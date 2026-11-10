import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import type { ReceiptDuplicate } from "@/repositories";
import type { ReceiptConfirmItem } from "@/services";

// A scan the user has not confirmed yet. The AI call is already paid for (and
// a free user's one scan is spent), so the review list must outlive the app
// being closed. Device-only: the server never stores scan lines.
// ponytail: one draft per device; a new scan replaces it. Store server-side
// if another household member should be able to finish it.
export type ScanDraft = {
  scanId: string;
  kind: "receipt" | "pantry";
  householdId: string;
  items: ReceiptConfirmItem[];
  // Set only when the user chose "Add anyway" on the duplicate screen.
  duplicate: ReceiptDuplicate | null;
  savedAt: number;
};

const SCAN_DRAFT_KEY = "leftovr.scanDraft";
// Old enough that the model's expiry guesses no longer hold.
const SCAN_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function saveScanDraft(draft: Omit<ScanDraft, "savedAt">): Promise<void> {
  await AsyncStorage.setItem(SCAN_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
}

export async function clearScanDraft(): Promise<void> {
  await AsyncStorage.removeItem(SCAN_DRAFT_KEY);
}

export async function loadScanDraft(householdId: string | undefined): Promise<ScanDraft | null> {
  const raw = await AsyncStorage.getItem(SCAN_DRAFT_KEY);
  if (!raw) return null;
  let draft: ScanDraft;
  try {
    draft = JSON.parse(raw);
  } catch {
    await clearScanDraft();
    return null;
  }
  if (!draft.items?.length || Date.now() - draft.savedAt > SCAN_DRAFT_MAX_AGE_MS) {
    await clearScanDraft();
    return null;
  }
  // Another household's draft stays put in case the user switches back.
  return draft.householdId === householdId ? draft : null;
}

/** The unfinished scan for this household, re-read whenever the screen gains focus. */
export function useScanDraft(householdId: string | undefined) {
  const [draft, setDraft] = useState<ScanDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void loadScanDraft(householdId).then((next) => {
        if (live) setDraft(next);
      });
      return () => {
        live = false;
      };
    }, [householdId]),
  );

  const discard = useCallback(() => {
    setDraft(null);
    void clearScanDraft();
  }, []);

  return { draft, discard };
}
