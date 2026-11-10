import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { colors } from "../../theme";

// Must equal app.json's expo-splash-screen imageWidth: this screen replaces
// the native splash pixel for pixel, then sets the steam moving.
const SIZE = 200;
// Steam geometry unit, 1% of the image. The same numbers drew the static
// steam into assets/images/splash-icon.png.
const U = SIZE / 100;
const WISP_W = 5 * U;
const WISP_H = 8.5 * U;
const STEAM_TOP = 12.5 * U;
// Side room inside the clip so the wobble never shaves the stroke.
const PAD = 1.5 * U;
const RISE_MS = 1500;
const WOBBLE_MS = 600;
const FADE_MS = 250;
// ponytail: one rise is the minimum on screen; lower it if launch feels slow.
const MIN_MS = 1600;

// The two wisps from the old bowl favicon, each in its own 5-unit-wide box.
// They wobble in opposite directions and rise 400ms apart.
const WISPS = [
  { d: "M12.5 13 c0 -2.4 2 -2.4 2 -4.8", box: 11, left: 43 * U, delay: 0, sway: 7 },
  { d: "M21.5 13 c0 -2.4 2 -2.4 2 -4.8", box: 20, left: 52 * U, delay: 400, sway: -7 },
];

type Props = {
  /** The app underneath can be shown. */
  ready: boolean;
  onDone: () => void;
};

/**
 * Launch screen: takes over from the identical native splash, then the steam
 * over "left" rises and wobbles until the app is ready (and at least one
 * rise has played), and fades out. Still under reduced motion.
 */
export function SteamSplash({ ready, onDone }: Props) {
  const reduce = useReducedMotion();
  const [held, setHeld] = useState(true);
  const [fade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setTimeout(() => setHeld(false), reduce ? 0 : MIN_MS);
    return () => clearTimeout(timer);
  }, [reduce]);

  // Fallback: never leave the native splash up if the image load event is lost.
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || held) return;
    Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => onDone());
  }, [fade, held, onDone, ready]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.screen, { opacity: fade }]}>
      <View style={styles.image}>
        <Image
          source={require("../../../assets/images/splash-base.png")}
          style={styles.image}
          onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        />
        {WISPS.map((wisp) => (
          <Wisp key={wisp.box} {...wisp} still={reduce} />
        ))}
      </View>
    </Animated.View>
  );
}

function Wisp({ d, box, left, delay, sway, still }: (typeof WISPS)[number] & { still: boolean }) {
  // Both run 0 -> 1 on repeat; 0 and 1 are the resting frame the native splash shows.
  const [rise] = useState(() => new Animated.Value(0));
  const [wobble] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (still) return;
    const loop = (value: Animated.Value, duration: number) =>
      // The sequence wrapper makes the loop restart each round itself; a bare native timing
      // hands looping to the native module, which web doesn't have.
      Animated.loop(Animated.sequence([Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })]));
    const wobbling = loop(wobble, WOBBLE_MS);
    const rising = loop(rise, RISE_MS);
    wobbling.start();
    const timer = setTimeout(() => rising.start(), delay);
    return () => {
      clearTimeout(timer);
      wobbling.stop();
      rising.stop();
    };
  }, [delay, rise, still, wobble]);

  // Drift up and fade out, drop below the clip's bottom edge, slide back up into place.
  const at = [0, 0.3, 0.55, 0.551, 0.8, 1];
  return (
    // The clip reaches one wisp-height above the resting spot; its bottom edge hides the wisp before it rises.
    <View style={[styles.clip, { left: left - PAD, top: STEAM_TOP - WISP_H }]}>
      <Animated.View
        style={[
          styles.wisp,
          {
            opacity: rise.interpolate({ inputRange: at, outputRange: [1, 0.6, 0, 1, 1, 1] }),
            transform: [
              { translateY: rise.interpolate({ inputRange: at, outputRange: [0, -2 * U, -3 * U, WISP_H, 0.15 * WISP_H, 0] }) },
              {
                rotate: wobble.interpolate({
                  inputRange: [0, 0.25, 0.75, 1],
                  outputRange: ["0deg", `${sway}deg`, `${-sway}deg`, "0deg"],
                }),
              },
            ],
          },
        ]}
      >
        <Svg width={WISP_W} height={WISP_H} viewBox={`${box} 6.5 5 8.5`}>
          <Path d={d} stroke={colors.accent} strokeWidth={3} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    zIndex: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: SIZE,
    height: SIZE,
  },
  clip: {
    position: "absolute",
    width: WISP_W + PAD * 2,
    height: WISP_H * 2,
    overflow: "hidden",
  },
  wisp: {
    position: "absolute",
    bottom: 0,
    left: PAD,
    width: WISP_W,
    height: WISP_H,
    transformOrigin: "50% 100%",
  },
});
