import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export const HAS_PICKED_LANGUAGE_KEY = "chomp.onboarding.v2.hasPickedLanguage";
export const HAS_SEEN_HOOK_KEY = "chomp.onboarding.v2.hasSeenHook";

export function useFirstRunOnboardingGate() {
  const [loading, setLoading] = useState(true);
  const [hasPickedLanguage, setHasPickedLanguage] = useState(false);
  const [hasSeenHook, setHasSeenHook] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(HAS_PICKED_LANGUAGE_KEY),
      AsyncStorage.getItem(HAS_SEEN_HOOK_KEY),
    ])
      .then(([languageValue, hookValue]) => {
        setHasPickedLanguage(languageValue === "true");
        setHasSeenHook(hookValue === "true");
      })
      .finally(() => setLoading(false));
  }, []);

  return { loading, hasPickedLanguage, hasSeenHook };
}
