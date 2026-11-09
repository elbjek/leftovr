import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { colors, radii, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { FOOD_ICON_IMAGES } from "../illustrations/foodIconImages";

const COUNT = 3;
const HOP = 8;
// Single foods only: the category icons are baskets and plates, too busy this small.
const FOODS = Object.keys(FOOD_ICON_IMAGES).filter((id) => !id.startsWith("category_"));

function pickFoods() {
  const pool = [...FOODS];
  return Array.from({ length: COUNT }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
}

/**
 * The app's loader: three foods, picked at random each time it mounts,
 * hopping one after another over their little shadows. Still (no hop) when
 * the device asks for reduced motion.
 */
export function FoodLoader({ size = 30 }: { size?: number }) {
  const reduce = useReducedMotion();
  const [foods] = useState(pickFoods);
  const [beat] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(beat, { toValue: 1, duration: 1300, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [beat, reduce]);

  return (
    <View style={styles.row} accessible accessibilityRole="progressbar">
      {foods.map((food, index) => {
        // Each food takes its turn: a soft arc up and down, then waits.
        const start = 0.05 + index * 0.18;
        const inputRange = [0, start, start + 0.1, start + 0.2, start + 0.3, start + 0.4, 1];
        const arc = (peak: number, rest: number) => [rest, rest, rest + (peak - rest) * 0.7, peak, rest + (peak - rest) * 0.7, rest, rest];
        return (
          <View key={food} style={styles.slot}>
            <Animated.View
              style={
                reduce
                  ? undefined
                  : {
                      transform: [
                        { translateY: beat.interpolate({ inputRange, outputRange: arc(-HOP, 0) }) },
                        { rotate: beat.interpolate({ inputRange, outputRange: arc(8, 0).map((deg) => `${deg}deg`) }) },
                      ],
                    }
              }
            >
              <FoodGlyph name={food} size={size} />
            </Animated.View>
            <Animated.View
              style={[
                styles.shadow,
                { width: size * 0.5 },
                !reduce && {
                  transform: [{ scaleX: beat.interpolate({ inputRange, outputRange: arc(0.55, 1) }) }],
                  opacity: beat.interpolate({ inputRange, outputRange: arc(0.5, 1) }),
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: spacing.md,
    // Room for the hop, so the row doesn't nudge what's above it.
    paddingTop: HOP,
  },
  slot: {
    alignItems: "center",
    gap: spacing.xxs,
  },
  shadow: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
  },
});
