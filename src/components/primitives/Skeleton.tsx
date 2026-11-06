import React, { useEffect, useState } from "react";
import { Animated, DimensionValue, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { colors, radii } from "../../theme";

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A placeholder in the shape of the thing that is loading.
 *
 * Fourteen screens answer a wait with a centred ActivityIndicator, which
 * tells you something is happening but not what is coming or how much of
 * it. Anything over 400ms gets one of these instead, laid out in the shape
 * of the result, so the page does not jump when the data lands.
 *
 * It pulses opacity only — no shimmer sweeping across the screen — and
 * holds still entirely when the device asks for reduced motion.
 */
export function Skeleton({ width = "100%", height = 16, radius, circle = false, style }: Props) {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={[
        styles.base,
        { width, height, borderRadius: circle ? height / 2 : (radius ?? radii.xs), opacity: pulse },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface2,
  },
});
