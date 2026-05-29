import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { spacing } from "@/theme";

export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const { profile, activeHousehold, signOut, loading } = useAuth();

  return (
    <Screen scroll>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="display">{t("gate.settingsTitle")}</Text>
          <Text variant="body" muted>
            {t("gate.settingsBody")}
          </Text>
        </View>

        <Card>
          <Text variant="label">{profile?.display_name}</Text>
          <Text variant="small" muted>
            {activeHousehold?.name}
          </Text>
        </Card>

        <Button
          title={i18n.language === "sr" ? "English" : "Srpski"}
          variant="ghost"
          onPress={() => i18n.changeLanguage(i18n.language === "sr" ? "en" : "sr")}
        />
        <Button title={t("common.signOut")} loading={loading} onPress={signOut} />
      </View>
    </Screen>
  );
}

