import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Screen, Text } from "@/components";
import { spacing } from "@/theme";

export default function InsightsRoute() {
  const { t } = useTranslation();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.md }}>
        <Text variant="display">{t("gate.insightsTitle")}</Text>
        <Text variant="body" muted>
          {t("gate.insightsBody")}
        </Text>
      </View>
    </Screen>
  );
}

