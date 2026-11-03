import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Share, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";

import {
  DaySheet,
  FoodGroups,
  GoingOffList,
  PremiumSheet,
  Screen,
  SectionTitle,
  SegmentedControl,
  StatTiles,
  Text,
  TopDinners,
  UsedTossedChart,
  WinsList,
} from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { useDaySheet, useHousehold, usePeriodInsights, useWins } from "@/hooks";
import { InventoryCategory, Period, toUiCategory } from "@/services";
import { formatMoney } from "@/lib/money";
import { colors, fonts, radii, spacing } from "@/theme";

type Scope = "you" | "household";

// Insights tells a story about your kitchen, TinyMeals-style: a headline, how
// the period moved, what got used vs tossed, which food groups you finish,
// what keeps going off, your go-to dinners and your wins. One Week / Month
// switch (week is Premium) and one You / Household chip drive it all; every
// section is built from real data and only shows when there's some.
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
  const money = (value: number) => formatMoney(value, currency);

  const { data, refresh: refreshPeriod } = usePeriodInsights(activeHousehold?.id, profile?.id, period, scope);
  const { wins, refresh: refreshWins } = useWins(activeHousehold?.id, profile?.id, scope);
  const { openDay, showDay, closeDay } = useDaySheet(activeHousehold?.id, scope === "you" ? profile?.id : undefined);

  // Cooking happens on other tabs — refetch whenever this tab gains focus.
  useFocusEffect(
    useCallback(() => {
      void refreshPeriod();
      void refreshWins();
    }, [refreshPeriod, refreshWins]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshPeriod(), refreshWins(), refresh()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshPeriod, refreshWins, refresh]);

  const header = (
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
        {header}
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
        {sheets}
      </Screen>
    );
  }

  const { window: span, summary, prevSummary, kitchen, prevKitchen, goingOff } = data;
  const monthName = span.start.toLocaleDateString(undefined, { month: "long" });
  const prevMonthName = span.prevStart.toLocaleDateString(undefined, { month: "long" });
  const prevShort = period === "week" ? t("insights.story.lastWeekShort") : span.prevStart.toLocaleDateString(undefined, { month: "short" });
  const eyebrow =
    period === "week" ? weekRangeLabel(span.start) : span.complete ? monthName : t("insights.story.monthSoFar", { month: monthName });
  const categoryLabel = (category: string) => t(`scan.categories.${category}`);

  // Headline + one sentence on how the period moved and where the waste is.
  const headline =
    kitchen.used > 0
      ? summary.moneySaved > 0
        ? t("insights.story.headlineMoney", { count: kitchen.used, amount: money(summary.moneySaved) })
        : t("insights.story.headline", { count: kitchen.used })
      : t(period === "week" ? "insights.story.emptyWeek" : "insights.story.emptyMonth");
  const usedDiff = kitchen.used - prevKitchen.used;
  const prevName = period === "week" ? t("insights.story.lastWeek") : prevMonthName;
  const subParts = [
    kitchen.used > 0 || prevKitchen.used > 0
      ? usedDiff > 0
        ? t("insights.story.more", { count: usedDiff, prev: prevName })
        : usedDiff < 0
          ? t("insights.story.fewer", { count: -usedDiff, prev: prevName })
          : t("insights.story.same", { prev: prevName })
      : null,
    kitchen.strongest ? t("insights.story.strongest", { category: categoryLabel(kitchen.strongest.category) }) : null,
    kitchen.weakest ? t("insights.story.weakest", { category: categoryLabel(kitchen.weakest.category) }) : null,
  ].filter(Boolean);

  // "+3 vs Oct": shown only when there's something to compare against.
  const delta = (current: number, previous: number, format: (n: number) => string = String) =>
    current === 0 && previous === 0
      ? undefined
      : `${current - previous >= 0 ? "+" : "−"}${format(Math.abs(current - previous))} ${t("insights.story.vs", { prev: prevShort })}`;
  const tiles = [
    {
      value: money(summary.moneySaved),
      label: t("insights.stats.saved"),
      delta: delta(summary.moneySaved, prevSummary.moneySaved, money),
      good: summary.moneySaved > prevSummary.moneySaved,
    },
    { value: String(kitchen.used), label: t("insights.stats.used"), delta: delta(kitchen.used, prevKitchen.used), good: kitchen.used > prevKitchen.used },
    {
      value: String(kitchen.tossed),
      label: t("insights.stats.tossed"),
      delta: delta(kitchen.tossed, prevKitchen.tossed),
      good: kitchen.tossed < prevKitchen.tossed,
      danger: kitchen.tossed > 0,
    },
  ];

  // Chart: days of the week, or 7-day runs of the month. A running period's
  // `until` is when it loaded, so the bucket holding it is the current one.
  const loadedAt = span.until.getTime() - 1;
  const bars = span.buckets.map((bucket, index) => ({
    label: period === "week" ? bucket.start.toLocaleDateString(undefined, { weekday: "narrow" }) : String(bucket.start.getDate()),
    used: kitchen.chart[index].used,
    tossed: kitchen.chart[index].tossed,
    current: !span.complete && loadedAt >= bucket.start.getTime() && loadedAt < bucket.end.getTime(),
  }));
  const bestIndex = kitchen.chart.reduce((best, bar, index) => (bar.used > kitchen.chart[best].used ? index : best), 0);
  const best = kitchen.chart[bestIndex].used
    ? period === "week"
      ? span.buckets[bestIndex].start.toLocaleDateString(undefined, { weekday: "long" })
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
    const counts = { month: monthName, items: kitchen.used, dinners: summary.cookedEvents };
    const key = `insights.share.${period}${summary.moneySaved > 0 ? "Money" : ""}`;
    void Share.share({ message: t(key, { ...counts, amount: money(summary.moneySaved) }) });
  };

  return (
    <Screen scroll contentContainerStyle={styles.content} refreshControl={refreshControl}>
      <View style={styles.story}>
        <Text variant="micro" muted uppercase>
          {eyebrow}
        </Text>
        <Text variant="h1" accessibilityRole="header">
          {headline}
        </Text>
        {subParts.length > 0 ? (
          <Text variant="body" muted>
            {subParts.join(" ")}
          </Text>
        ) : null}
      </View>

      {header}

      <StatTiles tiles={tiles} />

      {isPremium ? (
        <>
          {hasChart ? (
            <View style={styles.section}>
              <SectionTitle title={t(period === "week" ? "insights.chart.titleWeek" : "insights.chart.titleMonth")} />
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
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setShowPremium(true)} style={({ pressed }) => [styles.lock, pressed && styles.pressed]}>
          <View style={styles.lockCopy}>
            <Text variant="label" style={styles.bold}>
              {t("insights.lock.title")}
            </Text>
            <Text variant="small" color={colors.accentInk}>
              {t("insights.lock.body")}
            </Text>
          </View>
          <Text variant="label" color={colors.accentInk} style={styles.bold}>
            {t("insights.lock.action")}
          </Text>
        </Pressable>
      )}

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

      {kitchen.used > 0 ? (
        <Pressable accessibilityRole="button" onPress={share} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
          <ShareIcon />
          <Text variant="label" color={colors.primary} style={styles.bold}>
            {t(period === "week" ? "insights.share.weekLabel" : "insights.share.monthLabel")}
          </Text>
        </Pressable>
      ) : null}

      {sheets}
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

function ShareIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// "2 – 8 Nov": the week starting on `monday`.
function weekRangeLabel(monday: Date) {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const start = monday.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  return `${start} – ${sunday.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

function capitalize(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.tabBarClearance,
  },
  story: {
    gap: spacing.xs,
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
  section: {
    gap: spacing.sm,
  },
  loading: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  lock: {
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
  lockCopy: {
    flex: 1,
    minWidth: 0,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.paper,
  },
  bold: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.6,
  },
});
