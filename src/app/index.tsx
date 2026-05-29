import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { useFirstRunOnboardingGate } from "@/features/onboardingGate";
import { colors, spacing } from "@/theme";

export default function IndexRoute() {
  const { t } = useTranslation();
  const { configured, loading, session, profile, activeHousehold, error, refresh } = useAuth();
  const { loading: onboardingGateLoading, hasPickedLanguage, hasSeenHook } =
    useFirstRunOnboardingGate();

  if (loading || onboardingGateLoading) {
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

  if (!configured) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
          <Text variant="display">{t("auth.configTitle")}</Text>
          <Text variant="body" muted>
            {t("auth.configBody")}
          </Text>
          {error ? (
            <Text variant="small" color={colors.red}>
              {error}
            </Text>
          ) : null}
          <Button title={t("common.continue")} onPress={refresh} />
        </View>
      </Screen>
    );
  }

  if (!session) {
    if (!hasPickedLanguage) {
      return <Redirect href="/(onboarding)/language" />;
    }

    if (!hasSeenHook) {
      return <Redirect href="/(onboarding)/hook" />;
    }

    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!profile?.onboarding_completed_at) {
    return <Redirect href="/(onboarding)" />;
  }

  if (!activeHousehold?.first_fill_completed_at) {
    return <Redirect href="/(first-fill)" />;
  }

  return <Redirect href="/(tabs)/fridge" />;
}
