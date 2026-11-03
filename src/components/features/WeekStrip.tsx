import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, fonts, radii, spacing } from "../../theme";
import { Text } from "../primitives";

type Props = {
  /** The last seven days, oldest first, today last. */
  days: { date: Date; used: boolean }[];
  /** e.g. "4-day streak" — shown beside the month when there is one. */
  streak?: string;
  lastLabel: string;
  lastValue: string;
  onLastPress?: () => void;
  historyLabel: string;
  onHistory: () => void;
  /** Opens what happened that day. */
  onDayPress: (date: Date) => void;
};

// The week at a glance: a dot under every day food got used, the streak it
// adds up to, and the last thing cooked.
export function WeekStrip({ days, streak, lastLabel, lastValue, onLastPress, historyLabel, onHistory, onDayPress }: Props) {
  const today = days[days.length - 1].date;
  const month = today.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text variant="label" style={styles.month}>
          {month}
        </Text>
        {streak ? (
          <View style={styles.streak}>
            <FlameIcon />
            <Text variant="micro" color={colors.accentInk} style={styles.bold}>
              {streak}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.days}>
        {days.map(({ date, used }, index) => {
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
              <Text variant="label" color={isToday ? colors.surface : colors.text} style={styles.bold}>
                {date.getDate()}
              </Text>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isToday
                      ? used ? colors.surface : colors.inverseHairlineStrong
                      : used ? colors.green : colors.surface3,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

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

function FlameIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
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
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.cardLine,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  month: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "700",
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
    paddingTop: 7,
    paddingBottom: 8,
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
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardLine,
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
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.6,
  },
});
