import { StyleSheet, View } from "react-native";

import { colors, fonts, radii, spacing } from "../../theme";
import { Button, Text } from "../primitives";

type Props = {
  /** e.g. "Monthly recap". */
  eyebrow: string;
  /** e.g. "Your October in leftovr" / "November so far". */
  title: string;
  /** The big number and its label ("€38" · "saved"); omitted on an empty month. */
  hero?: { value: string; label: string };
  /** Small figures in one row (items used, dinners cooked, streak). */
  stats: { value: string; label: string }[];
  /** Label/value rows (most rescued food, most cooked dish). */
  rows: { label: string; value: string }[];
  /** One quiet line, e.g. the household total. */
  footnote?: string;
  /** Shown instead of the figures when the month has nothing in it yet. */
  emptyText?: string;
  shareLabel: string;
  onShare: () => void;
};

// The shareable month at a glance, in the home's cream, bordered style.
export function MonthlyRecap({ eyebrow, title, hero, stats, rows, footnote, emptyText, shareLabel, onShare }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text variant="micro" muted uppercase>
          {eyebrow}
        </Text>
        <Text variant="h2">{title}</Text>
      </View>

      {emptyText ? (
        <Text variant="small" muted>
          {emptyText}
        </Text>
      ) : (
        <>
          {hero ? (
            <View>
              <Text style={styles.heroValue}>{hero.value}</Text>
              <Text variant="small" muted>
                {hero.label}
              </Text>
            </View>
          ) : null}

          <View style={styles.stats}>
            {stats.map((stat, index) => (
              <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
                <Text variant="h3" style={styles.statValue}>
                  {stat.value}
                </Text>
                <Text variant="small" muted center>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text variant="micro" muted uppercase>
                {row.label}
              </Text>
              <Text variant="label" numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ))}

          {footnote ? (
            <Text variant="small" muted>
              {footnote}
            </Text>
          ) : null}

          <Button title={shareLabel} onPress={onShare} />
        </>
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    gap: 2,
  },
  heroValue: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 40,
    lineHeight: 44,
    color: colors.primary,
  },
  stats: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: 2,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.cardLine,
  },
  statValue: {
    color: colors.primary,
  },
  row: {
    gap: 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardLine,
  },
});
