import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { formatMoney } from "../../lib/money";
import { colors, fonts, radii, shadows, spacing, typography } from "../../theme";
import { Button, SegmentedControl, Text } from "../primitives";
import type { ShareFormat } from "./ShareCard";
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
  /** The money figure that counts up, with its label and an optional line under it. */
  money: { value: number; currency: string; label: string; note: string | null } | null;
  /** Today's goal after this cook; null when it couldn't be loaded. */
  goal: { done: number; total: number; label: string } | null;
  /** e.g. { value: 5, label: "day streak" }; null when it couldn't be loaded. */
  streak: { value: number; label: string } | null;
  doneLabel: string;
  shareLabel: string;
  /** The shape the share image is drawn in: Instagram post or story. */
  format: ShareFormat;
  formatLabels: { post: string; story: string };
  onFormat: (format: ShareFormat) => void;
  onDone: () => void;
  onShare: () => void;
};

// The payoff right after a cook: what was rescued, what it saved and what it
// did for the streak. The check pops with one ring burst, the used items and
// cards follow in a short stagger and the money counts up once. Reduce Motion
// shows the end state. A full-screen layer, not a Modal: it rides in the cook
// sheet's Modal (BottomSheet `overlay`) so iOS never has to stack two.
export function CookReward({ visible, eyebrow, title, items, money, goal, streak, doneLabel, shareLabel, format, formatLabels, onFormat, onDone, onShare }: Props) {
  const insets = useSafeAreaInsets();
  const [pop] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));
  const [count] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(0);
  const target = money?.value ?? 0;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const values = [pop, burst, enter, count];
    // Listen first, so the reset also clears the last cook's figure.
    const listener = count.addListener(({ value }) => setShown(value));
    values.forEach((v) => v.setValue(0));
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        pop.setValue(1);
        burst.setValue(1);
        enter.setValue(1);
        count.setValue(target);
        return;
      }
      Animated.parallel([
        Animated.timing(pop, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, delay: 120, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(enter, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        // Drives text, so JS-driven; it starts once the money card is in.
        Animated.timing(count, { toValue: target, delay: 300, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
    });
    return () => {
      cancelled = true;
      count.removeListener(listener);
      values.forEach((v) => v.stopAnimation());
    };
  }, [burst, count, enter, pop, target, visible]);

  if (!visible) return null;

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  // A slice of `enter` per element, so they arrive one after another.
  const slice = (start: number, end: number) => ({
    opacity: enter.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [{ translateY: enter.interpolate({ inputRange: [start, end], outputRange: [12, 0], extrapolate: "clamp" }) }],
  });

  const chips = items.slice(0, MAX_CHIPS);
  const more = items.length - chips.length;

  return (
    <Animated.View
      style={[styles.screen, { opacity: pop, paddingTop: insets.top + spacing.huge * 2, paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <View style={styles.head}>
        <View style={styles.checkSlot}>
          <Animated.View
            style={[
              styles.burst,
              {
                opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
              },
            ]}
          />
          <Animated.View style={[styles.check, { transform: [{ scale }] }]}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12l5 5 9-10" stroke={colors.onPrimary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </View>
        <Text variant="micro" muted uppercase center>
          {eyebrow}
        </Text>
        <Text variant="h3" center accessibilityRole="header">
          {title}
        </Text>
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map((name, index) => (
              <Animated.View key={`${index}-${name}`} style={[styles.chip, slice(0.1 + index * 0.06, 0.4 + index * 0.06)]}>
                <Text variant="small" color={colors.primary} weight="bold" numberOfLines={1}>
                  {name}
                </Text>
              </Animated.View>
            ))}
            {more > 0 ? (
              <Animated.View style={[styles.chip, styles.chipMore, slice(0.1 + chips.length * 0.06, 0.4 + chips.length * 0.06)]}>
                <Text variant="small" muted>
                  {`+${more}`}
                </Text>
              </Animated.View>
            ) : null}
          </View>
        ) : null}
      </View>

      {money ? (
        <Animated.View
          style={[styles.money, slice(0.35, 0.8)]}
          accessible
          accessibilityLabel={`${money.label} ${formatMoney(money.value, money.currency)}${money.note ? `. ${money.note}` : ""}`}
        >
          <Text variant="micro" uppercase color={colors.sage}>
            {money.label}
          </Text>
          <Text color={colors.accent} style={styles.moneyValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(shown, money.currency)}
          </Text>
          {money.note ? (
            <Text variant="small" color={colors.onPrimary} style={styles.moneyNote}>
              {money.note}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}

      {goal || streak ? (
        <Animated.View style={[styles.card, slice(0.45, 0.9)]}>
          <View style={styles.goal}>
            {goal ? (
              <>
                <GoalRing done={goal.done} total={goal.total} />
                <Text variant="label" style={styles.shrink}>
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
        </Animated.View>
      ) : null}

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button title={doneLabel} onPress={onDone} />
        <View style={styles.format}>
          <SegmentedControl<ShareFormat>
            value={format}
            onChange={onFormat}
            options={[
              { value: "post", label: formatLabels.post },
              { value: "story", label: formatLabels.story },
            ]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onShare}
          hitSlop={8}
          style={({ pressed }) => [styles.share, pressed && styles.pressed]}
        >
          <Text variant="label" color={colors.primary}>
            {shareLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const CHECK = 72;

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.appBackground,
    paddingHorizontal: spacing.screenX,
    gap: spacing.xxl,
  },
  head: {
    alignItems: "center",
    gap: spacing.md,
  },
  checkSlot: {
    width: CHECK,
    height: CHECK,
    marginBottom: spacing.xs,
  },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  burst: {
    ...StyleSheet.absoluteFill,
    borderRadius: CHECK / 2,
    borderWidth: 2,
    borderColor: colors.primary,
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
  money: {
    alignItems: "center",
    gap: spacing.xxs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
  },
  moneyValue: {
    ...typography.display,
    fontVariant: ["tabular-nums"],
  },
  moneyNote: {
    opacity: 0.8,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    ...shadows.soft,
    borderRadius: radii.xl,
  },
  goal: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  shrink: {
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
  // The share shape sits with the share action, not with the figures.
  format: {
    alignSelf: "center",
    marginTop: spacing.xs,
  },
  share: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
