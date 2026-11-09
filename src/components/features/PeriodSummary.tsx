import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { Card, Tappable, Text } from "../primitives";

/** Each figure carries its own tile colour: rescue sage, cooking gold, streak red. */
export type StatTone = "green" | "gold" | "red";

const TINTS: Record<StatTone, string> = {
  green: colors.sage,
  gold: colors.accent,
  red: colors.red,
};

// Quiet copy on the green panel. White text only on green — never amber.
const ON_GREEN_MUTED = "rgba(255, 255, 255, 0.72)";

type Props = {
  /** Label over the big number, e.g. "Saved". */
  label: string;
  /** The big number ("€38"); omitted when nothing was saved. */
  value?: string;
  /** One quiet line under it: the trend or the household total. */
  sub?: string;
  /** Small figures in one row (items used, dinners cooked, streak). */
  stats: { value: string; label: string; tone: StatTone; icon: React.ReactNode }[];
  /** Shown instead of the figures when the period has nothing in it yet. */
  emptyText?: string;
  /** Spoken label of the share button ("Share this week"). */
  shareLabel: string;
  onShare: () => void;
};

// The top of Insights: the period's money as the page's one big number, with
// the three figures under it. The one green slab on the tab — the landing
// page's hero block, brought into the app.
export function PeriodSummary({ label, value, sub, stats, emptyText, shareLabel, onShare }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={styles.headline}>
          <Text variant="micro" uppercase color={colors.accent}>
            {label}
          </Text>
          {emptyText ? (
            <Text variant="small" color={ON_GREEN_MUTED}>
              {emptyText}
            </Text>
          ) : (
            <>
              {value ? (
                <Text variant="h1" color={colors.onPrimary} style={styles.value}>
                  {value}
                </Text>
              ) : null}
              {sub ? (
                <Text variant="small" color={ON_GREEN_MUTED}>
                  {sub}
                </Text>
              ) : null}
            </>
          )}
        </View>
        {emptyText ? null : (
          <Tappable label={shareLabel} onPress={onShare} hitSlop={4} style={styles.share}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5"
                stroke={colors.onPrimary}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Tappable>
        )}
      </View>

      {emptyText ? null : (
        <View style={styles.stats}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
              <View style={[styles.statTile, { backgroundColor: TINTS[stat.tone] }]}>{stat.icon}</View>
              <Text variant="h3" color={colors.onPrimary}>
                {stat.value}
              </Text>
              <Text variant="small" color={ON_GREEN_MUTED}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    ...shadows.primaryButton,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headline: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  value: {
    marginVertical: 2,
  },
  share: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.inverseHairlineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    flexDirection: "row",
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.inverseHairline,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statTile: {
    width: 28,
    height: 28,
    borderRadius: radii.xs,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.inverseHairline,
    paddingLeft: spacing.md,
  },
});
