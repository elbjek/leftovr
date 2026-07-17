import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import type { PurchasesOffering } from "react-native-purchases";

import { isPremium, useAuth } from "@/features";
import { findPackage, getCurrentOffering, PRODUCT_IDS, purchasePackage, restorePurchases } from "@/services";
import { colors, radii, spacing } from "../../theme";
import { BottomSheet, Button, SegmentedControl, Text } from "../primitives";
import { formatPerMonth } from "./perMonth";

// iOS deep link to the system Manage Subscriptions screen.
const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
const TERMS_URL = "https://leftovr.co/terms/";
const PRIVACY_URL = "https://leftovr.co/privacy/";

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

export function PremiumSheet({ visible, plan, onPurchased, onDismiss }: Props) {
  const { t } = useTranslation();
  const { profile, activeHousehold } = useAuth();
  const hasHouseholdPlan =
    profile?.tier === "household_premium" || activeHousehold?.plan_tier === "household_premium";
  const hasAnyPremium = isPremium(profile, activeHousehold);
  // The tier the user is on now (null = free) — used to mark the current plan.
  const currentType: PremiumPlan | null = hasHouseholdPlan ? "household" : hasAnyPremium ? "individual" : null;

  // Tabs: everyone sees both Individual and Household. The caller's hint wins
  // (e.g. a household gate must show the Household tab even for an individual
  // subscriber), then the current plan, then Individual.
  const [planTypeOverride, setPlanTypeOverride] = useState<PremiumPlan | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const planType = planTypeOverride ?? plan ?? currentType ?? "individual";

  const household = planType === "household";
  const isViewingCurrent = hasAnyPremium && currentType === planType;

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    // Re-open follows the caller's plan hint again, not last session's tab.
    setPlanTypeOverride(null);
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

  function handleDismiss() {
    setPlanTypeOverride(null);
    onDismiss();
  }

  // The tier is written server-side by the RevenueCat webhook, which can land
  // seconds after the purchase resolves on-device. One immediate refresh plus
  // a few delayed ones so the UI picks up the new tier without a reopen.
  async function syncTier() {
    await onPurchased?.();
    for (const ms of [2000, 5000, 10000]) {
      setTimeout(() => void onPurchased?.(), ms);
    }
  }

  async function handleSubscribe() {
    if (!selectedPkg) return;
    setError(null);
    setBusy(true);
    try {
      const purchased = await purchasePackage(selectedPkg);
      if (purchased) {
        await syncTier();
        handleDismiss();
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
      await syncTier();
      handleDismiss();
    } catch {
      setError(t("premium.purchaseError"));
    } finally {
      setBusy(false);
    }
  }

  // Household is a superset of Individual (everything + sharing) so the higher
  // price is clearly justified.
  const features = [
    t("premium.features.eatFirst"),
    t("premium.features.unlimitedRecipes"),
    t("premium.features.dailyNotification"),
    t("premium.features.insights"),
    ...(household ? [t("premium.features.householdSharing")] : []),
  ];


  return (
    <BottomSheet visible={visible} onDismiss={handleDismiss}>
      <View style={styles.badge}>
        <Text variant="micro" color={colors.primary} style={styles.badgeText}>
          ★ {t("premium.title")}
        </Text>
      </View>

      <Text variant="h1" center style={styles.headline}>
        {hasAnyPremium ? t("premium.manageHeadline") : t("premium.headline")}
      </Text>
      <Text variant="body" muted center style={styles.subtitle}>
        {hasAnyPremium ? t("premium.manageSubtitle") : t("premium.subtitle")}
      </Text>

      <View style={styles.tabs}>
        <SegmentedControl
          value={planType}
          onChange={(value) => setPlanTypeOverride(value)}
          options={[
            { label: t("premium.individualTab"), value: "individual" },
            { label: t("premium.householdTab"), value: "household" },
          ]}
        />
      </View>

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

      {isViewingCurrent ? (
        <View style={styles.currentPlanBanner}>
          <Text variant="small" center>
            {t("premium.currentPlan")}
          </Text>
        </View>
      ) : null}

      <View style={styles.planCards}>
        <PlanCard
          label={t("premium.monthly")}
          price={monthlyPkg?.product.priceString ?? "—"}
          sub={t("premium.perMonth")}
          selected={period === "monthly"}
          onPress={() => setPeriod("monthly")}
        />
        <PlanCard
          label={t("premium.yearly")}
          price={yearlyPkg?.product.priceString ?? "—"}
          sub={yearlyPkg ? `${formatPerMonth(yearlyPkg, "")}${t("premium.perMonth")}` : t("premium.perYear")}
          selected={period === "yearly"}
          badge={t("premium.saveBadge")}
          onPress={() => setPeriod("yearly")}
        />
      </View>

      {period === "yearly" ? (
        <Text variant="micro" muted center style={styles.billedNote}>
          {t("premium.billedYearly")}
        </Text>
      ) : null}

      {error ? (
        <Text variant="small" color={colors.red} center style={styles.error}>
          {error}
        </Text>
      ) : null}

      {isViewingCurrent ? (
        <Button
          title={t("premium.manage")}
          onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
          style={styles.cta}
        />
      ) : loadingOffering ? (
        <ActivityIndicator color={colors.primary} style={styles.cta} />
      ) : (
        <Button
          title={hasAnyPremium ? t("premium.switchPlan") : t("premium.subscribe")}
          onPress={handleSubscribe}
          disabled={!selectedPkg || busy}
          loading={busy}
          style={styles.cta}
        />
      )}

      <Text variant="micro" muted center style={styles.reassurance}>
        {t("premium.reassurance")}
      </Text>
      <View style={styles.legalRow}>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8}>
          <Text variant="micro" muted>{t("premium.terms")}</Text>
        </Pressable>
        <Text variant="micro" muted>·</Text>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
          <Text variant="micro" muted>{t("premium.privacy")}</Text>
        </Pressable>
      </View>

      {hasAnyPremium ? (
        isViewingCurrent ? null : (
          <Button
            title={t("premium.manage")}
            variant="text"
            onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
          />
        )
      ) : (
        <Button title={t("premium.restore")} variant="text" onPress={handleRestore} disabled={busy} />
      )}

      <Button title={t("premium.dismiss")} variant="text" onPress={handleDismiss} />
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
      <Text variant="micro" color={colors.muted} style={styles.planPeriod}>
        {label}
      </Text>
      <View style={styles.planPriceRow}>
        <Text variant="h2" color={colors.text}>{price}</Text>
        <Text variant="small" color={colors.muted}>{sub}</Text>
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
    marginBottom: spacing.lg,
  },
  tabs: {
    marginBottom: spacing.lg,
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
    borderColor: colors.cardLine,
    borderRadius: radii.lg,
    position: "relative",
  },
  planCardSelected: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sage,
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
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
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
  billedNote: {
    marginBottom: spacing.sm,
  },
  reassurance: {
    marginTop: spacing.xs,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
