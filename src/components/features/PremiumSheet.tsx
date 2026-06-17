import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { BottomSheet, Button, Text } from "../primitives";

type PremiumPlan = "individual" | "household";
type BillingPeriod = "monthly" | "yearly";

type Props = {
  visible: boolean;
  plan?: PremiumPlan;
  onPreview?: () => void;
  onDismiss: () => void;
};

export function PremiumSheet({ visible, plan = "individual", onPreview, onDismiss }: Props) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const household = plan === "household";

  const features = household
    ? [
        t("premium.features.eatFirst"),
        t("premium.features.unlimitedRecipes"),
        t("premium.features.dailyNotification"),
        t("premium.features.householdSharing"),
      ]
    : [
        t("premium.features.eatFirst"),
        t("premium.features.unlimitedRecipes"),
        t("premium.features.dailyNotification"),
        t("premium.features.insights"),
      ];

  function handlePreview() {
    onPreview?.();
    onDismiss();
  }

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.badge}>
        <Text variant="micro" color={colors.primary} style={styles.badgeText}>
          ★ {t("premium.title")}
        </Text>
      </View>

      <Text variant="h1" center style={styles.headline}>
        {household ? t("premium.householdHeadline") : t("premium.headline")}
      </Text>
      <Text variant="body" muted center style={styles.subtitle}>
        {household ? t("premium.householdSubtitle") : t("premium.subtitle")}
      </Text>

      <View style={styles.featureList}>
        {features.map((feat) => (
          <View key={feat} style={styles.featureRow}>
            <View style={styles.checkCircle}>
              <Svg width={11} height={11} viewBox="0 0 11 11">
                <Path d="M2 6L4.5 8.5L9 3" stroke={colors.surface} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text variant="label">{feat}</Text>
          </View>
        ))}
      </View>

      <View style={styles.planCards}>
        <PlanCard
          label={t("premium.monthly")}
          price={household ? "$7.99" : "$4.99"}
          sub={t("premium.perMonth")}
          selected={period === "monthly"}
          onPress={() => setPeriod("monthly")}
        />
        <PlanCard
          label={t("premium.yearly")}
          price={household ? "$49.99" : "$29.99"}
          sub={t("premium.perYear")}
          selected={period === "yearly"}
          badge={t("premium.saveBadge")}
          onPress={() => setPeriod("yearly")}
        />
      </View>

      {household ? (
        <Text variant="small" muted center style={styles.memberNote}>
          {t("premium.upToMembers")}
        </Text>
      ) : null}

      {/* TODO(billing): integrate RevenueCat so the selected plan is purchasable.
         The buy CTA should call RevenueCat purchase → on success sync the tier
         server-side. Until then prod has no working purchase action (only the
         dev preview grant below). App Store review will reject a paywall with
         prices but no real purchase, so wire this before public release. */}
      {__DEV__ ? (
        <Button
          title={household ? t("premium.previewHousehold") : t("premium.previewIndividual")}
          onPress={handlePreview}
          style={styles.cta}
        />
      ) : null}
      <Button title={t("premium.dismiss")} variant="text" onPress={onDismiss} />
    </BottomSheet>
  );
}

function PlanCard({
  label,
  price,
  sub,
  selected,
  badge,
  onPress,
}: {
  label: string;
  price: string;
  sub: string;
  selected: boolean;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.planCard, selected && styles.planCardSelected]}
    >
      {badge ? (
        <View style={styles.planBadge}>
          <Text variant="micro" color={colors.text} style={styles.planBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text variant="micro" color={selected ? colors.surface : colors.muted} style={styles.planPeriod}>
        {label}
      </Text>
      <View style={styles.planPriceRow}>
        <Text variant="h2" color={selected ? colors.surface : colors.text}>{price}</Text>
        <Text variant="small" color={selected ? "rgba(248,244,238,0.7)" : colors.muted}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    marginBottom: spacing.lg,
  },
  badgeText: {
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headline: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  featureList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  planCards: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planCard: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    position: "relative",
  },
  planCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  planBadge: {
    position: "absolute",
    top: -8,
    right: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  planBadgeText: {
    fontWeight: "700",
  },
  planPeriod: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  memberNote: {
    marginBottom: spacing.lg,
  },
  cta: {
    marginBottom: spacing.sm,
  },
});
