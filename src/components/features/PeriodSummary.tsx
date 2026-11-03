import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, spacing } from "../../theme";
import { Text } from "../primitives";

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

// The top of Insights: what the chosen period saved, in the home's cream,
// bordered style. One card for week and month alike.
export function PeriodSummary({ label, value, sub, stats, emptyText, shareLabel, onShare }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.headline}>
          <Text variant="micro" muted uppercase>
            {label}
          </Text>
          {emptyText ? (
            <Text variant="body" muted>
              {emptyText}
            </Text>
          ) : (
            <>
              {value ? <Text style={styles.value}>{value}</Text> : null}
              {sub ? (
                <Text variant="small" muted>
                  {sub}
                </Text>
              ) : null}
            </>
          )}
        </View>
        {emptyText ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shareLabel}
            onPress={onShare}
            hitSlop={4}
            style={({ pressed }) => [styles.share, pressed && styles.pressed]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        )}
      </View>

      {emptyText ? null : (
        <View style={styles.stats}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
              <Text variant="h2" style={styles.statValue}>
                {stat.value}
              </Text>
              <Text variant="small" muted>
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
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.xl,
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
    fontFamily: fonts.bodyExtraBold,
    fontSize: 44,
    // At or above the font size so iOS doesn't clip the digits.
    lineHeight: 50,
    color: colors.primary,
  },
  share: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    flexDirection: "row",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardLine,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.cardLine,
    paddingLeft: spacing.md,
  },
  statValue: {
    fontFamily: fonts.bodyExtraBold,
  },
  pressed: {
    opacity: 0.6,
  },
});
