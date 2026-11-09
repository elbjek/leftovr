import { StyleSheet, View } from "react-native";

import { colors, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";
import { FlameIcon } from "./WeekStrip";

type Figure = { label: string; value: string; sub?: string };

type Props = {
  /** The period's headline number: things rescued, and how that moved. */
  rescued: Figure;
  /** Foods used up in the period, newest first; the first few show as icons. */
  foods?: { name: string; category: string }[];
  saved: Figure;
  streak: Figure;
};

const SHOWN_FOODS = 4;

// The top of Insights as tiles: a wide one for what was rescued (the number
// in tomato, the foods themselves as a cluster of icons), then money saved
// and the streak side by side. No solid colour block: tomato is an accent.
export function PeriodSummary({ rescued, foods = [], saved, streak }: Props) {
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
            <Text variant="small" weight="bold">
              {rescued.sub}
            </Text>
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
  num: {
    fontVariant: ["tabular-nums"],
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
