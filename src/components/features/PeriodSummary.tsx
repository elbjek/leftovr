import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { Text } from "../primitives";
import { GoalRing } from "./WeekStrip";

type Props = {
  /** Used against everything finished; omitted (a leaf shows) when nothing was finished. */
  ring?: { used: number; total: number };
  /** "You rescued 12 things this month." */
  title: string;
  /** How that moved against the period before. */
  body: string;
  /** What the period saved, with its trend line. */
  money?: { label: string; value: string; sub?: string };
  /** Small figures as tiles under the block (dinners cooked, streak). */
  stats?: { value: string; label: string; icon: React.ReactNode }[];
};

// The top of Insights, built like the home's goal strip: one tomato block
// with the used-vs-finished ring in a white circle and the period in a
// sentence, the money as its footer, then two quiet white tiles.
export function PeriodSummary({ ring, title, body, money, stats = [] }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.main}>
          <View style={styles.ringTile}>
            {ring ? (
              <GoalRing done={ring.used} total={ring.total} size={64} stroke={8} track={colors.surface3} color={colors.text} label={`${Math.round((ring.used / ring.total) * 100)}%`} />
            ) : (
              <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 20c0-8 6-14 16-14 0 10-6 15-13 15-1 0-3 0-3-1zM4 20c2-5 6-8 11-9"
                  stroke={colors.primary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </View>
          <View style={styles.text}>
            <Text variant="h3" color={colors.onPrimary} accessibilityRole="header">
              {title}
            </Text>
            <Text variant="small" color={colors.onPrimary} style={styles.soft}>
              {body}
            </Text>
          </View>
        </View>
        {money ? (
          <View style={styles.money}>
            <View>
              <Text variant="micro" uppercase color={colors.onPrimary} style={styles.soft}>
                {money.label}
              </Text>
              <Text variant="h2" color={colors.onPrimary} style={styles.num}>
                {money.value}
              </Text>
            </View>
            {money.sub ? (
              <Text variant="small" color={colors.onPrimary} style={[styles.soft, styles.moneySub]}>
                {money.sub}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.tile}>
              <View style={styles.tileIcon}>{stat.icon}</View>
              <View style={styles.text}>
                <Text variant="h3" style={styles.num}>
                  {stat.value}
                </Text>
                <Text variant="small" muted numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  // Solid tomato, no shadow, like the home's goal strip.
  hero: {
    padding: spacing.lg,
    gap: spacing.lg,
    borderRadius: radii.xxl,
    backgroundColor: colors.primary,
  },
  main: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  ringTile: {
    width: 76,
    height: 76,
    borderRadius: radii.pill,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  soft: {
    opacity: 0.85,
  },
  money: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.inverseHairlineStrong,
  },
  moneySub: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
  },
  num: {
    fontVariant: ["tabular-nums"],
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
});
