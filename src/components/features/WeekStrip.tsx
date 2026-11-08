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

// Today's goal as a small tomato block: the ring in a white circle, the
// headline over the progress in white, a tomato in the corner and the streak
// as a butter-yellow flame pill. Small on purpose: the recipe below is the
// home's main thing.
export function WeekStrip({ goal, headline, detail, streak, onPress }: Props) {
  const active = streak.count > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${detail}. ${streak.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <TomatoMark />
      <View style={styles.ringTile}>
        <GoalRing done={goal.done} total={goal.total} size={52} stroke={7} track={colors.accent} color={colors.text} />
      </View>
      <View style={styles.text}>
        <Text variant="h3" weight="extrabold" color={colors.onPrimary} numberOfLines={1}>
          {headline}
        </Text>
        <Text variant="small" color={colors.onPrimary} numberOfLines={1} style={styles.detail}>
          {detail}
        </Text>
      </View>
      <View style={styles.streak}>
        <FlameIcon size={18} color={active ? colors.primary : colors.muted2} />
        <Text variant="label" weight="extrabold" color={active ? colors.text : colors.muted} style={styles.num}>
          {streak.count}
        </Text>
      </View>
    </Pressable>
  );
}

// The tomato peeking out behind the streak: decoration only.
function TomatoMark() {
  return (
    <View style={styles.tomato} pointerEvents="none" accessible={false}>
      <View style={styles.tomatoBody} />
      <Svg width={34} height={20} viewBox="0 0 34 20" style={styles.tomatoLeaf}>
        <Path d="M17 14C12 4 4 6 1 9c5 0 9 2 12 6M17 14c5-10 13-8 16-5-5 0-9 2-12 6M17 14V2" stroke={colors.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

// Progress toward today's goal; full once the target is met.
export function GoalRing({
  done,
  total,
  size = 36,
  stroke = 4,
  track = colors.surface3,
  color = colors.primary,
}: {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
  track?: string;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(done, total) / total;
  return (
    <View style={[styles.ring, { width: size, height: size }]} accessible accessibilityLabel={`${Math.min(done, total)} / ${total}`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {progress > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text variant={size >= 48 ? "label" : "micro"} weight={size >= 48 ? "extrabold" : "bold"} color={colors.text} style={styles.ringLabel}>
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
  // Solid tomato, no shadow, like a banner; the tomato mark clips at its edge.
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 84,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  ringTile: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.onPrimary,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  detail: {
    opacity: 0.85,
  },
  ring: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringLabel: {
    position: "absolute",
  },
  tomato: {
    position: "absolute",
    right: 72,
    bottom: -44,
    width: 104,
    height: 104,
  },
  tomatoBody: {
    position: "absolute",
    top: 14,
    width: 104,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.primary700,
  },
  tomatoLeaf: {
    position: "absolute",
    top: 0,
    left: 35,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  num: {
    fontVariant: ["tabular-nums"],
  },
  pressed: {
    opacity: 0.6,
  },
});
