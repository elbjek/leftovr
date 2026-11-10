import { useEffect, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Alert, Animated, Easing, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { formatMoney } from "../../lib/money";
import { colors, radii, shadows, spacing, typography } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Button, Text } from "../primitives";
import type { ShareFormat } from "./ShareCard";
import { FlameIcon } from "./WeekStrip";

// More than this and the row runs off a small phone; the rest fold into "+N".
const MAX_FOODS = 4;
// Each food sits a little off the line and a little tilted, so the row looks
// tossed rather than lined up.
const SCATTER = [
  { y: 6, rotate: "-8deg" },
  { y: -10, rotate: "6deg" },
  { y: 4, rotate: "-4deg" },
  { y: -8, rotate: "8deg" },
  { y: 8, rotate: "-6deg" },
  { y: -4, rotate: "4deg" },
];

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
  /** The Post / Story question asked when Share is tapped. */
  shareAs: { title: string; post: string; story: string; cancel: string };
  onDone: () => void;
  /** Shares the image in the picked shape; the Share button spins until it settles. */
  onShare: (format: ShareFormat) => void | Promise<void>;
};

// The payoff right after a cook, kept minimal: no cards, no colour blocks.
// The foods you saved pop in as a scattered row of white bubbles (the fun
// part), then one line on what was saved, the money counting up in tomato,
// a quiet goal and streak line, and Done / Share at the foot. Reduce Motion
// shows the end state. A full-screen layer, not a Modal: it rides in the cook
// sheet's Modal (BottomSheet `overlay`) so iOS never has to stack two.
export function CookReward({ visible, eyebrow, title, items, money, goal, streak, doneLabel, shareLabel, shareAs, onDone, onShare }: Props) {
  const insets = useSafeAreaInsets();
  const [pop] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));
  const [count] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(0);
  const target = money?.value ?? 0;
  const [sharing, setSharing] = useState(false);
  const share = async (format: ShareFormat) => {
    setSharing(true);
    try {
      await onShare(format);
    } finally {
      setSharing(false);
    }
  };
  // Post or story is asked on the tap, not with a switch on the screen.
  const pickFormat = () => {
    const formats: ShareFormat[] = ["post", "story"];
    const options = [shareAs.post, shareAs.story];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: shareAs.title, options: [...options, shareAs.cancel], cancelButtonIndex: 2 },
        (index) => {
          if (index < 2) void share(formats[index]);
        },
      );
      return;
    }
    Alert.alert(shareAs.title, undefined, [
      ...formats.map((format, index) => ({ text: options[index], onPress: () => void share(format) })),
      { text: shareAs.cancel, style: "cancel" as const },
    ]);
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const values = [pop, enter, count];
    // Listen first, so the reset also clears the last cook's figure.
    const listener = count.addListener(({ value }) => setShown(value));
    values.forEach((v) => v.setValue(0));
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        pop.setValue(1);
        enter.setValue(1);
        count.setValue(target);
        return;
      }
      Animated.parallel([
        Animated.timing(pop, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
        Animated.timing(enter, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        // Drives text, so JS-driven; it starts once the money card is in.
        Animated.timing(count, { toValue: target, delay: 300, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
    });
    return () => {
      cancelled = true;
      count.removeListener(listener);
      values.forEach((v) => v.stopAnimation());
    };
  }, [count, enter, pop, target, visible]);

  if (!visible) return null;

  // A slice of `enter` per element, so they arrive one after another.
  const slice = (start: number, end: number) => ({
    opacity: enter.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [{ translateY: enter.interpolate({ inputRange: [start, end], outputRange: [12, 0], extrapolate: "clamp" }) }],
  });
  // Foods pop: each scales up from nothing with a little overshoot.
  const popAt = (index: number) => {
    const start = Math.min(index * 0.08, 0.5);
    return enter.interpolate({ inputRange: [start, start + 0.25, start + 0.35], outputRange: [0, 1.12, 1], extrapolate: "clamp" });
  };

  const foods = items.slice(0, MAX_FOODS);
  const more = items.length - foods.length;
  const bubbles = [...foods.map((name) => ({ key: name, name })), ...(more > 0 ? [{ key: "more", name: null }] : [])];

  return (
    <Animated.View style={[styles.screen, { opacity: pop, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.foods} accessible={false} importantForAccessibility="no-hide-descendants">
          <Sparks style={styles.sparksLeft} />
          {bubbles.map((bubble, index) => {
            const scale = popAt(index);
            const spot = SCATTER[index % SCATTER.length];
            return (
              <Animated.View
                key={`${index}-${bubble.key}`}
                style={[styles.bubble, index > 0 && styles.overlap, { transform: [{ translateY: spot.y }, { rotate: spot.rotate }, { scale }] }]}
              >
                {bubble.name ? (
                  <FoodGlyph name={bubble.name} size={36} />
                ) : (
                  <Text variant="label" muted>
                    {`+${more}`}
                  </Text>
                )}
              </Animated.View>
            );
          })}
          <Sparks style={styles.sparksRight} flip />
        </View>

        <Animated.View style={[styles.copy, slice(0.3, 0.6)]}>
          <Text variant="small" muted center>
            {eyebrow}
          </Text>
          <Text variant="h3" center accessibilityRole="header">
            {title}
          </Text>
        </Animated.View>

        {money ? (
          <Animated.View
            style={[styles.money, slice(0.4, 0.75)]}
            accessible
            accessibilityLabel={`${money.label} ${formatMoney(money.value, money.currency)}${money.note ? `. ${money.note}` : ""}`}
          >
            <Text variant="small" muted center>
              {money.label}
            </Text>
            <Text color={colors.primary} style={styles.moneyValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(shown, money.currency)}
            </Text>
            {money.note ? (
              <Text variant="small" muted center>
                {money.note}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}

        {goal || streak ? (
          <Animated.View style={[styles.status, slice(0.55, 0.9)]}>
            {goal ? (
              <View style={styles.statusItem}>
                <CheckIcon />
                <Text variant="small" weight="bold">
                  {goal.label}
                </Text>
              </View>
            ) : null}
            {streak ? (
              <View style={styles.statusItem} accessible accessibilityLabel={`${streak.value} ${streak.label}`}>
                <FlameIcon size={16} color={colors.primary} />
                <Text variant="small" weight="bold">
                  {`${streak.value} ${streak.label}`}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Button title={doneLabel} onPress={onDone} style={styles.button} />
        <Button
          title={shareLabel}
          variant="ghost"
          loading={sharing}
          onPress={pickFormat}
          iconLeft={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          }
          style={[styles.button, styles.shareButton]}
        />
      </View>
    </Animated.View>
  );
}

// Three gold strokes, the Kitchen's "What to cook next?" spark.
function Sparks({ style, flip }: { style: object; flip?: boolean }) {
  return (
    <View style={[style, flip && styles.flip]} pointerEvents="none">
      <Svg width={26} height={24} viewBox="0 0 30 26">
        <Path d="M4 16l7 3M10 6l5 7M22 2l-1 8" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const BUBBLE = 60;

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.appBackground,
  },
  scroll: {
    flex: 1,
  },
  // Centred in the space above the buttons.
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  foods: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  overlap: {
    marginLeft: -12,
  },
  sparksLeft: {
    alignSelf: "flex-start",
    marginRight: spacing.xs,
  },
  sparksRight: {
    alignSelf: "flex-end",
    marginLeft: spacing.xs,
  },
  flip: {
    transform: [{ scaleX: -1 }, { scaleY: -1 }],
  },
  copy: {
    gap: spacing.xxs,
  },
  money: {
    alignItems: "center",
  },
  moneyValue: {
    ...typography.display,
    fontVariant: ["tabular-nums"],
  },
  status: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: spacing.lg,
    rowGap: spacing.xs,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
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
