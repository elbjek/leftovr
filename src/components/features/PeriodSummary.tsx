import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Tappable, Text } from "../primitives";

/** Each figure carries its own well colour: rescue sage, cooking butter, streak red. */
export type StatTone = "green" | "gold" | "red";

const WELLS: Record<StatTone, string> = {
  green: colors.sageTint,
  gold: colors.accentSoft,
  red: colors.redSoft,
};

type Props = {
  /** Label over the big number, e.g. "Saved". */
  label: string;
  /** The big number ("€38"); omitted when nothing was saved. */
  value?: string;
  /** One quiet line under it: the trend or the household total. */
  sub?: string;
  /** Small figures as three tiles (items used, dinners cooked, streak). */
  stats: { value: string; label: string; tone: StatTone; icon: React.ReactNode }[];
  /** Shown instead of the figures when the period has nothing in it yet. */
  emptyText?: string;
  /** Spoken label of the share button ("Share this week"). */
  shareLabel: string;
  onShare: () => void;
};

// The top of Insights in the home's tomato style: the period's money on a
// tomato banner with food on a peach blob (like Add's lead card and the
// home's goal strip), then the three figures as warm white tiles.
export function PeriodSummary({ label, value, sub, stats, emptyText, shareLabel, onShare }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroArt} pointerEvents="none" accessible={false}>
          <View style={styles.heroBlob} />
          <View style={styles.heroFoodBig}>
            <FoodGlyph name="carrot" size={64} />
          </View>
          <View style={styles.heroFoodSmall}>
            <FoodGlyph name="apple" size={46} />
          </View>
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.badge}>
            <Text variant="micro" uppercase color={colors.text}>
              {label}
            </Text>
          </View>
          {emptyText ? (
            <Text variant="small" color={colors.onPrimary} style={styles.soft}>
              {emptyText}
            </Text>
          ) : (
            <>
              {value ? (
                <Text variant="h1" color={colors.onPrimary}>
                  {value}
                </Text>
              ) : null}
              {sub ? (
                <Text variant="small" color={colors.onPrimary} style={styles.soft}>
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
                stroke={colors.primary}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Tappable>
        )}
      </View>

      {emptyText ? null : (
        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.tile}>
              <View style={styles.tileArt}>
                <View style={[styles.tileBlob, { backgroundColor: WELLS[stat.tone] }]} />
                {stat.icon}
              </View>
              <Text variant="h3">{stat.value}</Text>
              <Text variant="small" muted numberOfLines={2}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  // Solid tomato, no shadow, like the home's banner; the blob clips at its edge.
  hero: {
    minHeight: 160,
    padding: spacing.lg,
    borderRadius: radii.xxl,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  heroArt: {
    position: "absolute",
    right: -28,
    bottom: -30,
    width: 168,
    height: 150,
  },
  heroBlob: {
    position: "absolute",
    width: 168,
    height: 150,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    transform: [{ rotate: "-14deg" }],
  },
  heroFoodBig: {
    position: "absolute",
    left: 26,
    top: 14,
  },
  heroFoodSmall: {
    position: "absolute",
    left: 88,
    top: 6,
  },
  heroCopy: {
    // Clear of the food blob and the share button on the right.
    paddingRight: 112,
    gap: spacing.xxs,
  },
  badge: {
    alignSelf: "flex-start",
    marginBottom: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  soft: {
    opacity: 0.85,
  },
  share: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  tileArt: {
    width: 40,
    height: 36,
    marginBottom: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  tileBlob: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
    transform: [{ rotate: "-14deg" }],
  },
});
