import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Text } from "../primitives";

type Props = {
  /** Items used up today against the target. */
  goal: { done: number; total: number };
  /** The one thing to know now: the food going off, or the nudge. */
  headline: string;
  /** "2 of 3 used · 3 more to use soon". */
  detail: string;
  /** Streak length (0 shows a grey flame), with a spoken label. */
  streak: { count: number; label: string };
  /** Opens what happened today. */
  onPress: () => void;
};

// Today's goal in one line: the ring in a white tile, the headline over the
// progress, and the streak as a gold flame. Small on purpose: the recipe
// below is the home's main thing.
export function WeekStrip({ goal, headline, detail, streak, onPress }: Props) {
  const active = streak.count > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${detail}. ${streak.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.ringTile}>
        <GoalRing done={goal.done} total={goal.total} />
      </View>
      <View style={styles.text}>
        <Text variant="small" weight="extrabold" color={colors.text} numberOfLines={1}>
          {headline}
        </Text>
        <Text variant="small" color={colors.muted} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <View style={[styles.streak, !active && styles.streakIdle]}>
        <FlameIcon size={15} color={active ? colors.accentInk : colors.muted2} />
        <Text variant="small" weight="extrabold" color={active ? colors.text : colors.muted} style={styles.num}>
          {streak.count}
        </Text>
      </View>
    </Pressable>
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

export function FlameIcon({ size = 13, color = colors.accentInk }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.7 1.2 2.8 2.3 3.2C10.6 9.4 11 6 12 3Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Flat, no shadow; the same light sage as the Tonight card's "why" line.
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.sageSoft,
  },
  ringTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    minWidth: 0,
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
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  streakIdle: {
    backgroundColor: colors.surface3,
  },
  num: {
    fontVariant: ["tabular-nums"],
  },
  pressed: {
    opacity: 0.6,
  },
});
