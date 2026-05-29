import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { AliveFridgeIllustration, Screen, Text } from "@/components";
import { spacing } from "@/theme";

export default function OnboardingPlaceholderRoute() {
  const { t } = useTranslation();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.xl }}>
        <AliveFridgeIllustration />
        <Text variant="display" center>
          {t("gate.onboardingTitle")}
        </Text>
        <Text variant="body" muted center>
          {t("gate.onboardingBody")}
        </Text>
      </View>
    </Screen>
  );
}

