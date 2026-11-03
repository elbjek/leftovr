import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Share, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import {
  Button,
  DaySheet,
  FoodGroups,
  GoingOffList,
  PeriodSummary,
  PremiumSheet,
  Screen,
  SectionTitle,
  Text,
  TopDinners,
  UsedTossedChart,
  WinsList,
} from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { useDaySheet, usePeriodInsights, useStreak, useWins } from "@/hooks";
import { InventoryCategory, Period, toUiCategory } from "@/services";
import { formatMoney } from "@/lib/money";
import { colors, fonts, radii, spacing } from "@/theme";

const PERIODS: Period[] = ["week", "month", "year"];

// Insights tells a story about your kitchen, TinyMeals-style: what the period
// saved, what got used vs tossed, which food groups you finish, what keeps
// going off, your go-to dinners and your wins — always the whole kitchen.
// The period is picked from the title ("This month ▾"). Premium only: free
// accounts see their summary dimmed under an Unlock card.
export default function InsightsRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const isPremium = resolvePremium(profile, activeHousehold);
  const [showPremium, setShowPremium] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [menuOpen, setMenuOpen] = useState(false);
  const scope = "household" as const;
  const currency = activeHousehold?.currency_code ?? "USD";
  const money = (value: number) => formatMoney(value, currency);

  const { data, refresh: refreshPeriod } = usePeriodInsights(activeHousehold?.id, profile?.id, period, scope);
  const { wins, refresh: refreshWins } = useWins(activeHousehold?.id, profile?.id, scope);
  const { openDay, showDay, closeDay } = useDaySheet(activeHousehold?.id, undefined);
  const { streak, refresh: refreshStreak } = useStreak(activeHousehold?.id);

  // Cooking happens on other tabs — refetch whenever this tab gains focus.
  useFocusEffect(
    useCallback(() => {
      void refreshPeriod();
      void refreshWins();
      void refreshStreak();
    }, [refreshPeriod, refreshWins, refreshStreak]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshPeriod(), refreshWins(), refreshStreak(), refresh()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshPeriod, refreshWins, refreshStreak, refresh]);

  // "This month ▾": tapping opens Week / Month / Year right under it.
  const periodPicker = (label: string) => (
    <View style={styles.picker}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: menuOpen }}
        accessibilityLabel={t("insights.period.change", { period: label })}
        onPress={() => setMenuOpen((open) => !open)}
        hitSlop={8}
        style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
      >
        <Text variant="micro" color={colors.primary} uppercase style={styles.bold}>
          {label}
        </Text>
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" style={menuOpen ? styles.chevronOpen : undefined}>
          <Path d="M6 9l6 6 6-6" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      {menuOpen ? (
        <View style={styles.menu}>
          {PERIODS.map((option, index) => (
            <Pressable
              key={option}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: option === period }}
              onPress={() => {
                setPeriod(option);
                setMenuOpen(false);
              }}
              style={({ pressed }) => [styles.menuRow, index > 0 && styles.menuDivider, pressed && styles.pressed]}
            >
              <Text variant="body" style={option === period ? styles.bold : undefined}>
                {t(`insights.period.${option}`)}
              </Text>
              {option === period ? (
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  const sheets = (
    <>
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
        saved={openDay?.activity && openDay.activity.moneySaved > 0 ? t("recipes.week.saved", { amount: money(openDay.activity.moneySaved) }) : undefined}
        labels={{ cooked: t("recipes.week.dayCooked"), used: t("recipes.week.dayUsed"), empty: t("recipes.week.dayEmpty") }}
      />
      <PremiumSheet visible={showPremium} onPurchased={refresh} onDismiss={() => setShowPremium(false)} />
    </>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
  );

  if (!data) {
    return (
      <Screen scroll contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <Text variant="h1">{t("insights.title")}</Text>
        {isPremium ? periodPicker(t(`insights.period.this.${period}`)) : null}
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
        {sheets}
      </Screen>
    );
  }

  const { window: span, summary, prevSummary, kitchen, goingOff } = data;
  const monthName = span.start.toLocaleDateString(undefined, { month: "long" });
  const periodLabel = span.complete ? monthName : t(`insights.period.this.${period}`);
  const categoryLabel = (category: string) => t(`scan.categories.${category}`);

  // "€2.10 more than last week": only when either period saved something.
  const savedDiff = summary.moneySaved - prevSummary.moneySaved;
  const prevName =
    period === "week"
      ? t("insights.story.lastWeek")
      : period === "year"
        ? t("insights.story.lastYear")
        : span.prevStart.toLocaleDateString(undefined, { month: "long" });
  const savedSub =
    summary.moneySaved > 0 || prevSummary.moneySaved > 0
      ? savedDiff > 0
        ? t("insights.summary.more", { amount: money(savedDiff), prev: prevName })
        : savedDiff < 0
          ? t("insights.summary.less", { amount: money(-savedDiff), prev: prevName })
          : t("insights.summary.same", { prev: prevName })
      : undefined;
  const isEmpty = kitchen.used === 0 && summary.cookedEvents === 0;

  // Chart: days of the week, or 7-day runs of the month. A running period's
  // `until` is when it loaded, so the bucket holding it is the current one.
  const loadedAt = span.until.getTime() - 1;
  const bars = span.buckets.map((bucket, index) => ({
    label:
      period === "week"
        ? bucket.start.toLocaleDateString(undefined, { weekday: "narrow" })
        : period === "year"
          ? bucket.start.toLocaleDateString(undefined, { month: "narrow" })
          : String(bucket.start.getDate()),
    used: kitchen.chart[index].used,
    tossed: kitchen.chart[index].tossed,
    current: !span.complete && loadedAt >= bucket.start.getTime() && loadedAt < bucket.end.getTime(),
  }));
  const bestIndex = kitchen.chart.reduce((best, bar, index) => (bar.used > kitchen.chart[best].used ? index : best), 0);
  const best = kitchen.chart[bestIndex].used
    ? period === "week"
      ? span.buckets[bestIndex].start.toLocaleDateString(undefined, { weekday: "long" })
      : period === "year"
        ? span.buckets[bestIndex].start.toLocaleDateString(undefined, { month: "long" })
        : t("insights.chart.weekOf", { date: span.buckets[bestIndex].start.toLocaleDateString(undefined, { day: "numeric", month: "short" }) })
    : null;
  const hasChart = kitchen.used + kitchen.tossed > 0;

  const groupRows = kitchen.groups.map((group) => ({
    category: group.category,
    label: categoryLabel(group.category),
    detail: group.tossed > 0 ? t("insights.groups.usedTossed", { used: group.used, tossed: group.tossed }) : t("insights.groups.used", { count: group.used }),
    share: group.used / (group.used + group.tossed),
    weak: group.category === kitchen.weakest?.category,
  }));
  const goingOffRows = goingOff.map((food) => {
    const name = capitalize(food.name);
    const detail = t("insights.goingOff.detail", { tossed: food.tossed, total: food.outcomes.length });
    return { name, category: food.category, detail, outcomes: food.outcomes, label: `${name}: ${detail}` };
  });
  const dinners = summary.cookedRecipes.map((recipe) => ({ title: recipe.title, detail: t("insights.dinners.times", { count: recipe.count }) }));

  const share = () => {
    const counts = { month: monthName, year: span.start.getFullYear(), items: kitchen.used, dinners: summary.cookedEvents };
    const key = `insights.share.${period}${summary.moneySaved > 0 ? "Money" : ""}`;
    void Share.share({ message: t(key, { ...counts, amount: money(summary.moneySaved) }) });
  };

  const summaryCard = (
    <PeriodSummary
      label={t("insights.stats.saved")}
      value={summary.moneySaved > 0 ? money(summary.moneySaved) : undefined}
      sub={savedSub}
      stats={[
        { value: String(kitchen.used), label: t("insights.summary.used", { count: kitchen.used }) },
        { value: String(summary.cookedEvents), label: t("insights.summary.cooked", { count: summary.cookedEvents }) },
        { value: String(streak), label: t("insights.summary.streak", { count: streak }) },
      ]}
      emptyText={isEmpty ? t(`insights.summary.empty.${period}`) : undefined}
      shareLabel={t(`insights.share.${period}Label`)}
      onShare={share}
    />
  );

  if (!isPremium) {
    return (
      <Screen scroll contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <Text variant="h1" accessibilityRole="header">
          {t("insights.title")}
        </Text>
        <View style={styles.preview} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {summaryCard}
        </View>
        <View style={styles.lock}>
          <Text variant="h2">{t("insights.lock.title")}</Text>
          <Text variant="body" color={colors.accentInk}>
            {t("insights.lock.body")}
          </Text>
          <Button title={t("insights.lock.action")} onPress={() => setShowPremium(true)} />
        </View>
        {sheets}
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.content} refreshControl={refreshControl}>
      <View style={styles.top}>
        <Text variant="h1" accessibilityRole="header">
          {t("insights.title")}
        </Text>
        {periodPicker(periodLabel)}
      </View>

      {summaryCard}

      <>
          {hasChart ? (
            <View style={styles.section}>
              <SectionTitle title={t(`insights.chart.title.${period}`)} />
              <UsedTossedChart
                title={t("insights.chart.usedVsTossed")}
                aside={best ? t("insights.chart.best", { label: best }) : undefined}
                bars={bars}
                legend={{ used: t("insights.stats.used"), tossed: t("insights.stats.tossed") }}
                label={t("insights.chart.spoken", { used: kitchen.used, tossed: kitchen.tossed })}
              />
            </View>
          ) : null}

          {groupRows.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle title={t("insights.groups.title")} aside={t("insights.groups.aside")} />
              <FoodGroups rows={groupRows} tip={kitchen.weakest ? t(`insights.tips.${kitchen.weakest.category}`) : undefined} />
            </View>
          ) : null}

          {goingOffRows.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle title={t("insights.goingOff.title")} caption={t("insights.goingOff.caption")} />
              <GoingOffList rows={goingOffRows} />
            </View>
          ) : null}
        </>

      {dinners.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle title={t("insights.dinners.title")} />
          <TopDinners dinners={dinners} />
        </View>
      ) : null}

      <WinsList
        eyebrow={t("insights.wins.eyebrow")}
        showAllLabel={t("insights.wins.showAll", { count: wins.length })}
        days={wins.map((day) => ({
          key: day.date.toDateString(),
          date: day.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
          title: day.itemsUsed > 0 ? t("insights.wins.saved", { count: day.itemsUsed }) : t("insights.wins.cookedOnly"),
          detail: day.cooked.length > 0 ? day.cooked.join(", ") : undefined,
          money: day.moneySaved > 0 ? money(day.moneySaved) : undefined,
          onPress: () => void showDay(day.date),
        }))}
      />

      {sheets}
    </Screen>
  );
}

function capitalize(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.tabBarClearance,
  },
  top: {
    gap: spacing.xs,
  },
  picker: {
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  menu: {
    alignSelf: "stretch",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.paper,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  menuDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardLine,
  },
  section: {
    gap: spacing.sm,
  },
  loading: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  // Free accounts see their own summary faded behind the Unlock card.
  preview: {
    opacity: 0.35,
  },
  lock: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  bold: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.6,
  },
});
