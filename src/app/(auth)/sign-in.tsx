import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AuthLanding, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { useFirstRunOnboardingGate } from "@/features/onboardingGate";
import { colors, spacing } from "@/theme";

export default function SignInRoute() {
  const { t } = useTranslation();
  const { error, signInWithGoogle, signInWithApple } = useAuth();
  const {
    loading: onboardingGateLoading,
    hasPickedLanguage,
    hasSeenHook,
  } = useFirstRunOnboardingGate();
  const [formError, setFormError] = useState<string | null>(null);

  async function handleGoogle() {
    setFormError(null);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch {
      setFormError(t("auth.genericError"));
    }
  }

  async function handleApple() {
    setFormError(null);
    try {
      await signInWithApple();
      router.replace("/");
    } catch {
      setFormError(t("auth.genericError"));
    }
  }

  if (onboardingGateLoading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="small" muted>
            {t("common.loading")}
          </Text>
        </View>
      </Screen>
    );
  }

  if (!hasPickedLanguage) {
    return <Redirect href="/(onboarding)/language" />;
  }

  if (!hasSeenHook) {
    return <Redirect href="/(onboarding)/hook" />;
  }

  return (
    <Screen padded={false}>
      <AuthLanding
        body={t("auth.designBody")}
        appleLabel={t("auth.apple")}
        googleLabel={t("auth.google")}
        emailLabel={t("auth.emailContinue")}
        termsCopy={t("auth.termsCopy")}
        termsLabel={t("auth.terms")}
        privacyLabel={t("auth.privacy")}
        onApple={handleApple}
        onGoogle={handleGoogle}
        onEmail={() => router.push({ pathname: "/(auth)/otp", params: { mode: "sign-in" } })}
      />
      {formError || error ? (
        <View style={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.md }}>
          <Text variant="small" color={colors.red} center>
            {formError ?? error}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
