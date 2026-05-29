import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Screen, Text } from "@/components";
import { spacing } from "@/theme";

export default function RecipesRoute() {
  const { t } = useTranslation();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.md }}>
        <Text variant="display">{t("gate.recipesTitle")}</Text>
        <Text variant="body" muted>
          {t("gate.recipesBody")}
        </Text>
      </View>
    </Screen>
  );
}

