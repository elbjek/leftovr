import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";
import { FlameIcon } from "./WeekStrip";

type Figure = { label: string; value: string; sub?: string };

type Props = {
  /** The period's headline number: things rescued, and how that moved. */
  rescued: Figure;
  /** Rescued against the period before: an up or down caret on its line. */
  trend?: "up" | "down";
  /** Foods used up in the period, newest first; the first few show as icons. */
  foods?: { name: string; category: string }[];
  saved: Figure;
  streak: Figure;
  /** The last 7 days, oldest first: true where the streak was kept (used or frozen). */
  streakDays?: boolean[];
};

const SHOWN_FOODS = 4;

// The top of Insights as tiles: a wide one for what was rescued (the number
// in tomato, the foods themselves as a cluster of icons), then money saved
// and the streak side by side. No solid colour block: tomato is an accent.
export function PeriodSummary({ rescued, trend, foods = [], saved, streak, streakDays = [] }: Props) {
  const trendColor = trend === "up" ? colors.green : trend === "down" ? colors.redInk : colors.text;
  const shown = foods.slice(0, SHOWN_FOODS);
  const more = foods.length - shown.length;
  return (
    <View style={styles.wrap}>
      <View style={[styles.tile, styles.wide]}>
        <View style={styles.copy}>
          <Text variant="small" weight="bold" muted>
            {rescued.label}
          </Text>
          <Text variant="numeral" color={colors.primary}>
            {rescued.value}
          </Text>
          {rescued.sub ? (
            <View style={styles.trend}>
              {trend ? (
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d={trend === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} stroke={trendColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : null}
              <Text variant="small" weight="bold" color={trendColor} style={styles.trendText}>
                {rescued.sub}
              </Text>
            </View>
          ) : null}
        </View>
        {shown.length > 0 ? (
          <View style={styles.foods} accessible={false} importantForAccessibility="no-hide-descendants">
            <View style={styles.cluster}>
              {shown.map((food, index) => (
                <View key={food.name} style={[styles.well, index > 0 && styles.overlap, index % 2 === 1 && styles.wellPeach]}>
                  <FoodGlyph name={food.name} category={food.category} size={26} />
                </View>
              ))}
            </View>
            {more > 0 ? (
              <Text variant="small" muted>
                {`+${more}`}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        <View style={[styles.tile, styles.half]}>
          <Text variant="small" weight="bold" muted>
            {saved.label}
          </Text>
          <View>
            <Text variant="h2" style={styles.num} numberOfLines={1} adjustsFontSizeToFit>
              {saved.value}
            </Text>
            {saved.sub ? (
              <Text variant="small" muted>
                {saved.sub}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.tile, styles.half, styles.peach]}>
          <View style={styles.tileHead}>
            <Text variant="small" weight="bold" muted>
              {streak.label}
            </Text>
            <FlameIcon size={20} color={colors.primary} />
          </View>
          <View>
            <Text variant="h2" style={styles.num}>
              {streak.value}
            </Text>
            {streak.sub ? (
              <Text variant="small" muted>
                {streak.sub}
              </Text>
            ) : null}
            {streakDays.length > 0 ? (
              <View style={styles.days} accessible={false} importantForAccessibility="no-hide-descendants">
                {streakDays.map((kept, index) => (
                  <View key={index} style={[styles.day, kept && styles.dayKept]} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  tile: {
    padding: spacing.xl,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  wide: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  half: {
    flex: 1,
    minWidth: 0,
    minHeight: 132,
    justifyContent: "space-between",
    gap: spacing.md,
  },
  // The streak sits on the peach well, flat: the one tinted tile.
  peach: {
    backgroundColor: colors.surface2,
    boxShadow: undefined,
  },
  tileHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  trendText: {
    flex: 1,
    minWidth: 0,
  },
  num: {
    fontVariant: ["tabular-nums"],
  },
  days: {
    flexDirection: "row",
    gap: spacing.xxs,
    marginTop: spacing.sm,
  },
  day: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  dayKept: {
    backgroundColor: colors.primary,
  },
  foods: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  cluster: {
    flexDirection: "row",
  },
  well: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  wellPeach: {
    backgroundColor: colors.surface2,
  },
  overlap: {
    marginLeft: -14,
  },
});
