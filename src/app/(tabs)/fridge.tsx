import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { AliveFridgeIllustration, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { spacing } from "@/theme";

export default function FridgeRoute() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg }}>
        <AliveFridgeIllustration />
        <Text variant="display" center>
          {profile?.display_name ? t("fridge.titleWithName", { name: profile.display_name }) : t("fridge.title")}
        </Text>
        <Text variant="body" muted center>
          {t("fridge.body")}
        </Text>
      </View>
    </Screen>
  );
}
