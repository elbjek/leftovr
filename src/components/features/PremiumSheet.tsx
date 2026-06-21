import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import type { PurchasesOffering } from "react-native-purchases";

import { isPremium, useAuth } from "@/features";
import { findPackage, getCurrentOffering, PRODUCT_IDS, purchasePackage, restorePurchases } from "@/services";
import { colors, radii, spacing } from "../../theme";
import { BottomSheet, Button, Text } from "../primitives";

// iOS deep link to the system Manage Subscriptions screen.
const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

type PremiumPlan = "individual" | "household";
type BillingPeriod = "monthly" | "yearly";

type Props = {
  visible: boolean;
  plan?: PremiumPlan;
  /** Called after a successful purchase or restore so the caller can refresh
   *  the (server-controlled) tier. Entitlement itself is set by the webhook. */
  onPurchased?: () => Promise<void> | void;
  onDismiss: () => void;
};

export function PremiumSheet({ visible, plan = "individual", onPurchased, onDismiss }: Props) {
  const { t } = useTranslation();
  const { profile, activeHousehold } = useAuth();
  // Three states: no premium, individual premium (offer Household upgrade),
  // household premium (fully covered → managed view only).
  const hasHouseholdPlan =
    profile?.tier === "household_premium" || activeHousehold?.plan_tier === "household_premium";
  const hasAnyPremium = isPremium(profile, activeHousehold);
  const individualOnly = hasAnyPremium && !hasHouseholdPlan;
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  // Individual subscribers see the Household plans (the upgrade); everyone else
  // follows the caller's prop.
  const household = plan === "household" || individualOnly;

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    async function load() {
      setError(null);
      setLoadingOffering(true);
      try {
        const result = await getCurrentOffering();
        if (active) setOffering(result);
      } catch {
        if (active) setError(t("premium.unavailable"));
      } finally {
        if (active) setLoadingOffering(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [visible, t]);

  const productIds = household ? PRODUCT_IDS.household : PRODUCT_IDS.individual;
  const monthlyPkg = findPackage(offering, productIds.monthly);
  const yearlyPkg = findPackage(offering, productIds.yearly);
  const selectedPkg = period === "monthly" ? monthlyPkg : yearlyPkg;

  async function handleSubscribe() {
    if (!selectedPkg) return;
    setError(null);
    setBusy(true);
    try {
      const purchased = await purchasePackage(selectedPkg);
      if (purchased) {
        await onPurchased?.();
        onDismiss();
      }
    } catch (e) {
      console.warn("[purchase] failed", e);
      setError(t("premium.purchaseError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setError(null);
    setBusy(true);
    try {
      await restorePurchases();
      await onPurchased?.();
      onDismiss();
    } catch {
      setError(t("premium.purchaseError"));
    } finally {
      setBusy(false);
    }
  }

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


  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.badge}>
        <Text variant="micro" color={colors.primary} style={styles.badgeText}>
          ★ {t("premium.title")}
        </Text>
      </View>

      <Text variant="h1" center style={styles.headline}>
        {hasHouseholdPlan
          ? t("premium.subscribedHeadline")
          : individualOnly
            ? t("premium.upgradeHeadline")
            : household
              ? t("premium.householdHeadline")
              : t("premium.headline")}
      </Text>
      <Text variant="body" muted center style={styles.subtitle}>
        {hasHouseholdPlan
          ? t("premium.subscribedSubtitle")
          : individualOnly
            ? t("premium.upgradeSubtitle")
            : household
              ? t("premium.householdSubtitle")
              : t("premium.subtitle")}
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

      {hasHouseholdPlan ? (
        <>
          <Button
            title={t("premium.manage")}
            onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
            style={styles.cta}
          />
          <Button title={t("premium.dismiss")} variant="text" onPress={onDismiss} />
        </>
      ) : (
        <>
          {individualOnly ? (
            <View style={styles.currentPlanBanner}>
              <Text variant="small" center>
                {t("premium.currentPlanIndividual")}
              </Text>
            </View>
          ) : null}
          <View style={styles.planCards}>
            <PlanCard
              label={t("premium.monthly")}
              price={monthlyPkg?.product.priceString ?? (household ? "$7.99" : "$4.99")}
              sub={t("premium.perMonth")}
              selected={period === "monthly"}
              onPress={() => setPeriod("monthly")}
            />
            <PlanCard
              label={t("premium.yearly")}
              price={yearlyPkg?.product.priceString ?? (household ? "$49.99" : "$29.99")}
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

          {error ? (
            <Text variant="small" color={colors.red} center style={styles.error}>
              {error}
            </Text>
          ) : null}

          {loadingOffering ? (
            <ActivityIndicator color={colors.primary} style={styles.cta} />
          ) : (
            <Button
              title={individualOnly ? t("premium.upgradeToHousehold") : t("premium.subscribe")}
              onPress={handleSubscribe}
              disabled={!selectedPkg || busy}
              loading={busy}
              style={styles.cta}
            />
          )}

          {individualOnly ? (
            <Button
              title={t("premium.manage")}
              variant="text"
              onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
            />
          ) : (
            <Button title={t("premium.restore")} variant="text" onPress={handleRestore} disabled={busy} />
          )}

          <Button title={t("premium.dismiss")} variant="text" onPress={onDismiss} />
        </>
      )}
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
  currentPlanBanner: {
    backgroundColor: colors.primary50,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cta: {
    marginBottom: spacing.sm,
  },
  error: {
    marginBottom: spacing.sm,
  },
});
