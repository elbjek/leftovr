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
  /** A label hung over one food (the paywall's "today"). */
  tag?: { index: number; node: ReactNode };
  /** Drawn over the shelf, e.g. a pill in the corner. */
  children?: ReactNode;
};

/**
 * A peach shelf of foods hopping one after another (the paywall hero, also
 * the home's dinner card). Still when the device asks for reduced motion.
 */
export function FoodShelf({ foods, height = 144, tag, children }: Props) {
  const reduce = useReducedMotion();
  const [beat] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(beat, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [beat, reduce]);

  return (
    <View style={[styles.shelfWell, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
      <View style={styles.foods}>
        {foods.map((food, i) => {
          const start = 0.05 + i * 0.12;
          const translateY = beat.interpolate({
            inputRange: [0, start, start + 0.06, start + 0.12, 1],
            outputRange: [0, 0, -HOP, 0, 0],
          });
          return (
            <Animated.View key={`${food.name}-${i}`} style={[styles.food, { transform: [{ translateY }] }]}>
              {tag?.index === i ? <View style={styles.tag}>{tag.node}</View> : null}
              <FoodGlyph name={food.name} category={food.category} size={40} />
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.shelf} />
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
    bottom: 28,
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
    bottom: 22,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
  },
});
