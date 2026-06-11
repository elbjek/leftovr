import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";


import { EmptyState, PremiumSheet, RecipeGlyph, Screen, ScreenHeader, SegmentedControl, Text } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { useHousehold, useInsights } from "@/hooks";
import { setPreviewTier } from "@/repositories";
import { formatCategoryLabel, InsightsSummary } from "@/services/insightsService";
import { colors, radii, spacing } from "@/theme";

export default function InsightsRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const isPremium = resolvePremium(profile, activeHousehold);
  const [showPremium, setShowPremium] = useState(false);
  const [scope, setScope] = useState<"you" | "household">("you");
  const { members } = useHousehold(activeHousehold?.id);
  const showHouseholdScope = members.length >= 2;
  const { weeklySummary, lastWeekSummary, householdWeeklySummary, loading } = useInsights(
    isPremium ? activeHousehold?.id : undefined,
    { userId: profile?.id, includeHousehold: showHouseholdScope },
  );

  if (!isPremium) {
    return (
      <Screen>
        <View style={styles.gateWrap}>
          <EmptyState
            title={t("insights.title")}
            body={t("insights.gateBody")}
            actionLabel={t("insights.unlock")}
            onAction={() => setShowPremium(true)}
          />
          <PremiumSheet
            visible={showPremium}
            onPreview={async () => {
              await setPreviewTier("premium");
              await refresh();
            }}
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
        <HeroStat summary={summary} savedDelta={savedDelta} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
    </Screen>
  );
}

function HeroStat({ summary, savedDelta }: { summary: InsightsSummary; savedDelta: number }) {
  const { t } = useTranslation();
  const items = summary.estimatedItemsSaved;
  const amount = summary.estimatedMoneySaved.toFixed(0);

  return (
    <View style={styles.heroCard}>
      <Text variant="micro" color={colors.accent} uppercase style={styles.heroEyebrow}>
        {t("insights.itemsSavedThisWeek")}
      </Text>
      <View style={styles.heroValueRow}>
        <Text style={styles.heroValue}>{items}</Text>
        <Text variant="small" color="rgba(248,244,238,0.72)" style={styles.heroMeta}>
          {t("insights.heroMeta", { count: items, amount })}
        </Text>
      </View>
      <View style={styles.heroDivider} />
      <Text variant="small" color="rgba(248,244,238,0.86)">
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

function getEmptySummary(): InsightsSummary {
  return {
    receiptScans: 0,
    itemsAdded: 0,
    cookedEvents: 0,
    removedItems: 0,
    itemsSaved: 0,
    estimatedItemsSaved: 0,
    estimatedMoneySaved: 0,
    mostUsedCategory: null,
    isSparse: true,
    cookedRecipes: [],
  };
}

const styles = StyleSheet.create({
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
    fontSize: 64,
    lineHeight: 61,
    fontWeight: "700",
  },
  heroMeta: {
    flex: 1,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(248,244,238,0.15)",
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
