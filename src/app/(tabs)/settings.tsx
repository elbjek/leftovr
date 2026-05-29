import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Screen, SegmentedControl, Text } from "@/components";
import { useAuth } from "@/features";
import { isSupportedLanguage, supportedLanguages, SupportedLanguage } from "@/i18n";
import { spacing } from "@/theme";

export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const { profile, activeHousehold, signOut, loading } = useAuth();
  const currentLanguage = isSupportedLanguage(i18n.language) ? i18n.language : "en";
  const languageOptions = supportedLanguages.map((language) => ({
    label: t(`settings.languages.${language}`),
    value: language,
  }));

  function handleLanguageChange(language: SupportedLanguage) {
    i18n.changeLanguage(language);
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
          <Text variant="label">{profile?.display_name}</Text>
          <Text variant="small" muted>
            {activeHousehold?.name ?? t("common.unknownHousehold")}
          </Text>
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
        <Button title={t("common.signOut")} loading={loading} onPress={signOut} />
      </View>
    </Screen>
  );
}
