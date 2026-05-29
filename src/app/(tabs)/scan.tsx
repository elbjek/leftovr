import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { ReceiptToFridgeIllustration, Screen, Text } from "@/components";
import { spacing } from "@/theme";

export default function ScanRoute() {
  const { t } = useTranslation();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg }}>
        <ReceiptToFridgeIllustration />
        <Text variant="display" center>
          {t("gate.scanTitle")}
        </Text>
        <Text variant="body" muted center>
          {t("gate.scanBody")}
        </Text>
      </View>
    </Screen>
  );
}

