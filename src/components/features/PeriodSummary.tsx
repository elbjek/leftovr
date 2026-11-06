import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Card, Tappable, Text } from "../primitives";

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

// The top of Insights: the period's money as the page's one big number, with
// the three figures under it. A white card like the home's, green as ink
// rather than as a filled slab.
export function PeriodSummary({ label, value, sub, stats, emptyText, shareLabel, onShare }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={styles.headline}>
          <Text variant="micro" uppercase color={colors.accentInk}>
            {label}
          </Text>
          {emptyText ? (
            <Text variant="small" muted>
              {emptyText}
            </Text>
          ) : (
            <>
              {value ? (
                <Text variant="h1" color={colors.primary} style={styles.value}>
                  {value}
                </Text>
              ) : null}
              {sub ? (
                <Text variant="small" muted>
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
              <Text variant="h3" weight="extrabold">
                {stat.value}
              </Text>
              <Text variant="small" muted>
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
    backgroundColor: colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    flexDirection: "row",
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.hairline,
    paddingLeft: spacing.md,
  },
});
