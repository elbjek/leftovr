import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Card, EmptyState, PremiumSheet, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { useInsights } from "@/hooks";
import { setPreviewTier } from "@/repositories";
import { formatCategoryLabel, InsightsSummary } from "@/services/insightsService";
import { colors, spacing } from "@/theme";

export default function InsightsRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const isPremium = profile?.tier !== "free";
  const [showPremium, setShowPremium] = useState(false);
  const { weeklySummary, monthlySummary, loading } = useInsights(
    isPremium ? activeHousehold?.id : undefined,
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

  const primaryGoal = profile?.primary_goal ?? "all";

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="micro" color={colors.accent} style={styles.premiumBadge}>
          ★ {t("premium.title")}
        </Text>
        <Text variant="display">{t("insights.premiumTitle")}</Text>
      </View>

      {weeklySummary ? (
        <SummaryBanner summary={weeklySummary} primaryGoal={primaryGoal} />
      ) : null}

      {weeklySummary ? (
        <StatsCard
          title={t("insights.weeklyTitle")}
          summary={weeklySummary}
        />
      ) : null}

      {monthlySummary ? (
        <StatsCard
          title={t("insights.monthlyTitle")}
          summary={monthlySummary}
        />
      ) : null}
    </Screen>
  );
}

function SummaryBanner({
  summary,
  primaryGoal,
}: {
  summary: InsightsSummary;
  primaryGoal: string;
}) {
  const { t } = useTranslation();

  if (summary.isSparse) {
    return (
      <Card style={styles.summaryCard}>
        <Text variant="label">{t("insights.sparseTitle")}</Text>
        <Text variant="small" muted style={styles.summaryBody}>
          {t("insights.sparseBody")}
        </Text>
      </Card>
    );
  }

  const text =
    primaryGoal === "waste"
      ? t("insights.summaryWaste", { count: summary.estimatedItemsSaved })
      : primaryGoal === "money"
        ? t("insights.summaryMoney", { amount: summary.estimatedMoneySaved.toFixed(0) })
        : primaryGoal === "quick"
          ? t("insights.summaryQuick", { count: summary.cookedEvents })
          : t("insights.summaryAll", {
              count: summary.estimatedItemsSaved,
              amount: summary.estimatedMoneySaved.toFixed(0),
            });

  return (
    <Card style={styles.summaryCard}>
      <Text variant="h3" color={colors.primary}>
        {text}
      </Text>
    </Card>
  );
}

function StatsCard({
  title,
  summary,
}: {
  title: string;
  summary: InsightsSummary;
}) {
  const { t } = useTranslation();

  const categoryLabel = summary.mostUsedCategory
    ? formatCategoryLabel(summary.mostUsedCategory)
    : t("insights.noCategory");

  return (
    <Card>
      <Text variant="label" style={styles.cardTitle}>
        {title}
      </Text>
      <View style={styles.statsGrid}>
        <StatRow label={t("insights.scans")} value={String(summary.receiptScans)} />
        <StatRow label={t("insights.itemsAdded")} value={String(summary.itemsAdded)} />
        <StatRow label={t("insights.cookedEvents")} value={String(summary.cookedEvents)} />
        <StatRow label={t("insights.removedItems")} value={String(summary.removedItems)} />
        <StatRow label={t("insights.estimatedSaved")} value={String(summary.estimatedItemsSaved)} />
        <StatRow
          label={t("insights.estimatedMoneySaved")}
          value={`$${summary.estimatedMoneySaved.toFixed(0)}`}
        />
        <StatRow label={t("insights.mostUsedCategory")} value={categoryLabel} />
      </View>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text variant="small" muted style={styles.statLabel}>
        {label}
      </Text>
      <Text variant="label" style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
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
    paddingBottom: spacing.tabBarClearance,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  premiumBadge: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryCard: {
    backgroundColor: colors.primary50,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  summaryBody: {
    marginTop: spacing.xs,
  },
  cardTitle: {
    marginBottom: spacing.md,
  },
  statsGrid: {
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  statLabel: {
    flex: 1,
  },
  statValue: {
    textAlign: "right",
  },
});
