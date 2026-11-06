import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";

import { colors, fonts, radii, spacing } from "../../theme";
import { BottomSheet, Button, Text } from "../primitives";
import { FlameIcon } from "./WeekStrip";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** The day count reached, e.g. 7. */
  days: number;
  title: string;
  body: string;
  /** Shown when this milestone also banked a streak freeze. */
  freezeNote?: string;
  doneLabel: string;
};

// The payoff for a streak milestone: a flame badge that pops once, the day
// count, and what it means in food rather than points. Shown from the home,
// so it covers days earned by cooking and by marking things used alike.
export function StreakMilestone({ visible, onDismiss, days, title, body, freezeNote, doneLabel }: Props) {
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
      Animated.timing(pop, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
      pop.stopAnimation();
    };
  }, [visible, pop]);

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.content}>
        <Animated.View style={[styles.badge, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
          <FlameIcon size={30} />
          <Text variant="h1" color={colors.accentInk} weight="extrabold">
            {days}
          </Text>
        </Animated.View>

        <Text variant="h2" style={styles.title}>
          {title}
        </Text>
        <Text variant="small" muted style={styles.body}>
          {body}
        </Text>
        {freezeNote ? (
          <Text variant="small" color={colors.primary} style={styles.freeze}>
            {freezeNote}
          </Text>
        ) : null}

        <Button title={doneLabel} onPress={onDismiss} style={styles.cta} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  title: {
    marginTop: spacing.md,
    textAlign: "center",
    fontFamily: fonts.bodyExtraBold,
  },
  body: {
    marginTop: spacing.xs,
    textAlign: "center",
  },
  freeze: {
    marginTop: spacing.sm,
    fontFamily: fonts.bodyBold,
  },
  cta: {
    marginTop: spacing.lg,
    alignSelf: "stretch",
  },
});
