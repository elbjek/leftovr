import { useCallback, useState } from "react";
import { Alert, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import {
  DaySheet,
  EmptyNote,
  FoodGroups,
  FoodLoader,
  GoingOffList,
  HouseholdPill,
  HouseholdSheet,
  LockedCard,
  Logo,
  PeriodSummary,
  PremiumSheet,
  Screen,
  SectionTitle,
  ShareStatsSheet,
  Tappable,
  Text,
  TopDinners,
  UsageCalendar,
  WinsList,
} from "@/components";
import { isPremium as resolvePremium, openSavedRecipe, useAuth } from "@/features";
import { getRecipeRow } from "@/repositories/recipeRepository";
import type { Delta, ShareLook } from "@/components";
import { useDaySheet, useInventory, usePeriodInsights, useStreak, useWins } from "@/hooks";
import { InventoryCategory, Period, periodAnchor, periodWindow, toUiCategory } from "@/services";
import { formatMoney } from "@/lib/money";
import { colors, radii, shadows, spacing } from "@/theme";

const PERIODS: Period[] = ["week", "month", "year"];

// Insights tells a story about your kitchen, TinyMeals-style: what the period
// saved, what got used vs tossed, which food groups you finish, what keeps
// going off, your go-to dinners and your wins — always the whole kitchen.
// Same top as the home (logo + pill, here the period "This month ▾"), then a
// headline. Every section always shows, with a friendly line when it has no
// data yet. Premium only: free accounts see a placeholder summary dimmed
// under an Unlock card.
export default function InsightsRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const isPremium = resolvePremium(profile, activeHousehold);
  const [showPremium, setShowPremium] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  // 0 = the running week / month / year, -1 = the one before it, and so on.
  const [offset, setOffset] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [householdOpen, setHouseholdOpen] = useState(false);
  const { lots: inventory } = useInventory(activeHousehold?.id);
  // Household pill initial: first name when usable (not blank, not an email).
  const rawName = profile?.display_name?.trim() ?? "";
  const firstName = rawName && !rawName.includes("@") ? rawName.split(/\s+/)[0] : "";
  const scope = "household" as const;
  const currency = activeHousehold?.currency_code ?? "USD";
  const money = (value: number) => formatMoney(value, currency);

  const { data, refresh: refreshPeriod } = usePeriodInsights(activeHousehold?.id, profile?.id, period, scope, true, offset);
  const { wins, refresh: refreshWins } = useWins(activeHousehold?.id, profile?.id, scope);
  const { openDay, showDay, closeDay } = useDaySheet(activeHousehold?.id, undefined);
  const { streak, days: streakDays, refresh: refreshStreak } = useStreak(activeHousehold?.id);

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

  // The period on show, named: "This week / month / year" while it is the
  // running one; an earlier one by its month (with the year once it isn't
  // this one), its dates or its year.
  const shown = periodWindow(period, periodAnchor(period, offset));
  const dayMonth = (date: Date) => date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const periodTitle =
    offset === 0
      ? t(`insights.period.this.${period}`)
      : period === "month"
        ? capitalize(shown.start.toLocaleDateString(undefined, shown.start.getFullYear() === new Date().getFullYear() ? { month: "long" } : { month: "long", year: "numeric" }))
        : period === "year"
          ? String(shown.start.getFullYear())
          : `${dayMonth(shown.start)} – ${dayMonth(shown.until)}`;

  // Same top as the home: logo left, household pill right. Under it Week /
  // Month / Year as plain text tabs (the active one underlined) with share on
  // the right, then the period's name with arrows that walk back to earlier
  // ones (and forward again, up to now).
  const header = (onShare?: () => void) => (
    <View style={styles.top}>
      <View style={styles.header}>
        <Logo size={26} />
        {activeHousehold ? (
          <HouseholdPill
            name={activeHousehold.name}
            initial={firstName || activeHousehold.name}
            label={t("settings.household.openSheet", { name: activeHousehold.name })}
            onPress={() => setHouseholdOpen(true)}
          />
        ) : null}
      </View>
      {isPremium ? (
        <>
          <View style={styles.header}>
            <View style={styles.tabs} accessibilityRole="tablist">
              {PERIODS.map((option) => {
                const active = option === period;
                return (
                  <Tappable
                    key={option}
                    role="tab"
                    selected={active}
                    onPress={() => {
                      setPeriod(option);
                      setOffset(0);
                    }}
                    hitSlop={0}
                    style={styles.tab}
                  >
                    <Text variant="label" color={active ? colors.text : colors.muted}>
                      {t(`insights.period.${option}`)}
                    </Text>
                    <View style={[styles.tabLine, active && styles.tabLineActive]} />
                  </Tappable>
                );
              })}
            </View>
            {onShare ? (
              <Tappable label={t(`insights.share.${period}Label`)} onPress={onShare} hitSlop={4} style={styles.share}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Tappable>
            ) : null}
          </View>
          <View style={styles.header}>
            <Text variant="h3" numberOfLines={1} accessibilityRole="header" style={styles.periodTitle}>
              {periodTitle}
            </Text>
            <View style={styles.steps}>
              <Tappable label={t("insights.period.previous")} onPress={() => setOffset(offset - 1)} hitSlop={0} style={styles.step}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 5l-7 7 7 7" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Tappable>
              <Tappable label={t("insights.period.next")} disabled={offset === 0} onPress={() => setOffset(offset + 1)} hitSlop={0} style={styles.step}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 5l7 7-7 7" stroke={offset === 0 ? colors.muted2 : colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Tappable>
            </View>
          </View>
        </>
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
      <HouseholdSheet visible={householdOpen} onClose={() => setHouseholdOpen(false)} itemCount={inventory.length} />
    </>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
  );

  // Free accounts get one screen, no scrolling: the header and the Unlock
  // card centred in the space below it (2026-11-12: the blurred summary
  // preview made the page long for nothing).
  if (!isPremium) {
    return (
      <Screen bottomInset={false} contentContainerStyle={styles.lockScreen}>
        {header()}
        <View style={styles.lockCenter}>
          <LockedCard
            title={t("insights.lock.title")}
            body={t("insights.lock.body")}
            points={["money", "waste", "share"].map((point) => t(`insights.lock.points.${point}`))}
            action={t("insights.lock.action")}
            onPress={() => setShowPremium(true)}
          />
        </View>
        {sheets}
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen scroll bottomInset={false} contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {header()}
        <View style={styles.loading}>
          <FoodLoader />
        </View>
        {sheets}
      </Screen>
    );
  }

  const { window: span, summary, prevSummary, kitchen, prevKitchen, goingOff } = data;
  const monthName = span.start.toLocaleDateString(undefined, { month: "long" });
  const categoryLabel = (category: string) => t(`scan.categories.${category}`);

  // "€2.10 more than last week"; with no prices at all, how to get one.
  const savedDiff = summary.moneySaved - prevSummary.moneySaved;
  const prevName =
    period === "month"
      ? span.prevStart.toLocaleDateString(undefined, { month: "long" })
      : offset === 0
        ? t(period === "week" ? "insights.story.lastWeek" : "insights.story.lastYear")
        : period === "year"
          ? String(span.prevStart.getFullYear())
          : t("insights.chart.weekOf", { date: dayMonth(span.prevStart) });
  const isEmpty = kitchen.used === 0 && summary.cookedEvents === 0;
  // "+3" / "−€2.10" against the period before; nothing when it didn't move.
  // Fewer tossed is the good direction.
  const delta = (diff: number, label: string, lowerIsBetter = false): Delta | undefined =>
    diff === 0 ? undefined : { label: `${diff > 0 ? "+" : "−"}${label}`, direction: diff > 0 ? "up" : "down", good: diff > 0 !== lowerIsBetter };
  const cookedDiff = summary.cookedEvents - prevSummary.cookedEvents;
  const tossedDiff = kitchen.tossed - prevKitchen.tossed;

  // One line on how the period moved against the one before.
  const usedDiff = kitchen.used - prevKitchen.used;
  const storyLine =
    kitchen.used > 0 || prevKitchen.used > 0
      ? usedDiff > 0
        ? t("insights.story.more", { count: usedDiff, prev: prevName })
        : usedDiff < 0
          ? t("insights.story.fewer", { count: -usedDiff, prev: prevName })
          : t("insights.story.same", { prev: prevName })
      : t("insights.story.start");
  // Calendar: a cell per day (week, month) or per month (year). A running
  // period's `until` is when it loaded; cells after it haven't happened yet.
  const cells = span.buckets.map((bucket, index) => ({
    label:
      period === "week"
        ? bucket.start.toLocaleDateString(undefined, { weekday: "narrow" })
        : period === "year"
          ? bucket.start.toLocaleDateString(undefined, { month: "short" })
          : String(bucket.start.getDate()),
    used: kitchen.chart[index].used,
    tossed: kitchen.chart[index].tossed,
    future: bucket.start.getTime() > span.until.getTime(),
  }));
  // A month grid starts on Monday: blank cells up to the 1st, weekday letters on top.
  const leadIn = period === "month" ? (span.start.getDay() + 6) % 7 : 0;
  const calendarCells = [...Array.from({ length: leadIn }, () => ({ label: "", used: 0, tossed: 0 })), ...cells];
  const weekdays =
    period === "month"
      ? Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" })) // 1 Jan 2024 was a Monday
      : undefined;
  const bestIndex = kitchen.chart.reduce((best, bar, index) => (bar.used > kitchen.chart[best].used ? index : best), 0);
  const best = kitchen.chart[bestIndex].used
    ? span.buckets[bestIndex].start.toLocaleDateString(
        undefined,
        period === "week" ? { weekday: "long" } : period === "year" ? { month: "long" } : { weekday: "short", day: "numeric" },
      )
    : null;
  const hasFinished = kitchen.used + kitchen.tossed > 0;

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
  // Tapping a dinner loads that recipe and opens it; Back returns here.
  const openDinner = async (recipeId: string) => {
    try {
      const row = await getRecipeRow(recipeId);
      if (row) openSavedRecipe(row, "insights");
      else Alert.alert(t("common.error"));
    } catch {
      Alert.alert(t("common.error"));
    }
  };
  const dinners = summary.cookedRecipes.map((recipe) => ({
    title: recipe.title,
    detail: t("insights.dinners.times", { count: recipe.count }),
    onPress: () => void openDinner(recipe.recipeId),
  }));

  // Each card is a receipt of its own kind — a list of what was rescued, a
  // column of totals, a punched streak, a menu — and is offered only when it
  // has something to print. The first one opens.
  const receiptTitle = t(`insights.share.receipt.${period}`, { month: monthName, year: span.start.getFullYear() });
  const captionCounts = { month: monthName, year: span.start.getFullYear(), items: kitchen.used, dinners: summary.cookedEvents };
  const caption = t(`insights.share.${period}${summary.moneySaved > 0 ? "Money" : ""}`, { ...captionCounts, amount: money(summary.moneySaved) });
  const receiptHead = { kicker: t("insights.share.receipt.kicker"), title: receiptTitle, footnote: t("insights.share.receipt.footnote") };
  const usedTotal = { label: t("insights.share.receipt.itemsUsed"), value: String(kitchen.used) };
  const cookedTotal = { label: t("insights.share.receipt.dinners"), value: String(summary.cookedEvents) };
  const streakTotal = { label: t("insights.share.receipt.streak"), value: String(streak) };
  const looks: (ShareLook | null)[] = [
    kitchen.used > 0
      ? {
          id: "rescued",
          label: t("insights.share.looks.rescued"),
          caption,
          card: {
            ...receiptHead,
            kind: "items",
            items: data.usedFoods,
            more: (count: number) => t("insights.share.receipt.more", { count }),
            hero: { label: t("insights.share.receipt.rescued"), value: String(kitchen.used) },
          },
        }
      : null,
    summary.moneySaved > 0
      ? {
          id: "saved",
          label: t("insights.share.looks.saved"),
          caption,
          card: {
            ...receiptHead,
            kind: "totals",
            totals: [usedTotal, cookedTotal, streakTotal],
            hero: { label: t("insights.share.receipt.totalSaved"), value: money(summary.moneySaved) },
          },
        }
      : null,
    streak > 0
      ? {
          id: "streak",
          label: t("insights.share.looks.streak"),
          caption,
          card: {
            ...receiptHead,
            kind: "streak",
            days: streak,
            daysLabel: t("insights.share.receipt.daysLabel"),
            totals: [usedTotal, cookedTotal],
            hero: { label: t("insights.share.receipt.streak"), value: String(streak) },
          },
        }
      : null,
    dinners.length > 0
      ? {
          id: "dinners",
          label: t("insights.share.looks.dinners"),
          caption,
          card: {
            ...receiptHead,
            kind: "menu",
            dishes: dinners,
            totals: [usedTotal, streakTotal],
            hero: { label: t("insights.share.receipt.dinners"), value: String(summary.cookedEvents) },
          },
        }
      : null,
  ];
  const shownLooks = looks.filter((look): look is ShareLook => look !== null);

  const shareSheet =
    shownLooks.length > 0 ? (
      <ShareStatsSheet
        visible={showShare}
        onDismiss={() => setShowShare(false)}
        title={t("insights.share.sheetTitle")}
        looks={shownLooks}
        labels={{ post: t("insights.share.post"), story: t("insights.share.story"), share: t("insights.share.action") }}
      />
    ) : null;

  const summaryCard = (
    <PeriodSummary
      rescued={{ label: t("insights.share.looks.rescued"), value: String(kitchen.used), sub: storyLine }}
      trend={usedDiff > 0 ? "up" : usedDiff < 0 ? "down" : undefined}
      foods={data.usedFoods}
      saved={{
        label: t("insights.stats.saved"),
        value: money(summary.moneySaved),
        delta: delta(savedDiff, money(Math.abs(savedDiff))),
        // With no prices in either period, how to get one.
        sub: summary.moneySaved > 0 || prevSummary.moneySaved > 0 ? undefined : t("insights.summary.noPrice"),
      }}
      dinners={{ label: t("insights.share.looks.dinners"), value: String(summary.cookedEvents), delta: delta(cookedDiff, String(Math.abs(cookedDiff))) }}
      tossed={{ label: t("insights.stats.tossed"), value: String(kitchen.tossed), delta: delta(tossedDiff, String(Math.abs(tossedDiff)), true) }}
      streak={{ label: t("insights.share.looks.streak"), value: t("insights.summary.days", { count: streak }) }}
      streakDays={streakDays.map((day) => day.state !== "none")}
    />
  );

  return (
    <Screen scroll bottomInset={false} contentContainerStyle={styles.content} refreshControl={refreshControl}>
      {header(shareSheet && !isEmpty && !(period === "week" && offset < 0) ? () => setShowShare(true) : undefined)}

      {summaryCard}

      <View style={styles.section}>
        <SectionTitle title={t(`insights.chart.title.${period}`)} aside={best ? t("insights.chart.best", { label: best }) : undefined} />
        <UsageCalendar
          cells={calendarCells}
          columns={period === "year" ? 6 : 7}
          head={weekdays}
          legend={{
            used: t("insights.chart.legendUsed", { count: kitchen.used }),
            tossed: t("insights.chart.legendTossed", { count: kitchen.tossed }),
            less: t("insights.chart.less"),
            more: t("insights.chart.more"),
          }}
          label={t("insights.chart.spoken", { used: kitchen.used, tossed: kitchen.tossed })}
        />
      </View>

      <View style={styles.section}>
        <SectionTitle title={t("insights.groups.title")} aside={groupRows.length > 0 ? t("insights.groups.aside") : undefined} />
        {groupRows.length > 0 ? (
          <FoodGroups rows={groupRows} weakLabel={t("insights.goingOff.watch")} tip={kitchen.weakest ? t(`insights.tips.${kitchen.weakest.category}`) : undefined} />
        ) : (
          <EmptyNote text={t("insights.groups.empty")} />
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle title={t("insights.goingOff.title")} caption={goingOffRows.length > 0 ? t("insights.goingOff.caption") : undefined} />
        {goingOffRows.length > 0 ? (
          <GoingOffList rows={goingOffRows} />
        ) : (
          <EmptyNote text={t(hasFinished ? "insights.goingOff.none" : "insights.goingOff.empty")} good={hasFinished} />
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle
          title={t("insights.dinners.title")}
          aside={summary.cookedEvents > 0 ? `${summary.cookedEvents} ${t("insights.summary.cooked", { count: summary.cookedEvents })}` : undefined}
        />
        {dinners.length > 0 ? <TopDinners dinners={dinners} /> : <EmptyNote text={t("insights.dinners.empty")} />}
      </View>

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

      {shareSheet}
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
    gap: spacing.sm,
    zIndex: 10,
  },
  // Same header as the home (recipes.tsx): logo left, pill right.
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  tab: {
    height: 44,
    justifyContent: "center",
    gap: spacing.xxs,
  },
  // Always there so the labels don't jump; only the active one is coloured.
  tabLine: {
    height: 3,
    borderRadius: radii.pill,
  },
  tabLineActive: {
    backgroundColor: colors.primary,
  },
  periodTitle: {
    flex: 1,
    minWidth: 0,
  },
  steps: {
    flexDirection: "row",
  },
  step: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  share: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  section: {
    gap: spacing.sm,
  },
  loading: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  // Free accounts: one screen, the LockedCard centred under the header.
  lockScreen: {
    paddingBottom: spacing.xl,
  },
  lockCenter: {
    flex: 1,
    justifyContent: "center",
  },
});
