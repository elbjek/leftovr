import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Screen, SegmentedControl, Text } from "@/components";
import { useAuth } from "@/features";
import { HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY } from "@/features/onboardingGate";
import { isSupportedLanguage, supportedLanguages, SupportedLanguage } from "@/i18n";
import { resetCurrentUserOnboardingForDev } from "@/repositories";
import { spacing } from "@/theme";

export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const { profile, activeHousehold, session, signOut, loading } = useAuth();
  const currentLanguage = isSupportedLanguage(i18n.language) ? i18n.language : "en";
  const languageOptions = supportedLanguages.map((language) => ({
    label: t(`settings.languages.${language}`),
    value: language,
  }));

  function handleLanguageChange(language: SupportedLanguage) {
    i18n.changeLanguage(language);
  }

  async function handleResetOnboarding() {
    if (session) {
      await resetCurrentUserOnboardingForDev();
    }

    await AsyncStorage.multiRemove([HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY]);
    await signOut();
    router.replace("/");
  }

  return (
    <Screen scroll>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="display">{t("settings.title")}</Text>
          <Text variant="body" muted>
            {t("settings.body")}
          </Text>
        </View>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text variant="label">{profile?.display_name}</Text>
              <Text variant="small" muted>
                {activeHousehold?.name ?? t("common.unknownHousehold")}
              </Text>
            </View>
            <Button title={t("common.signOut")} loading={loading} onPress={signOut} />
            {__DEV__ ? (
              <Button
                title={t("settings.resetOnboarding")}
                variant="ghost"
                loading={loading}
                onPress={handleResetOnboarding}
              />
            ) : null}
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text variant="label">{t("settings.languageTitle")}</Text>
              <Text variant="small" muted>
                {t("settings.languageBody")}
              </Text>
            </View>
            <SegmentedControl
              options={languageOptions}
              value={currentLanguage}
              onChange={handleLanguageChange}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
