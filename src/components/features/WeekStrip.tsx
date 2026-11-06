import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, fonts, radii, shadows, spacing } from "../../theme";
import { Text } from "../primitives";

type Props = {
  /** The last seven days, oldest first, today last. Frozen = covered by a streak freeze. */
  days: { date: Date; state: "used" | "frozen" | "none" }[];
  /** Today's goal: items used up so far against the target, and what to do next. */
  goal: { done: number; total: number; eyebrow: string; title: string };
  /** e.g. "4-day streak" — shown beside the month when there is one. */
  streak?: string;
  /** Banked streak freezes, with a spoken label ("2 streak freezes"). */
  freezes?: { count: number; label: string };
  /** One quiet line under the days, e.g. which day a freeze covered. */
  note?: string;
  lastLabel: string;
  lastValue: string;
  onLastPress?: () => void;
  historyLabel: string;
  onHistory: () => void;
  /** Opens what happened that day. */
  onDayPress: (date: Date) => void;
};

// The week at a glance: today's goal, a dot under every day food got used (a
// snowflake where a freeze covered it), the streak it adds up to, and the last
// thing cooked.
export function WeekStrip({ days, goal, streak, freezes, note, lastLabel, lastValue, onLastPress, historyLabel, onHistory, onDayPress }: Props) {
  const today = days[days.length - 1].date;
  const month = today.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <View style={styles.card}>
      <View style={styles.goal}>
        <GoalRing done={goal.done} total={goal.total} />
        <View style={styles.goalText}>
          <Text variant="micro" muted uppercase>
            {goal.eyebrow}
          </Text>
          <Text variant="label">{goal.title}</Text>
        </View>
      </View>

      <View style={styles.head}>
        <Text variant="small" muted style={styles.month}>
          {month}
        </Text>
        <View style={styles.badges}>
          {streak ? (
            <View style={styles.streak}>
              <FlameIcon />
              <Text variant="micro" color={colors.accentInk} style={styles.bold}>
                {streak}
              </Text>
            </View>
          ) : null}
          {freezes && freezes.count > 0 ? (
            <View style={styles.streak} accessible accessibilityLabel={freezes.label}>
              <SnowflakeIcon size={13} color={colors.primary} />
              <Text variant="micro" color={colors.primary} style={styles.bold}>
                {freezes.count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.days}>
        {days.map(({ date, state }, index) => {
          const isToday = index === days.length - 1;
          return (
            <Pressable
              key={date.toDateString()}
              accessibilityRole="button"
              accessibilityLabel={date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              onPress={() => onDayPress(date)}
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [styles.day, isToday && styles.dayToday, pressed && styles.dayPressed]}
            >
              <Text variant="micro" color={isToday ? colors.sage : colors.muted}>
                {date.toLocaleDateString(undefined, { weekday: "narrow" })}
              </Text>
              <Text variant="label" color={isToday ? colors.onPrimary : colors.text} style={styles.bold}>
                {date.getDate()}
              </Text>
              {state === "frozen" ? (
                <View style={styles.dotSlot}>
                  <SnowflakeIcon size={9} color={colors.primary} />
                </View>
              ) : (
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isToday
                        ? state === "used" ? colors.onPrimary : colors.inverseHairlineStrong
                        : state === "used" ? colors.green : colors.surface3,
                    },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {note ? (
        <View style={styles.note}>
          <SnowflakeIcon size={12} color={colors.muted} />
          <Text variant="small" muted style={styles.noteText}>
            {note}
          </Text>
        </View>
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
            <Text variant="small" style={styles.bold}>
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
          <Text variant="micro" color={colors.accentInk} style={styles.bold}>
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
      <Text variant="micro" style={[styles.ringLabel, styles.bold]}>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadows.soft,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  goal: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
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
    gap: spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  month: {
    fontFamily: fonts.bodySemiBold,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  days: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  day: {
    width: 40,
    alignItems: "center",
    gap: 2,
    paddingTop: 5,
    paddingBottom: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  dayToday: {
    backgroundColor: colors.primary,
  },
  dayPressed: {
    transform: [{ scale: 0.94 }],
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  // Same box as the dot so a frozen day's pill stays the same height.
  dotSlot: {
    height: 5,
    marginTop: 2,
    justifyContent: "center",
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  noteText: {
    flexShrink: 1,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
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
    borderRadius: 13,
    backgroundColor: colors.surface2,
  },
  bold: {
    fontFamily: fonts.bodyBold,
  },
  pressed: {
    opacity: 0.6,
  },
});
