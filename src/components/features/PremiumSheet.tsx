import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { PurchasesOffering } from "react-native-purchases";

import { isPremium, useAuth } from "@/features";
import { findPackage, getCurrentOffering, PRODUCT_IDS, purchasePackage, restorePurchases } from "@/services";
import { colors, radii, spacing } from "../../theme";
import { BottomSheet, Button, SegmentedControl, Text } from "../primitives";
import { FoodGlyph } from "../illustrations";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { formatPerMonth, savePercent } from "./perMonth";
import { legalUrl } from "@/lib/legalUrl";

// iOS deep link to the system Manage Subscriptions screen.
const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
// Apple's standard EULA (Licensed Application EULA). Used as the paywall Terms
// of Use link because the App Store listing adopts the standard EULA rather
// than a custom License Agreement.
const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

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
  const { t, i18n } = useTranslation();
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

  // Re-open follows the caller's plan hint again, not last session's tab.
  // Adjusted during render (the supported "reset state when a prop changes"
  // pattern) rather than in the effect below, which would cascade renders.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPlanTypeOverride(null);
  }

  useEffect(() => {
    if (!visible) return;
    let active = true;
    async function load() {
      setError(null);
      setLoadingOffering(true);
      try {
        const result = await getCurrentOffering();
        if (active) setOffering(result);
      } catch (e) {
        console.warn("[purchase] offerings failed", describePurchaseError(e));
        if (active) setError(withDevCode(t("premium.unavailable"), e));
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
  const yearlySave = savePercent(monthlyPkg, yearlyPkg);

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
      console.warn("[purchase] failed", describePurchaseError(e));
      setError(withDevCode(t("premium.purchaseError"), e));
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
    } catch (e) {
      console.warn("[purchase] restore failed", describePurchaseError(e));
      setError(withDevCode(t("premium.purchaseError"), e));
    } finally {
      setBusy(false);
    }
  }

  // Each example card shows what a Premium feature looks like in use, not a
  // checklist line. Household leads with sharing, then everything Premium has.
  const examples: Example[] = [
    ...(household ? [{ key: "household", food: "category_meat" }] : []),
    { key: "eatFirst", food: "spinach" },
    { key: "recipes", food: "eggs" },
    { key: "scans", food: "category_dairy_eggs" },
    { key: "tonight", food: "tomato" },
    { key: "insights", food: "carrot" },
  ];
  const [page, setPage] = useState(0);

  const planLabel = household ? t("premium.householdTab") : t("premium.individualTab");
  const billedPrice = selectedPkg
    ? `${selectedPkg.product.priceString}${period === "monthly" ? t("premium.perMonth") : t("premium.perYear")}`
    : null;

  return (
    <BottomSheet visible={visible} onDismiss={handleDismiss}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ShelfHero foods={household ? HOUSEHOLD_FOODS : INDIVIDUAL_FOODS} todayIndex={household ? 1 : 0} />

        <Text variant="h3" style={styles.headline}>
          {hasAnyPremium
            ? t("premium.manageHeadline")
            : household
              ? t("premium.householdHeadline")
              : t("premium.headline")}
        </Text>
        <Text variant="body" muted style={styles.subtitle}>
          {hasAnyPremium
            ? t("premium.manageSubtitle")
            : household
              ? t("premium.householdSubtitle")
              : t("premium.subtitle")}
        </Text>

        <View style={styles.tabs}>
          <SegmentedControl
            value={planType}
            onChange={(value) => {
              setPlanTypeOverride(value);
              setPage(0);
            }}
            options={[
              { label: t("premium.individualTab"), value: "individual" },
              { label: t("premium.householdTab"), value: "household" },
            ]}
          />
        </View>

        <ScrollView
          key={planType}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          style={styles.rail}
          contentContainerStyle={styles.railContent}
          scrollEventThrottle={32}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP)))}
        >
          {examples.map((ex) => (
            <View key={ex.key} style={styles.exampleCard}>
              <View style={styles.exampleWell}>
                <FoodGlyph name={ex.food} size={30} />
              </View>
              <Text variant="micro" color={colors.primary} style={styles.exampleLabel}>
                {t(`premium.examples.${ex.key}.label`)}
              </Text>
              <Text variant="title" style={styles.exampleTitle}>
                {t(`premium.examples.${ex.key}.title`)}
              </Text>
              <Text variant="small" muted>
                {t(`premium.examples.${ex.key}.body`)}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {examples.map((ex, i) => (
            <View key={ex.key} style={[styles.dot, i === page && styles.dotOn]} />
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
            sub={t("premium.perMonthLong")}
            selected={period === "monthly"}
            onPress={() => setPeriod("monthly")}
          />
          <PlanCard
            label={t("premium.yearly")}
            price={yearlyPkg?.product.priceString ?? "—"}
            sub={
              yearlyPkg
                ? t("premium.perYearWithMonthly", { perMonth: formatPerMonth(yearlyPkg, "") })
                : t("premium.perYearLong")
            }
            selected={period === "yearly"}
            badge={yearlySave ? t("premium.saveBadge", { percent: yearlySave }) : undefined}
            onPress={() => setPeriod("yearly")}
          />
        </View>

        {error ? (
          <Text variant="small" color={colors.redInk} center style={styles.error}>
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
            title={
              hasAnyPremium
                ? t("premium.switchPlan")
                : billedPrice
                  ? t(household ? "premium.ctaHousehold" : "premium.ctaIndividual", { price: billedPrice })
                  : t("premium.subscribe")
            }
            onPress={handleSubscribe}
            disabled={!selectedPkg || busy}
            loading={busy}
            style={styles.cta}
          />
        )}

        {selectedPkg ? (
          <Text variant="small" muted center style={styles.fine}>
            {t(period === "monthly" ? "premium.fineMonthly" : "premium.fineYearly", {
              plan: planLabel,
              price: selectedPkg.product.priceString,
            })}
          </Text>
        ) : null}

        <View style={styles.legalRow}>
          {hasAnyPremium ? (
            isViewingCurrent ? null : (
              <LegalLink label={t("premium.manage")} onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)} />
            )
          ) : (
            <LegalLink label={t("premium.restore")} onPress={handleRestore} disabled={busy} />
          )}
          <LegalLink label={t("premium.termsOfUse")} onPress={() => Linking.openURL(TERMS_URL)} />
          <LegalLink
            label={t("premium.privacyPolicy")}
            onPress={() => Linking.openURL(legalUrl("privacy", i18n.language))}
          />
        </View>

        <Button title={t("premium.dismiss")} variant="text" onPress={handleDismiss} />
      </ScrollView>
    </BottomSheet>
  );
}

type Example = { key: string; food: string };

const CARD_WIDTH = 164;
const CARD_GAP = 10;
const INDIVIDUAL_FOODS = ["spinach", "eggs", "tomato", "white_cheese", "bell_pepper"];
const HOUSEHOLD_FOODS = ["chicken", "potato", "carrot", "milk", "bread"];
const HOP = 10;

/**
 * A peach shelf of foods hopping one after another, one of them tagged
 * "today" — the Eat-first idea in a glance. Still when the device asks for
 * reduced motion.
 */
function ShelfHero({ foods, todayIndex }: { foods: string[]; todayIndex: number }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [beat] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(beat, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [beat, reduce]);

  return (
    <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.heroPill}>
        <Text variant="micro" color={colors.accentInk}>
          ★ {t("premium.title")}
        </Text>
      </View>
      <View style={styles.shelfFoods}>
        {foods.map((food, i) => {
          const start = 0.05 + i * 0.12;
          const translateY = beat.interpolate({
            inputRange: [0, start, start + 0.06, start + 0.12, 1],
            outputRange: [0, 0, -HOP, 0, 0],
          });
          return (
            <Animated.View key={food} style={[styles.shelfFood, { transform: [{ translateY }] }]}>
              {i === todayIndex ? (
                <View style={styles.todayTag}>
                  <Text variant="micro" color={colors.onPrimary}>
                    {t("premium.today")}
                  </Text>
                </View>
              ) : null}
              <FoodGlyph name={food} size={40} />
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.shelf} />
    </View>
  );
}

function LegalLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} disabled={disabled} hitSlop={8}>
      <Text variant="small" muted style={styles.legalLink}>
        {label}
      </Text>
    </Pressable>
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
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={[styles.planCard, selected && styles.planCardSelected]}
    >
      {badge ? (
        <View style={styles.planBadge}>
          <Text variant="micro" color={colors.text}>{badge}</Text>
        </View>
      ) : null}
      <View style={[styles.radio, selected && styles.radioOn]} />
      <Text variant="micro" color={colors.muted} style={styles.planPeriod}>
        {label}
      </Text>
      <Text variant="h2" color={colors.text}>{price}</Text>
      <Text variant="small" color={colors.muted}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The sheet pads its sides; the scroll view takes that padding inside it
  // so the example cards can run to the screen edge instead of being clipped.
  scroll: {
    marginHorizontal: -spacing.xxl,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
  },
  hero: {
    height: 144,
    backgroundColor: colors.surface2,
    borderRadius: radii.xl,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  heroPill: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
  },
  shelfFoods: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shelfFood: {
    alignItems: "center",
  },
  todayTag: {
    position: "absolute",
    top: -18,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    zIndex: 1,
  },
  shelf: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 22,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
  },
  headline: {
    marginBottom: spacing.xxs,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  tabs: {
    marginBottom: spacing.md,
  },
  rail: {
    marginHorizontal: -spacing.xxl,
  },
  railContent: {
    paddingHorizontal: spacing.xxl,
    gap: CARD_GAP,
  },
  exampleCard: {
    width: CARD_WIDTH,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.lg,
  },
  exampleWell: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  exampleLabel: {
    textTransform: "uppercase",
  },
  exampleTitle: {
    marginTop: 2,
    marginBottom: 2,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.hairlineStrong,
  },
  dotOn: {
    width: 16,
    backgroundColor: colors.primary,
  },
  planCards: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.cardLine,
    borderRadius: radii.lg,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary50,
  },
  planBadge: {
    position: "absolute",
    top: -10,
    right: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    zIndex: 1,
  },
  radio: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.muted2,
  },
  radioOn: {
    borderWidth: 5,
    borderColor: colors.primary,
  },
  planPeriod: {
    textTransform: "uppercase",
    marginBottom: 2,
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
  fine: {
    marginBottom: spacing.sm,
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: spacing.lg,
    rowGap: spacing.xs,
    marginBottom: spacing.xs,
  },
  legalLink: {
    textDecorationLine: "underline",
  },
});

// RevenueCat errors carry a readable code (STORE_PROBLEM, CONFIGURATION_ERROR,
// PRODUCT_NOT_AVAILABLE_FOR_PURCHASE…) that the friendly message hides. Log it,
// and in dev builds show it under the message so a failed sandbox purchase
// says why.
function describePurchaseError(error: unknown) {
  const e = error as {
    code?: string;
    readableErrorCode?: string;
    message?: string;
    underlyingErrorMessage?: string;
  } | null;
  return {
    code: e?.readableErrorCode ?? e?.code ?? null,
    message: e?.message ?? String(error),
    underlying: e?.underlyingErrorMessage ?? null,
  };
}

function withDevCode(message: string, error: unknown) {
  if (!__DEV__) return message;
  const { code, underlying } = describePurchaseError(error);
  return [message, code, underlying].filter(Boolean).join("\n");
}
