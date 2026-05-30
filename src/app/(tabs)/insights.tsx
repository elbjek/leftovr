import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { EmptyState, PremiumSheet, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { setPreviewTier } from "@/repositories";
import { colors, spacing } from "@/theme";

export default function InsightsRoute() {
  const { t } = useTranslation();
  const { profile, refresh } = useAuth();
  const isPremium = profile?.tier !== "free";
  const [showPremium, setShowPremium] = useState(false);

  if (!isPremium) {
    return (
      <Screen>
        <View style={styles.gateWrap}>
          <EmptyState
            title={t("insights.title")}
            body={t("insights.gateBody")}
            actionLabel={t("insights.unlock")}
            onAction={() => setShowPremium(true)}
          />
          <PremiumSheet
            visible={showPremium}
            onPreview={async () => {
              await setPreviewTier("premium");
              await refresh();
            }}
            onDismiss={() => setShowPremium(false)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.premiumWrap}>
        <Text variant="micro" color={colors.accent} style={styles.premiumBadge}>
          ★ {t("premium.title")}
        </Text>
        <Text variant="display">{t("insights.premiumTitle")}</Text>
        <Text variant="body" muted style={styles.body}>
          {t("insights.premiumBody")}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gateWrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  premiumWrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm,
  },
  premiumBadge: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  body: {
    marginTop: spacing.sm,
  },
});
