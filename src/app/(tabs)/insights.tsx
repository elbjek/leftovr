import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Share, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";

import { DaySheet, FactList, PeriodSummary, PremiumSheet, Screen, ScreenHeader, SegmentedControl, Text, WinsList } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { useDaySheet, useHousehold, useInsights, useMonthlyRecap, useStreak, useWins } from "@/hooks";
import { InventoryCategory, toUiCategory } from "@/services";
import { InsightsSummary } from "@/services/insightsService";
import { formatMoney } from "@/lib/money";
import { colors, fonts, radii, spacing } from "@/theme";

type Period = "week" | "month";
type Scope = "you" | "household";

// One period (Week / Month) and one scope (You / Household) drive everything
// on the screen: the summary card, the highlights and your wins. The week is
// Premium; the month is for everyone.
export default function InsightsRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const isPremium = resolvePremium(profile, activeHousehold);
  const [showPremium, setShowPremium] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chosenPeriod, setChosenPeriod] = useState<Period>("week");
  const period: Period = isPremium ? chosenPeriod : "month";
  const [chosenScope, setChosenScope] = useState<Scope>("you");
  const { members } = useHousehold(activeHousehold?.id);
  const showHouseholdScope = members.length >= 2;
  const scope: Scope = showHouseholdScope ? chosenScope : "you";
  const currency = activeHousehold?.currency_code ?? "USD";

  const { weeklySummary, lastWeekSummary, householdWeeklySummary, refresh: refreshWeek } = useInsights(
    isPremium ? activeHousehold?.id : undefined,
    { userId: profile?.id, includeHousehold: showHouseholdScope },
  );
  const {
    period: monthPeriod,
    summary: monthSummary,
    householdSummary: monthHouseholdSummary,
    refresh: refreshMonth,
  } = useMonthlyRecap(activeHousehold?.id, profile?.id, showHouseholdScope);
  const { streak, refresh: refreshStreak } = useStreak(activeHousehold?.id);
  const { wins, refresh: refreshWins } = useWins(activeHousehold?.id, profile?.id, scope);
  const { openDay, showDay, closeDay } = useDaySheet(activeHousehold?.id, scope === "you" ? profile?.id : undefined);

  // Cooking happens on other tabs — refetch whenever this tab gains focus.
  useFocusEffect(
    useCallback(() => {
      void refreshWeek();
      void refreshMonth();
      void refreshStreak();
      void refreshWins();
    }, [refreshWeek, refreshMonth, refreshStreak, refreshWins]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshWeek(), refreshMonth(), refreshWins(), refresh()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshWeek, refreshMonth, refreshWins, refresh]);

  const summary: InsightsSummary | null =
    period === "week"
      ? scope === "household" ? householdWeeklySummary : weeklySummary
      : scope === "household" ? monthHouseholdSummary : monthSummary;
  const monthName = monthPeriod.start.toLocaleDateString(undefined, { month: "long" });
  const eyebrow =
    period === "week"
      ? weekRangeLabel()
      : monthPeriod.complete
        ? monthName
        : t("insights.recap.titleSoFar", { month: monthName });

  const hasMoney = (summary?.moneySaved ?? 0) > 0;
  // The trend is personal; in your month view the household total takes its place.
  const weekGain = summary && lastWeekSummary ? summary.moneySaved - lastWeekSummary.moneySaved : 0;
  const sub =
    scope === "you" && period === "week" && hasMoney && weekGain > 0
      ? t("insights.summary.moreThanLastWeek", { amount: formatMoney(weekGain, currency) })
      : scope === "you" && period === "month" && (monthHouseholdSummary?.moneySaved ?? 0) > 0
        ? t("insights.recap.household", { amount: formatMoney(monthHouseholdSummary!.moneySaved, currency) })
        : undefined;
  const stats = summary
    ? [
        // With no money to headline, the items used become the big number instead.
        ...(hasMoney ? [{ value: String(summary.itemsSaved), label: t("insights.recap.itemsUsed") }] : []),
        { value: String(summary.cookedEvents), label: t("insights.recap.cooked") },
        ...(scope === "you" ? [{ value: String(streak), label: t("insights.recap.streak") }] : []),
      ]
    : [];

  const share = () => {
    if (!summary) return;
    const counts = { month: monthName, items: summary.itemsSaved, dinners: summary.cookedEvents };
    const amount = formatMoney(summary.moneySaved, currency);
    const message =
      period === "week"
        ? hasMoney
          ? t("insights.summary.shareWeekMoney", { ...counts, amount })
          : t("insights.summary.shareWeek", counts)
        : hasMoney
          ? t("insights.recap.shareMessageMoney", { ...counts, amount })
          : t("insights.recap.shareMessage", counts);
    void Share.share({ message });
  };

  const topFood = summary?.topUsedFood;
  const topDish = summary?.cookedRecipes[0];
  const highlights = summary
    ? [
        ...(topFood
          ? [{ label: t("insights.recap.topFood"), value: t("insights.recap.countValue", { name: capitalize(topFood.name), count: topFood.count }) }]
          : []),
        ...(topDish ? [{ label: t("insights.recap.topDish"), value: t("insights.recap.countValue", { name: topDish.title, count: topDish.count }) }] : []),
        ...(isPremium && summary.itemsAdded > 0 ? [{ label: t("insights.highlights.usedRate"), value: usedRate(summary) }] : []),
        ...(isPremium
          ? [
              { label: t("insights.highlights.spent"), value: formatMoney(summary.moneySpent, currency) },
              {
                label: t("insights.highlights.wasted"),
                value: formatMoney(summary.moneyWasted, currency),
                tone: summary.moneyWasted > 0 ? ("danger" as const) : undefined,
              },
            ]
          : []),
      ]
    : [];

  return (
    <Screen
      scroll
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <View style={styles.header}>
        <ScreenHeader eyebrow={eyebrow} title={t("insights.title")} />
        <View style={styles.controls}>
          <View style={styles.periodControl}>
            <SegmentedControl
              options={[
                { label: isPremium ? t("insights.period.week") : t("insights.period.weekPremium"), value: "week" as const },
                { label: t("insights.period.month"), value: "month" as const },
              ]}
              value={period}
              onChange={(next) => (next === "week" && !isPremium ? setShowPremium(true) : setChosenPeriod(next))}
            />
          </View>
          {showHouseholdScope ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(scope === "you" ? "insights.scope.switchToHousehold" : "insights.scope.switchToYou")}
              onPress={() => setChosenScope(scope === "you" ? "household" : "you")}
              style={({ pressed }) => [styles.scopeChip, pressed && styles.pressed]}
            >
              <ScopeIcon household={scope === "household"} />
              <Text variant="label" color={colors.primary} style={styles.bold}>
                {t(scope === "you" ? "insights.scope.you" : "insights.scope.household")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {summary ? (
        <PeriodSummary
          label={hasMoney ? t("insights.recap.saved") : t("insights.summary.usedUp")}
          value={hasMoney ? formatMoney(summary.moneySaved, currency) : t("insights.summary.items", { count: summary.itemsSaved })}
          sub={sub}
          stats={stats}
          emptyText={summary.isSparse && !hasMoney ? t("insights.recap.empty") : undefined}
          shareLabel={t(period === "week" ? "insights.summary.shareWeekLabel" : "insights.summary.shareMonthLabel")}
          onShare={share}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      <FactList eyebrow={t("insights.highlights.title")} rows={highlights} />

      {!isPremium ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowPremium(true)}
          style={({ pressed }) => [styles.upsell, pressed && styles.pressed]}
        >
          <View style={styles.upsellCopy}>
            <Text variant="label" style={styles.bold}>
              {t("insights.upsell.title")}
            </Text>
            <Text variant="small" color={colors.accentInk}>
              {t("insights.upsell.body")}
            </Text>
          </View>
          <Text variant="label" color={colors.accentInk} style={styles.bold}>
            {t("insights.upsell.action")}
          </Text>
        </Pressable>
      ) : null}

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

      <PremiumSheet visible={showPremium} onPurchased={refresh} onDismiss={() => setShowPremium(false)} />
    </Screen>
  );
}

function ScopeIcon({ household }: { household: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      {household ? (
        <>
          <Circle cx={9} cy={8} r={3.5} stroke={colors.primary} strokeWidth={2.2} />
          <Circle cx={17} cy={9} r={2.5} stroke={colors.primary} strokeWidth={2.2} />
          <Path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5M15 15.5c2.6 0 4.6 1.3 5.5 4" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={12} cy={8} r={4} stroke={colors.primary} strokeWidth={2.2} />
          <Path d="M4 21c1-4 4-6 8-6s7 2 8 6" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

// "2 – 8 Nov": this week, Monday to Sunday.
function weekRangeLabel() {
  const now = new Date();
  const weekday = now.getDay();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday + (weekday === 0 ? -6 : 1));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const start = monday.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  return `${start} – ${sunday.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

// Items used up out of items added in the period.
function usedRate(summary: InsightsSummary) {
  return `${Math.min(100, Math.round((summary.removedItems / summary.itemsAdded) * 100))}%`;
}

function capitalize(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.tabBarClearance,
  },
  header: {
    gap: spacing.md,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  periodControl: {
    flex: 1,
  },
  scopeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.paper,
  },
  loading: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  upsell: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  upsellCopy: {
    flex: 1,
    minWidth: 0,
  },
  bold: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.6,
  },
});
