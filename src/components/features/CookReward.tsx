import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, spacing } from "../../theme";
import { Button, Text } from "../primitives";
import { FlameIcon, GoalRing } from "./WeekStrip";

// More than this and the chips crowd the screen; the rest fold into "+N".
const MAX_CHIPS = 6;

type Props = {
  visible: boolean;
  /** e.g. "Lemon spinach pasta · cooked". */
  eyebrow: string;
  /** e.g. "4 things saved from the bin". */
  title: string;
  /** What the cook used up, as named on the cook sheet. */
  items: string[];
  /** Today's goal after this cook; null when it couldn't be loaded. */
  goal: { done: number; total: number; label: string } | null;
  /** e.g. { value: 5, label: "day streak" }; null when it couldn't be loaded. */
  streak: { value: number; label: string } | null;
  /** Money saved today, formatted; null when hidden (free tier, nothing priced). */
  saved: { value: string; label: string } | null;
  doneLabel: string;
  shareLabel: string;
  onDone: () => void;
  onShare: () => void;
};

// The payoff right after a cook: what was rescued and what it did for the
// streak. Same cream, bordered look as the home; the check pops in once.
// A full-screen layer, not a Modal: it rides in the cook sheet's Modal
// (BottomSheet `overlay`) so iOS never has to stack two.
export function CookReward({ visible, eyebrow, title, items, goal, streak, saved, doneLabel, shareLabel, onDone, onShare }: Props) {
  const insets = useSafeAreaInsets();
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    pop.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        pop.setValue(1);
        return;
      }
      Animated.timing(pop, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [pop, visible]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const rise = pop.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  if (!visible) return null;

  const shown = items.slice(0, MAX_CHIPS);
  const more = items.length - shown.length;

  return (
    <Animated.View
      style={[styles.screen, { opacity: pop, paddingTop: insets.top + spacing.huge * 2, paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <View style={styles.head}>
        <Animated.View style={[styles.check, { opacity: pop, transform: [{ scale }] }]}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12l5 5 9-10" stroke={colors.surface} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        <Text variant="micro" muted uppercase center>
          {eyebrow}
        </Text>
        <Text variant="h1" center accessibilityRole="header">
          {title}
        </Text>
        {shown.length > 0 ? (
          <View style={styles.chips}>
            {shown.map((name, index) => (
              <View key={`${index}-${name}`} style={styles.chip}>
                <Text variant="small" color={colors.primary} style={styles.semibold} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
            {more > 0 ? (
              <View style={[styles.chip, styles.chipMore]}>
                <Text variant="small" muted style={styles.semibold}>
                  {`+${more}`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {goal || streak || saved ? (
        <Animated.View style={[styles.card, { transform: [{ translateY: rise }] }]}>
          {goal || streak ? (
            <View style={styles.row}>
              <View style={styles.goal}>
                {goal ? (
                  <>
                    <GoalRing done={goal.done} total={goal.total} />
                    <Text variant="label" style={styles.goalLabel}>
                      {goal.label}
                    </Text>
                  </>
                ) : null}
              </View>
              {streak ? (
                <View style={styles.streak} accessible accessibilityLabel={`${streak.value} ${streak.label}`}>
                  <View style={styles.streakValue}>
                    <FlameIcon size={18} />
                    <Text variant="h2" color={colors.accentInk} style={styles.number}>
                      {streak.value}
                    </Text>
                  </View>
                  <Text variant="small" muted>
                    {streak.label}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {saved ? (
            <View style={[styles.row, (goal || streak) && styles.divider]}>
              <Text variant="label" muted style={styles.goalLabel}>
                {saved.label}
              </Text>
              <Text variant="h2" color={colors.primary} style={styles.number}>
                {saved.value}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button title={doneLabel} onPress={onDone} />
        <Pressable
          accessibilityRole="button"
          onPress={onShare}
          hitSlop={8}
          style={({ pressed }) => [styles.share, pressed && styles.pressed]}
        >
          <Text variant="label" color={colors.primary} style={styles.bold}>
            {shareLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.appBackground,
    paddingHorizontal: spacing.screenX,
    gap: spacing.huge,
  },
  head: {
    alignItems: "center",
    gap: spacing.md,
  },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.sageTint,
  },
  chipMore: {
    backgroundColor: colors.surface2,
  },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardLine,
  },
  goal: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  goalLabel: {
    flexShrink: 1,
  },
  streak: {
    alignItems: "flex-end",
  },
  streakValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  number: {
    fontFamily: fonts.bodyExtraBold,
    fontVariant: ["tabular-nums"],
  },
  spacer: {
    flex: 1,
  },
  actions: {
    gap: spacing.xs,
  },
  share: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  semibold: {
    fontFamily: fonts.bodySemiBold,
  },
  bold: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.6,
  },
});
