import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, spacing } from "../../theme";
import { Button, Text } from "../primitives";

type Props = {
  visible: boolean;
  /** e.g. "Lemon spinach pasta · cooked". */
  eyebrow: string;
  /** e.g. "4 things saved from the bin". */
  title: string;
  /** Up to three figures in one card (today's goal, streak, money saved). */
  stats: { value: string; label: string }[];
  doneLabel: string;
  shareLabel: string;
  onDone: () => void;
  onShare: () => void;
};

// The payoff right after a cook: what was rescued and what it did for the
// streak. Same cream, bordered look as the home; the check pops in once.
export function CookReward({ visible, eyebrow, title, stats, doneLabel, shareLabel, onDone, onShare }: Props) {
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

  return (
    <Modal animationType="fade" visible={visible} onRequestClose={onDone}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing.huge * 2, paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.head}>
          <Animated.View style={[styles.check, { opacity: pop, transform: [{ scale }] }]}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12l5 5 9-10" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
          <Text variant="micro" muted uppercase center>
            {eyebrow}
          </Text>
          <Text variant="h1" center accessibilityRole="header">
            {title}
          </Text>
        </View>

        {stats.length > 0 ? (
          <View style={styles.stats}>
            {stats.map((stat, index) => (
              <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
                <Text variant="h2" color={colors.primary} style={styles.statValue}>
                  {stat.value}
                </Text>
                <Text variant="small" muted center>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
    paddingHorizontal: spacing.screenX,
    gap: spacing.xxl,
  },
  head: {
    alignItems: "center",
    gap: spacing.md,
  },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  stats: {
    flexDirection: "row",
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.xl,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.cardLine,
  },
  statValue: {
    fontFamily: fonts.bodyExtraBold,
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
  bold: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.6,
  },
});
