import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { ReceiptToFridgeIllustration, Screen, Text } from "@/components";
import { spacing } from "@/theme";

export default function FirstFillPlaceholderRoute() {
  const { t } = useTranslation();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.xl }}>
        <ReceiptToFridgeIllustration />
        <Text variant="display" center>
          {t("gate.firstFillTitle")}
        </Text>
        <Text variant="body" muted center>
          {t("gate.firstFillBody")}
        </Text>
      </View>
    </Screen>
  );
}

