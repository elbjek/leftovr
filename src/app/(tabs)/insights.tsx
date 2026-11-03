import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";


import { DaySheet, EmptyState, MonthlyRecap, PremiumSheet, RecipeGlyph, Screen, ScreenHeader, SegmentedControl, Text, WinsList } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { useDaySheet, useHousehold, useInsights, useMonthlyRecap, useStreak, useWins } from "@/hooks";
import { InventoryCategory, toUiCategory } from "@/services";
import { formatCategoryLabel, InsightsSummary } from "@/services/insightsService";
import { formatMoney } from "@/lib/money";
import { colors, fonts, radii, spacing } from "@/theme";

export default function InsightsRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const isPremium = resolvePremium(profile, activeHousehold);
  const [showPremium, setShowPremium] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<"you" | "household">("you");
  const { members } = useHousehold(activeHousehold?.id);
  const showHouseholdScope = members.length >= 2;
  const {
    weeklySummary,
    lastWeekSummary,
    householdWeeklySummary,
    loading,
    refresh: refreshInsights,
  } = useInsights(isPremium ? activeHousehold?.id : undefined, {
    userId: profile?.id,
    includeHousehold: showHouseholdScope,
  });

  // The monthly recap is for everyone, Premium or not — it's the shareable part.
  const { period, summary: recapSummary, householdSaved, refresh: refreshRecap } = useMonthlyRecap(
    activeHousehold?.id,
    profile?.id,
    showHouseholdScope,
  );
  const { streak, refresh: refreshStreak } = useStreak(activeHousehold?.id);
  // Your wins: every day you used something up, for everyone like the recap.
  const { wins, refresh: refreshWins } = useWins(activeHousehold?.id, profile?.id);
  const { openDay, showDay, closeDay } = useDaySheet(activeHousehold?.id, profile?.id);

  // Cooking happens on other tabs — refetch whenever this tab gains focus.
  useFocusEffect(
    useCallback(() => {
      void refreshInsights();
      void refreshRecap();
      void refreshStreak();
      void refreshWins();
    }, [refreshInsights, refreshRecap, refreshStreak, refreshWins]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshInsights(), refreshRecap(), refreshWins(), refresh()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshInsights, refreshRecap, refreshWins, refresh]);

  const currency = activeHousehold?.currency_code ?? "USD";
  const month = period.start.toLocaleDateString(undefined, { month: "long" });
  const recapEmpty = !recapSummary || (recapSummary.isSparse && recapSummary.moneySaved === 0);
  const topFood = recapSummary?.topUsedFood;
  const topDish = recapSummary?.cookedRecipes[0];
  const recapCard = (
    <MonthlyRecap
      eyebrow={t("insights.recap.eyebrow")}
      title={period.complete ? t("insights.recap.titleComplete", { month }) : t("insights.recap.titleSoFar", { month })}
      hero={
        recapSummary && recapSummary.moneySaved > 0
          ? { value: formatMoney(recapSummary.moneySaved, currency), label: t("insights.recap.saved") }
          : undefined
      }
      stats={[
        { value: String(recapSummary?.itemsSaved ?? 0), label: t("insights.recap.itemsUsed") },
        { value: String(recapSummary?.cookedEvents ?? 0), label: t("insights.recap.cooked") },
        { value: String(streak), label: t("insights.recap.streak") },
      ]}
      rows={[
        ...(topFood
          ? [{ label: t("insights.recap.topFood"), value: t("insights.recap.countValue", { name: capitalize(topFood.name), count: topFood.count }) }]
          : []),
        ...(topDish ? [{ label: t("insights.recap.topDish"), value: t("insights.recap.countValue", { name: topDish.title, count: topDish.count }) }] : []),
      ]}
      footnote={
        householdSaved && householdSaved > 0
          ? t("insights.recap.household", { amount: formatMoney(householdSaved, currency) })
          : undefined
      }
      emptyText={recapEmpty ? t("insights.recap.empty") : undefined}
      shareLabel={t("insights.recap.share")}
      onShare={() => {
        if (!recapSummary) return;
        const counts = { month, items: recapSummary.itemsSaved, dinners: recapSummary.cookedEvents };
        void Share.share({
          message:
            recapSummary.moneySaved > 0
              ? t("insights.recap.shareMessageMoney", { ...counts, amount: formatMoney(recapSummary.moneySaved, currency) })
              : t("insights.recap.shareMessage", counts),
        });
      }}
    />
  );

  const winsSection = (
    <WinsList
      eyebrow={t("insights.wins.eyebrow")}
      showAllLabel={t("insights.wins.showAll", { count: wins.length })}
      days={wins.map((day) => ({
        key: day.date.toDateString(),
        date: day.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
        title: day.itemsUsed > 0 ? t("insights.wins.saved", { count: day.itemsUsed }) : t("insights.wins.cookedOnly"),
        detail: day.cooked.length > 0 ? day.cooked.join(", ") : undefined,
        money: day.moneySaved > 0 ? formatMoney(day.moneySaved, currency) : undefined,
        onPress: () => void showDay(day.date),
      }))}
    />
  );

  const daySheet = (
    <DaySheet
      visible={openDay != null}
      onDismiss={closeDay}
      title={openDay?.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) ?? ""}
      activity={
        openDay?.activity
          ? {
              cooked: openDay.activity.cooked,
              used: openDay.activity.used.map((food) => ({ ...food, category: toUiCategory(food.category as InventoryCategory) })),
            }
          : null
      }
      saved={
        openDay?.activity && openDay.activity.moneySaved > 0
          ? t("recipes.week.saved", { amount: formatMoney(openDay.activity.moneySaved, currency) })
          : undefined
      }
      labels={{ cooked: t("recipes.week.dayCooked"), used: t("recipes.week.dayUsed"), empty: t("recipes.week.dayEmpty") }}
    />
  );

  if (!isPremium) {
    return (
      <Screen scroll contentContainerStyle={styles.freeContent}>
        {recapCard}
        {winsSection}
        {daySheet}
        <View style={styles.gateWrap}>
          <EmptyState
            title={t("insights.title")}
            body={t("insights.gateBody")}
            actionLabel={t("insights.unlock")}
            onAction={() => setShowPremium(true)}
          />
          <PremiumSheet
            visible={showPremium}
            onPurchased={refresh}
            onDismiss={() => setShowPremium(false)}
          />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const summary =
    (scope === "household" ? householdWeeklySummary : weeklySummary) ?? getEmptySummary();
  // Real week-over-week deltas (personal scope only; household scope shows no trend).
  const lastWeek = scope === "you" ? lastWeekSummary : null;
  const savedDelta = lastWeek ? summary.estimatedItemsSaved - lastWeek.estimatedItemsSaved : 0;
  const cookedDelta = lastWeek ? summary.cookedEvents - lastWeek.cookedEvents : 0;

  return (
    <Screen padded={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ScreenHeader
          eyebrow={t("insights.eyebrow", { week: formatWeekLabel() })}
          title={t("insights.premiumTitle")}
        />
        {showHouseholdScope ? (
          <View style={styles.scopeToggle}>
            <SegmentedControl
              options={[
                { label: t("insights.scope.you"), value: "you" as const },
                { label: t("insights.scope.household"), value: "household" as const },
              ]}
              value={scope}
              onChange={setScope}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.heroWrap}>
        <HeroStat summary={summary} savedDelta={savedDelta} currency={currency} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {recapCard}
        {winsSection}

        <View style={styles.miniGrid}>
          <MiniStat
            label={t("insights.moneySpent")}
            value={formatMoney(summary.moneySpent, currency)}
            sub={t("insights.weeklyTitle")}
          />
          <MiniStat
            label={t("insights.moneyWasted")}
            value={formatMoney(summary.moneyWasted, currency)}
            sub={t("insights.weeklyTitle")}
          />
        </View>

        <View style={styles.miniGrid}>
          <MiniStat
            label={t("insights.recipesCooked")}
            value={String(summary.cookedEvents)}
            sub={
              cookedDelta > 0
                ? t("insights.recipesCookedSubUp", { count: cookedDelta })
                : t("insights.recipesCookedSubFlat")
            }
          />
          <MiniStat
            label={t("insights.eatFirstHits")}
            value={getEatFirstHitRate(summary)}
            sub={t("insights.eatFirstHitsSub")}
          />
        </View>

        <PatternCard summary={summary} />
        <MostCookedCard summary={summary} />
      </ScrollView>
      {daySheet}
    </Screen>
  );
}

function HeroStat({ summary, savedDelta, currency }: { summary: InsightsSummary; savedDelta: number; currency: string }) {
  const { t } = useTranslation();
  const items = summary.estimatedItemsSaved;
  const amount = formatMoney(summary.moneySaved, currency);

  return (
    <View style={styles.heroCard}>
      <Text variant="micro" color={colors.accent} uppercase style={styles.heroEyebrow}>
        {t("insights.itemsSavedThisWeek")}
      </Text>
      <View style={styles.heroValueRow}>
        <Text style={styles.heroValue}>{items}</Text>
        <Text variant="small" color="rgba(243,239,232,0.72)" style={styles.heroMeta}>
          {t("insights.heroMeta", { count: items, amount })}
        </Text>
      </View>
      <View style={styles.heroDivider} />
      <Text variant="small" color="rgba(243,239,232,0.86)">
        {summary.isSparse
          ? t("insights.heroSparse")
          : savedDelta > 0
            ? t("insights.heroTrend", { count: savedDelta })
            : t("insights.heroTrendFlat")}
      </Text>
    </View>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.statCard}>
      <Text variant="micro" muted uppercase style={styles.statLabel}>
        {label}
      </Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="small" muted style={styles.statSub}>
        {sub}
      </Text>
    </View>
  );
}

function PatternCard({ summary }: { summary: InsightsSummary }) {
  const { t } = useTranslation();
  const category = summary.mostUsedCategory ? formatCategoryLabel(summary.mostUsedCategory) : null;

  return (
    <View style={styles.card}>
      <Text variant="micro" muted uppercase style={styles.cardEyebrow}>
        {t("insights.patternTitle")}
      </Text>
      <Text variant="body" style={styles.patternCopy}>
        {category
          ? t("insights.patternBody", { category })
          : t("insights.patternSparseBody")}
      </Text>
    </View>
  );
}

function MostCookedCard({ summary }: { summary: InsightsSummary }) {
  const { t } = useTranslation();
  const rows = summary.cookedRecipes.length > 0
    ? summary.cookedRecipes
    : [{ title: t("insights.noCookedYet"), count: 0 }];

  return (
    <View style={styles.card}>
      <Text variant="micro" muted uppercase style={styles.cardEyebrow}>
        {t("insights.mostCooked")}
      </Text>
      <View style={styles.recipeList}>
        {rows.map((row) => (
          <View key={row.title} style={styles.recipeRow}>
            <View style={styles.recipeLeft}>
              <View style={styles.recipeThumb}>
                <RecipeGlyph />
              </View>
              <Text variant="label" numberOfLines={1} style={styles.recipeTitle}>
                {row.title}
              </Text>
            </View>
            <Text variant="small" muted>
              {row.count > 0 ? t("insights.timesCooked", { count: row.count }) : t("insights.emptyTimesCooked")}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}


function formatWeekLabel() {
  const date = new Date();
  const weekday = date.getDay();
  const diff = date.getDate() - weekday + (weekday === 0 ? -6 : 1);
  const monday = new Date(date.getFullYear(), date.getMonth(), diff);
  return monday.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function getEatFirstHitRate(summary: InsightsSummary) {
  if (summary.itemsAdded === 0) return "0%";
  return `${Math.min(100, Math.round((summary.removedItems / summary.itemsAdded) * 100))}%`;
}

function capitalize(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getEmptySummary(): InsightsSummary {
  return {
    receiptScans: 0,
    itemsAdded: 0,
    cookedEvents: 0,
    removedItems: 0,
    itemsSaved: 0,
    estimatedItemsSaved: 0,
    moneySpent: 0,
    moneySaved: 0,
    moneyWasted: 0,
    mostUsedCategory: null,
    isSparse: true,
    cookedRecipes: [],
    topUsedFood: null,
  };
}

const styles = StyleSheet.create({
  freeContent: {
    gap: spacing.xxl,
  },
  gateWrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingTop: spacing.screenTop,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.sm,
  },
  scopeToggle: {
    marginTop: spacing.md,
  },
  heroWrap: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: 14,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.tabBarClearance,
    gap: 14,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 22,
  },
  heroEyebrow: {
    marginBottom: 10,
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  heroValue: {
    color: colors.surface,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 64,
    // Below the font size iOS clips the digits' tops.
    lineHeight: 72,
    fontWeight: "700",
  },
  heroMeta: {
    flex: 1,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(243,239,232,0.15)",
    marginVertical: 18,
  },
  miniGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  statLabel: {
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
  },
  statSub: {
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
  },
  cardEyebrow: {
    marginBottom: spacing.sm,
  },
  patternCopy: {
    fontWeight: "500",
  },
  recipeList: {
    gap: 10,
  },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  recipeLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recipeThumb: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#C8D5C2",
    alignItems: "center",
    justifyContent: "center",
  },
  recipeTitle: {
    flex: 1,
    minWidth: 0,
  },
});
