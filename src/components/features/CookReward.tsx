import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { formatMoney } from "../../lib/money";
import { colors, radii, shadows, spacing, typography } from "../../theme";
import { FoodGlyph } from "../illustrations";
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
  /** May be async: the Share button shows a spinner until it settles. */
  onShare: () => void | Promise<void>;
};

// The payoff right after a cook, built from the home's pieces: a tomato block
// for the win (check, what was cooked, the money counting up), then white
// lifted cards for what was used up and for today's goal and streak, and the
// home's button pair at the foot. The check pops with one ring burst, the
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
  const [sharing, setSharing] = useState(false);
  const share = async () => {
    setSharing(true);
    try {
      await onShare();
    } finally {
      setSharing(false);
    }
  };

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
    <Animated.View style={[styles.screen, { opacity: pop, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      {/* Scrolls on a small phone or with large text, so the buttons below
          always stay on screen. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.blob} pointerEvents="none" />
          <View style={styles.checkSlot}>
            <Animated.View
              style={[
                styles.burst,
                {
                  opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                  transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                },
              ]}
            />
            <Animated.View style={[styles.check, { transform: [{ scale }] }]}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12l5 5 9-10" stroke={colors.primary} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          </View>
          <Text variant="micro" uppercase center color={colors.onPrimary} style={styles.soft}>
            {eyebrow}
          </Text>
          <Text variant="h3" center color={colors.onPrimary} accessibilityRole="header">
            {title}
          </Text>
          {money ? (
            <Animated.View
              style={[styles.money, slice(0.3, 0.75)]}
              accessible
              accessibilityLabel={`${money.label} ${formatMoney(money.value, money.currency)}${money.note ? `. ${money.note}` : ""}`}
            >
              <Text variant="micro" uppercase color={colors.text}>
                {money.label}
              </Text>
              <Text color={colors.text} style={styles.moneyValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(shown, money.currency)}
              </Text>
              {money.note ? (
                <Text variant="small" color={colors.accentInk} center>
                  {money.note}
                </Text>
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        {chips.length > 0 ? (
          <Animated.View style={[styles.card, styles.chips, slice(0.1, 0.5)]}>
            {chips.map((name, index) => (
              <Animated.View key={`${index}-${name}`} style={[styles.chip, slice(0.15 + index * 0.06, 0.45 + index * 0.06)]}>
                <FoodGlyph name={name} size={18} color={colors.text} />
                <Text variant="small" color={colors.text} weight="bold" numberOfLines={1} style={styles.shrink}>
                  {name}
                </Text>
              </Animated.View>
            ))}
            {more > 0 ? (
              <Animated.View style={[styles.chip, slice(0.15 + chips.length * 0.06, 0.45 + chips.length * 0.06)]}>
                <Text variant="small" muted>
                  {`+${more}`}
                </Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}

        {goal || streak ? (
          <Animated.View style={[styles.card, styles.progress, slice(0.45, 0.9)]}>
            <View style={styles.goal}>
              {goal ? (
                <>
                  <GoalRing done={goal.done} total={goal.total} size={52} stroke={7} track={colors.accent} color={colors.text} />
                  <Text variant="label" style={styles.shrink}>
                    {goal.label}
                  </Text>
                </>
              ) : null}
            </View>
            {streak ? (
              <View style={styles.streak} accessible accessibilityLabel={`${streak.value} ${streak.label}`}>
                <FlameIcon size={18} color={colors.primary} />
                <Text variant="title" style={styles.number}>
                  {streak.value}
                </Text>
                <Text variant="small" color={colors.accentInk}>
                  {streak.label}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {/* The share shape sits with the share action, not with the figures. */}
        <SegmentedControl<ShareFormat>
          value={format}
          onChange={onFormat}
          options={[
            { value: "post", label: formatLabels.post },
            { value: "story", label: formatLabels.story },
          ]}
        />
        <View style={styles.buttons}>
          <Button title={doneLabel} onPress={onDone} style={styles.button} />
          <Button
            title={shareLabel}
            variant="ghost"
            loading={sharing}
            onPress={() => void share()}
            iconLeft={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            style={[styles.button, styles.shareButton]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const CHECK = 60;

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.appBackground,
    gap: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  // Solid tomato, no shadow, like the home's goal block; the darker blob
  // clips at its edge.
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.xxl,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    right: -60,
    top: -70,
    width: 200,
    height: 200,
    borderRadius: radii.pill,
    backgroundColor: colors.primary700,
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
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  burst: {
    ...StyleSheet.absoluteFill,
    borderRadius: CHECK / 2,
    borderWidth: 2,
    borderColor: colors.onPrimary,
  },
  soft: {
    opacity: 0.85,
  },
  // Butter on tomato, like the home's streak pill, with the figure in ink.
  money: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: spacing.xxs,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.accentSoft,
  },
  moneyValue: {
    ...typography.display,
    fontVariant: ["tabular-nums"],
  },
  // RecipeListCard's surface: white, 24pt corners, the soft lift.
  card: {
    padding: spacing.lg,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
  },
  // The home's ingredient chip: outlined, the food's icon, its name.
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    maxWidth: "100%",
    minHeight: 34,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.bg,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  number: {
    fontVariant: ["tabular-nums"],
  },
  actions: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  // The home's "More ideas": peach, one step quieter than the primary.
  shareButton: {
    backgroundColor: colors.surface2,
  },
});
