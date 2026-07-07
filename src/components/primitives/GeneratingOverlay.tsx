import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations/FoodGlyph";
import { Text } from "./Text";

// Cycled through FoodGlyph's known shapes — feels like ingredients being considered.
const GLYPHS = ["tomato", "carrot", "cheese", "milk", "spinach", "bread", "egg", "onion"];

const GLYPH_INTERVAL_MS = 1100;
// How long each pipeline step stays "active" before the next lights up. Holds
// on the last step until generation finishes and the overlay unmounts.
const STEP_INTERVAL_MS = 1600;

type GeneratingLoaderProps = {
  /** Diameter of the halo; the glyph scales with it. */
  size?: number;
};

/**
 * The animated brand loader on its own: pulsing halo + cycling ingredient
 * glyph. Embed inline on screens that load in place; GeneratingOverlay wraps
 * it for the full-screen generation state. Honors reduce-motion by swapping
 * glyphs without pulses.
 */
export function GeneratingLoader({ size = 150 }: GeneratingLoaderProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [glyphIndex, setGlyphIndex] = useState(0);
  const [halo] = useState(() => new Animated.Value(0));
  const [glyphPop] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo, reduceMotion]);

  useEffect(() => {
    const timer = setInterval(() => {
      setGlyphIndex((index) => (index + 1) % GLYPHS.length);
      if (!reduceMotion) {
        glyphPop.setValue(0.85);
        Animated.timing(glyphPop, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }).start();
      }
    }, GLYPH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [glyphPop, reduceMotion]);

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.3] });

  return (
    <Animated.View style={[styles.hero, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.halo,
          { borderRadius: size / 2 },
          !reduceMotion && { transform: [{ scale: haloScale }], opacity: haloOpacity },
        ]}
      />
      <Animated.View style={!reduceMotion && { transform: [{ scale: glyphPop }] }}>
        <FoodGlyph name={GLYPHS[glyphIndex]} size={size * 0.43} color={colors.primary} />
      </Animated.View>
    </Animated.View>
  );
}

type GeneratingOverlayProps = {
  title: string;
  /** Ordered pipeline steps; each lights up then completes as work proceeds. */
  steps: string[];
};

type StepState = "pending" | "active" | "done";

/**
 * Full-screen loading state for AI recipe generation: the brand hero loader
 * over an animated step checklist. Steps advance pending → active → done on a
 * timer (perceived progress), holding the last step until the overlay
 * unmounts. Honors the system reduce-motion setting.
 */
export function GeneratingOverlay({ title, steps }: GeneratingOverlayProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [screenOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, screenOpacity]);

  // Walk the active step forward, then hold on the last one.
  useEffect(() => {
    if (activeStep >= steps.length - 1) return;
    const timer = setTimeout(
      () => setActiveStep((index) => Math.min(index + 1, steps.length - 1)),
      STEP_INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [activeStep, steps.length]);

  return (
    <Animated.View
      style={[styles.overlay, { opacity: screenOpacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`${title}. ${steps[activeStep] ?? ""}`}
      accessibilityLiveRegion="polite"
    >
      <GeneratingLoader size={112} />
      <Text variant="h2" center style={styles.title}>
        {title}
      </Text>
      <View style={styles.steps}>
        {steps.map((label, i) => (
          <StepRow
            key={i}
            label={label}
            index={i}
            state={i < activeStep ? "done" : i === activeStep ? "active" : "pending"}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function StepRow({
  label,
  index,
  state,
  reduceMotion,
}: {
  label: string;
  index: number;
  state: StepState;
  reduceMotion: boolean;
}) {
  const [enter] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [pulse] = useState(() => new Animated.Value(0));

  // Staggered entrance as the list appears.
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      delay: index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index, reduceMotion]);

  // Breathing halo on the active step only.
  useEffect(() => {
    if (reduceMotion || state !== "active") return;
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, state, reduceMotion]);

  const enterStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Animated.View style={[styles.stepRow, !reduceMotion && enterStyle]}>
      <View style={styles.indicator}>
        {state === "done" ? (
          <View style={styles.dotDone}>
            <CheckMark />
          </View>
        ) : state === "active" ? (
          <>
            {!reduceMotion ? (
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
            ) : null}
            <View style={styles.dotActiveRing}>
              <View style={styles.dotActiveCore} />
            </View>
          </>
        ) : (
          <View style={styles.dotPending} />
        )}
      </View>
      <Text variant="body" color={state === "pending" ? colors.muted : colors.text} style={state !== "pending" ? styles.stepLabelStrong : undefined}>
        {label}
      </Text>
    </Animated.View>
  );
}

function CheckMark() {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
      <Path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={colors.surface} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.appBackground,
    paddingHorizontal: spacing.screenX,
    zIndex: 50,
  },
  hero: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.accentSoft,
    opacity: 0.55,
  },
  title: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  steps: {
    alignSelf: "center",
    gap: spacing.lg,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  indicator: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  dotPending: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
  },
  dotActiveRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  dotActiveCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  pulseRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
  },
  dotDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabelStrong: {
    fontWeight: "600",
  },
});
