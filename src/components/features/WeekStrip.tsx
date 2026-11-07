import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Text } from "../primitives";

type Props = {
  /** Today's goal: items used up so far against the target, and what to do next. */
  goal: { done: number; total: number; label: string; title: string };
  /** e.g. "4-day streak" — shown beside the goal when there is one. */
  streak?: string;
  /** Banked streak freezes, with a spoken label ("2 streak freezes"). */
  freezes?: { count: number; label: string };
  lastLabel: string;
  lastValue: string;
  onLastPress?: () => void;
  historyLabel: string;
  onHistory: () => void;
  /** Opens what happened today. */
  onGoalPress: () => void;
  /** The foods the goal is about (soonest first). Premium only. */
  foods?: { id: string; name: string; when: string; today: boolean }[];
  onFoodsPress?: () => void;
};

// Today at a glance, in the cook prompt's selected meal card style: a flat
// sage panel, the ring in a white tile, "Today's goal" over the nudge. Then
// the foods it is about, and the last thing cooked.
export function WeekStrip({ goal, streak, freezes, lastLabel, lastValue, onLastPress, historyLabel, onHistory, onGoalPress, foods, onFoodsPress }: Props) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={onGoalPress}
        style={({ pressed }) => [styles.goal, pressed && styles.pressed]}
      >
        <View style={styles.ringTile}>
          <GoalRing done={goal.done} total={goal.total} />
        </View>
        <View style={styles.goalText}>
          <Text variant="label" weight="extrabold" color={colors.text}>
            {goal.label}
          </Text>
          <Text variant="small" color={colors.muted}>
            {goal.title}
          </Text>
        </View>
        <View style={styles.badges}>
          {streak ? (
            <View style={styles.streak}>
              <FlameIcon />
              <Text variant="micro" color={colors.accentInk} weight="bold">
                {streak}
              </Text>
            </View>
          ) : null}
          {freezes && freezes.count > 0 ? (
            <View style={styles.freeze} accessible accessibilityLabel={freezes.label}>
              <SnowflakeIcon size={13} color={colors.primary} />
              <Text variant="micro" color={colors.primary} weight="bold">
                {freezes.count}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* One scrolling row, never wrapped: long names would stack the pills. */}
      {foods?.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.foods}
          contentContainerStyle={styles.foodsRow}
        >
          {foods.map((food) => (
            <Pressable
              key={food.id}
              accessibilityRole="button"
              accessibilityLabel={`${food.name}, ${food.when}`}
              onPress={onFoodsPress}
              style={({ pressed }) => [styles.food, pressed && styles.pressed]}
            >
              <View style={[styles.foodDot, { backgroundColor: food.today ? colors.red : colors.accent }]} />
              <Text variant="small" weight="bold" color={colors.primary} numberOfLines={1} style={styles.foodName}>
                {food.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.foot}>
        <Pressable
          accessibilityRole={onLastPress ? "button" : undefined}
          disabled={!onLastPress}
          onPress={onLastPress}
          hitSlop={8}
          style={({ pressed }) => [styles.last, pressed && styles.pressed]}
        >
          <Text variant="small" numberOfLines={1} muted style={styles.lastText}>
            <Text variant="small" weight="bold">
              {lastLabel}
            </Text>
            {"  "}
            {lastValue}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onHistory}
          hitSlop={8}
          style={({ pressed }) => [styles.history, pressed && styles.pressed]}
        >
          <ClockIcon />
          <Text variant="micro" color={colors.accentInk} weight="bold">
            {historyLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Progress toward today's goal; full once the target is met.
export function GoalRing({ done, total }: { done: number; total: number }) {
  const size = 36;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(done, total) / total;
  return (
    <View style={styles.ring} accessible accessibilityLabel={`${Math.min(done, total)} / ${total}`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface3} strokeWidth={stroke} fill="none" />
        {progress > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text variant="micro" weight="bold" style={styles.ringLabel}>
        {`${Math.min(done, total)}/${total}`}
      </Text>
    </View>
  );
}

function SnowflakeIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function FlameIcon({ size = 13 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.7 1.2 2.8 2.3 3.2C10.6 9.4 11 6 12 3Z"
        stroke={colors.accentInk}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={colors.accentInk} strokeWidth={2} />
      <Path d="M12 7v5l3 2" stroke={colors.accentInk} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Flat, no shadow — CookPromptSheet's selected mealCard.
  card: {
    backgroundColor: colors.sageTint,
    borderRadius: radii.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  ringTile: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  goal: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.sm,
  },
  goalText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ring: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  ringLabel: {
    position: "absolute",
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  freeze: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  // Bleeds to the card edge so the row scrolls under it, not inside a gutter.
  foods: {
    marginHorizontal: -spacing.md,
    marginBottom: spacing.sm,
  },
  foodsRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  food: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  foodDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  foodName: {
    maxWidth: 140,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xxs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  last: {
    flex: 1,
    minWidth: 0,
  },
  lastText: {
    flexShrink: 1,
  },
  history: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.6,
  },
});
