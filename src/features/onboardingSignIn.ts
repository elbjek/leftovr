import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { getCurrentProfile } from "@/repositories";

import { useAuth } from "./auth";
import { HAS_SEEN_HOOK_KEY } from "./onboardingGate";

// Sign-in from the first-run flow (the tour's last slide, the invite-code
// screen). `before` runs first, e.g. to stash an invite code for onboarding.
export function useOnboardingSignIn() {
  const { t } = useTranslation();
  const { error, signInWithApple, signInWithGoogle } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  async function withProvider(provider: () => Promise<void>, before?: () => Promise<void>) {
    setFormError(null);
    await AsyncStorage.setItem(HAS_SEEN_HOOK_KEY, "true");
    await before?.();
    try {
      await provider();
      // Not "/": inside the (onboarding) group it resolves to (onboarding)/index,
      // which would re-ask a returning user the profile questions.
      const profile = await getCurrentProfile();
      router.replace(profile.onboarding_completed_at ? "/(tabs)/recipes" : "/(onboarding)");
    } catch {
      setFormError(t("auth.genericError"));
    }
  }

  async function withEmail(before?: () => Promise<void>) {
    await AsyncStorage.setItem(HAS_SEEN_HOOK_KEY, "true");
    await before?.();
    router.push({ pathname: "/(auth)/otp", params: { mode: "sign-up" } });
  }

  return {
    error: formError ?? error,
    apple: (before?: () => Promise<void>) => withProvider(signInWithApple, before),
    google: (before?: () => Promise<void>) => withProvider(signInWithGoogle, before),
    email: withEmail,
  };
}
