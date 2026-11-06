import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import {
  Button,
  DaySheet,
  EmptyNote,
  FoodGroups,
  GoingOffList,
  Logo,
  PeriodSummary,
  PremiumSheet,
  Screen,
  SectionTitle,
  ShareStatsSheet,
  StoryCard,
  Tappable,
  Text,
  TopDinners,
  UsedTossedChart,
  WinsList,
} from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import type { ShareLook } from "@/components";
import { useDaySheet, usePeriodInsights, useStreak, useWins } from "@/hooks";
import { InventoryCategory, Period, toUiCategory } from "@/services";
import { formatMoney } from "@/lib/money";
import { colors, radii, spacing } from "@/theme";

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
  const [showShare, setShowShare] = useState(false);
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

  // Logo on the left as on the home, and the period as a segmented control
  // right under it: three visible choices instead of a dropdown.
  const header = () => (
    <View style={styles.top}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Logo size={26} />
          {isPremium ? <View style={styles.premiumDot} /> : null}
        </View>
      </View>
      {isPremium ? (
        <View style={styles.segmented} accessibilityRole="tablist">
          {PERIODS.map((option) => (
            <Tappable
              key={option}
              role="tab"
              selected={option === period}
              label={t(`insights.period.${option}`)}
              onPress={() => setPeriod(option)}
              hitSlop={0}
              style={[styles.segment, option === period && styles.segmentOn]}
            >
              <Text variant="label" weight="bold" color={option === period ? colors.primary : colors.muted}>
                {t(`insights.period.${option}`)}
              </Text>
            </Tappable>
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

  // Free accounts see the summary's shape under the Unlock card, never their
  // own figures: every number is a placeholder.
  if (!isPremium) {
    return (
      <Screen scroll contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {header()}
        <View style={styles.preview} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <PeriodSummary
            label={t("insights.stats.saved")}
            value="••••"
            stats={["used", "cooked", "streak"].map((key) => ({ value: "–", label: t(`insights.summary.${key}`, { count: 5 }) }))}
            shareLabel={t(`insights.share.${period}Label`)}
            onShare={() => {}}
          />
        </View>
        <View style={styles.lock}>
          <View style={styles.lockSeal}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4.5 10h15v10.5h-15zM8.2 10V7.6a3.8 3.8 0 017.6 0V10"
                stroke={colors.accentInk}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text variant="h2">{t("insights.lock.title")}</Text>
          <Text variant="body" muted>
            {t("insights.lock.body")}
          </Text>
          <View style={styles.lockPoints}>
            {["money", "waste", "share"].map((point) => (
              <View key={point} style={styles.lockPoint}>
                <View style={styles.lockTick}>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.primary} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text variant="label" style={styles.lockPointText}>
                  {t(`insights.lock.points.${point}`)}
                </Text>
              </View>
            ))}
          </View>
          <Button title={t("insights.lock.action")} onPress={() => setShowPremium(true)} />
        </View>
        {sheets}
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen scroll contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {header()}
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
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
      : t("insights.summary.noPrice");
  const isEmpty = kitchen.used === 0 && summary.cookedEvents === 0;

  // TinyMeals-style headline and one line on how it moved and where the waste is.
  const headline =
    kitchen.used > 0 ? t(`insights.story.headline.${period}`, { count: kitchen.used }) : t(`insights.story.empty.${period}`);
  const usedDiff = kitchen.used - prevKitchen.used;
  const storyLine =
    kitchen.used > 0 || prevKitchen.used > 0
      ? usedDiff > 0
        ? t("insights.story.more", { count: usedDiff, prev: prevName })
        : usedDiff < 0
          ? t("insights.story.fewer", { count: -usedDiff, prev: prevName })
          : t("insights.story.same", { prev: prevName })
      : t("insights.story.start");
  // The two group verdicts read as chips under the line, not as more sentences.
  const storyChips = [
    kitchen.strongest ? { text: t("insights.story.chipStrong", { category: categoryLabel(kitchen.strongest.category) }) } : null,
    kitchen.weakest ? { text: t("insights.story.chipWeak", { category: categoryLabel(kitchen.weakest.category) }), weak: true } : null,
  ].filter((chip): chip is { text: string; weak?: boolean } => chip !== null);

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
    current: loadedAt >= bucket.start.getTime() && loadedAt < bucket.end.getTime(),
  }));
  const bestIndex = kitchen.chart.reduce((best, bar, index) => (bar.used > kitchen.chart[best].used ? index : best), 0);
  const best = kitchen.chart[bestIndex].used
    ? period === "week"
      ? span.buckets[bestIndex].start.toLocaleDateString(undefined, { weekday: "long" })
      : period === "year"
        ? span.buckets[bestIndex].start.toLocaleDateString(undefined, { month: "long" })
        : t("insights.chart.weekOf", { date: span.buckets[bestIndex].start.toLocaleDateString(undefined, { day: "numeric", month: "short" }) })
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
  const dinners = summary.cookedRecipes.map((recipe) => ({ title: recipe.title, detail: t("insights.dinners.times", { count: recipe.count }) }));

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
      label={t("insights.stats.saved")}
      value={money(summary.moneySaved)}
      sub={savedSub}
      stats={[
        { value: String(kitchen.used), label: t("insights.summary.used", { count: kitchen.used }) },
        { value: String(summary.cookedEvents), label: t("insights.summary.cooked", { count: summary.cookedEvents }) },
        { value: String(streak), label: t("insights.summary.streak", { count: streak }) },
      ]}
      emptyText={isEmpty ? t(`insights.summary.empty.${period}`) : undefined}
      shareLabel={t(`insights.share.${period}Label`)}
      onShare={() => setShowShare(true)}
    />
  );

  return (
    <Screen scroll contentContainerStyle={styles.content} refreshControl={refreshControl}>
      {header()}

      {summaryCard}

      <StoryCard title={headline} body={storyLine} chips={storyChips} />

      <View style={styles.section}>
        <SectionTitle title={t(`insights.chart.title.${period}`)} />
        <UsedTossedChart
          title={t("insights.chart.usedVsTossed")}
          aside={best ? t("insights.chart.best", { label: best }) : undefined}
          bars={bars}
          legend={{
            used: t("insights.chart.legendUsed", { count: kitchen.used }),
            tossed: t("insights.chart.legendTossed", { count: kitchen.tossed }),
          }}
          label={t("insights.chart.spoken", { used: kitchen.used, tossed: kitchen.tossed })}
        />
      </View>

      <View style={styles.section}>
        <SectionTitle title={t("insights.groups.title")} aside={groupRows.length > 0 ? t("insights.groups.aside") : undefined} />
        {groupRows.length > 0 ? (
          <FoodGroups rows={groupRows} tip={kitchen.weakest ? t(`insights.tips.${kitchen.weakest.category}`) : undefined} />
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
        <SectionTitle title={t("insights.dinners.title")} />
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
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  premiumDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
  },
  // Week / Month / Year, all three visible.
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  segmentOn: {
    backgroundColor: colors.surface,
  },
  section: {
    gap: spacing.sm,
  },
  loading: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  // Free accounts see a placeholder summary faded behind the Unlock card.
  preview: {
    opacity: 0.35,
  },
  lock: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.surface,
  },
  lockSeal: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  lockPoints: {
    gap: spacing.sm,
  },
  lockPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  lockTick: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  lockPointText: {
    flex: 1,
    minWidth: 0,
  },
});
