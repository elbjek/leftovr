import { View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  AliveFridgeIllustration,
  Button,
  ChoiceCard,
  PageDots,
  Screen,
  Text,
} from "@/components";
import { colors, spacing } from "@/theme";

export default function IndexRoute() {
  const { t, i18n } = useTranslation();

  return (
    <Screen>
      <View style={{ alignItems: "center", marginBottom: spacing.xxxl }}>
        <PageDots count={5} current={0} />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <AliveFridgeIllustration />
      </View>

      <View style={{ gap: spacing.lg }}>
        <Text variant="micro" color={colors.accent} uppercase center>
          {t("setup.eyebrow")}
        </Text>
        <Text variant="display" center>
          {t("setup.title")}
        </Text>
        <Text variant="body" muted center>
          {t("setup.body")}
        </Text>
        <ChoiceCard
          title={t("setup.receiptTitle")}
          subtitle={t("setup.receiptSubtitle")}
          recommended
          recommendedLabel={t("common.recommended")}
        />
        <Button
          title={t("common.continue")}
          onPress={() => i18n.changeLanguage(i18n.language === "sr" ? "en" : "sr")}
        />
      </View>
    </Screen>
  );
}
