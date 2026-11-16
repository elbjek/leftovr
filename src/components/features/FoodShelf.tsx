import { ReactNode, useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { useReducedMotion } from "../../hooks/useReducedMotion";

const HOP = 10;

type Props = {
  /** Food names or icon ids; a category picks the icon when the name has none. */
  foods: { name: string; category?: string | null }[];
  height?: number;
  /** Icon size; the shelf line sits proportionally lower for smaller foods. */
  size?: number;
  /** Hop through once instead of looping (the home; the paywall loops). */
  once?: boolean;
  /** A label hung over one food (the paywall's "today"). */
  tag?: { index: number; node: ReactNode };
  /** Drawn over the shelf, e.g. a pill in the corner. */
  children?: ReactNode;
};

/**
 * One hop each for `count` foods, in turn on a shared 2.4s beat (the shelf's
 * rhythm, reused by the home's first-run cards): looping, or a single pass
 * with `once`. Still under reduced motion.
 */
export function useHop(count: number, once = false) {
  const reduce = useReducedMotion();
  const [beat] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) return;
    const pass = Animated.timing(beat, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true });
    const anim = once ? pass : Animated.loop(pass);
    anim.start();
    return () => anim.stop();
  }, [beat, once, reduce]);

  return Array.from({ length: count }, (_, i) => {
    const start = 0.05 + i * 0.12;
    return beat.interpolate({
      inputRange: [0, start, start + 0.06, start + 0.12, 1],
      outputRange: [0, 0, -HOP, 0, 0],
    });
  });
}

/**
 * A peach shelf of foods hopping one after another (the paywall hero, also
 * the home's dinner card). Still when the device asks for reduced motion.
 */
export function FoodShelf({ foods, height = 144, size = 40, once = false, tag, children }: Props) {
  const hops = useHop(foods.length, once);
  // 22 / 28 at the paywall's 40pt foods.
  const shelfBottom = Math.round(size * 0.55);

  return (
    <View style={[styles.shelfWell, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
      <View style={[styles.foods, { bottom: shelfBottom + 6 }]}>
        {foods.map((food, i) => (
          <Animated.View key={`${food.name}-${i}`} style={[styles.food, { transform: [{ translateY: hops[i] }] }]}>
            {tag?.index === i ? <View style={styles.tag}>{tag.node}</View> : null}
            <FoodGlyph name={food.name} category={food.category} size={size} />
          </Animated.View>
        ))}
      </View>
      <View style={[styles.shelf, { bottom: shelfBottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shelfWell: {
    backgroundColor: colors.surface2,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  foods: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  food: {
    alignItems: "center",
  },
  tag: {
    position: "absolute",
    top: -18,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    zIndex: 1,
  },
  shelf: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
  },
});
