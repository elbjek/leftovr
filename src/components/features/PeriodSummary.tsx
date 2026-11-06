import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Tappable, Text } from "../primitives";

type Props = {
  /** Label over the big number, e.g. "Saved". */
  label: string;
  /** The big number ("€38"); omitted when nothing was saved. */
  value?: string;
  /** One quiet line under it: the trend or the household total. */
  sub?: string;
  /** Small figures in one row (items used, dinners cooked, streak). */
  stats: { value: string; label: string }[];
  /** Shown instead of the figures when the period has nothing in it yet. */
  emptyText?: string;
  /** Spoken label of the share button ("Share this week"). */
  shareLabel: string;
  onShare: () => void;
};

// The top of Insights: one flat green card carrying the period's money, the
// trend line and the three figures, so the page has a single focal number
// instead of a grid of equal cards.
export function PeriodSummary({ label, value, sub, stats, emptyText, shareLabel, onShare }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.headline}>
          <Text variant="micro" color={colors.onPrimary} uppercase style={styles.kicker}>
            {label}
          </Text>
          {emptyText ? (
            <Text variant="body" color={colors.onPrimary} style={styles.empty}>
              {emptyText}
            </Text>
          ) : (
            <>
              {value ? (
                <Text variant="numeral" color={colors.onPrimary} style={styles.value}>
                  {value}
                </Text>
              ) : null}
              {sub ? (
                <View style={styles.subChip}>
                  <Text variant="small" weight="bold" color={colors.onPrimary}>
                    {sub}
                  </Text>
                </View>
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
              <Text variant="h2" weight="extrabold" color={colors.onPrimary}>
                {stat.value}
              </Text>
              <Text variant="small" color={colors.onPrimary} style={styles.statLabel}>
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
  card: {
    backgroundColor: colors.primary,
    borderRadius: radii.xxl,
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
    gap: spacing.xs,
  },
  kicker: {
    opacity: 0.8,
  },
  value: {
    marginTop: 2,
  },
  empty: {
    opacity: 0.85,
  },
  subChip: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary700,
  },
  share: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.primary700,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    flexDirection: "row",
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.inverseHairline,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.inverseHairline,
    paddingLeft: spacing.md,
  },
  statLabel: {
    opacity: 0.75,
  },
});
