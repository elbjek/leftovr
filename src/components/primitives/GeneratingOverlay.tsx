import { ReactNode, useEffect, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { colors, radii, shadows, spacing } from "../../theme";
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
  const reduceMotion = useReducedMotion();
  const [glyphIndex, setGlyphIndex] = useState(0);
  const [halo] = useState(() => new Animated.Value(0));
  const [glyphPop] = useState(() => new Animated.Value(1));

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
  /** Small label over the title ("New ideas"). */
  eyebrow: string;
  title: string;
  /** Label over the placeholder cards ("Ideas for tonight"). */
  listLabel: string;
  /** Ordered pipeline steps; each lights up then completes as work proceeds. */
  steps: string[];
  /** The screen's own top (logo, household pill), so the overlay keeps it. */
  header?: ReactNode;
};

type StepState = "pending" | "active" | "done";

/**
 * Full-screen loading state for AI recipe generation, in the home's style:
 * the screen's header, one white card with the eyebrow, title and step
 * checklist, then an h3 section of placeholder recipe cards where the ideas
 * will land. Steps advance pending → active → done on a
 * timer (perceived progress), holding the last step until the overlay
 * unmounts. Honors the system reduce-motion setting.
 */
export function GeneratingOverlay({ eyebrow, title, listLabel, steps, header }: GeneratingOverlayProps) {
  const reduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [screenOpacity] = useState(() => new Animated.Value(0));

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
      {/* The screen's safe area already clears the notch; lg matches the home's top. */}
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: spacing.lg }]} scrollEnabled={false}>
        {header}
        <View style={styles.body}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text variant="micro" uppercase color={colors.primary}>
                {eyebrow}
              </Text>
              <Text variant="h3">{title}</Text>
            </View>
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
          <Text variant="h3" style={styles.listLabel}>
            {listLabel}
          </Text>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} index={i} reduceMotion={reduceMotion} />
          ))}
        </View>
      </ScrollView>
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
      <Text variant={state === "pending" ? "body" : "label"} color={state === "pending" ? colors.muted : colors.text}>
        {label}
      </Text>
    </Animated.View>
  );
}

// A stand-in for the home's recipe card (thumb, badge, title, meta), breathing
// while the ideas are written.
function SkeletonCard({ index, reduceMotion }: { index: number; reduceMotion: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, delay: index * 150, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [index, pulse, reduceMotion]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1 - index * 0.2, 0.55 - index * 0.12] });
  return (
    <Animated.View style={[styles.skeleton, { opacity }]}>
      <View style={styles.skeletonTile} />
      <View style={styles.skeletonCopy}>
        <View style={[styles.skeletonLine, styles.skeletonBadge]} />
        <View style={[styles.skeletonLine, styles.skeletonTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonMeta]} />
      </View>
    </Animated.View>
  );
}

function CheckMark() {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
      <Path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={colors.onPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
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
    backgroundColor: colors.bg,
    zIndex: 50,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  body: {
    paddingHorizontal: spacing.screenX,
  },
  // The home's card surface: white, 24pt corners, the soft lift, no outline.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    ...shadows.soft,
  },
  cardHead: {
    gap: spacing.xxs,
    marginBottom: spacing.sm,
  },
  listLabel: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  skeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  skeletonTile: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
  },
  skeletonCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonLine: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  skeletonBadge: {
    width: "30%",
    height: 8,
  },
  skeletonTitle: {
    width: "75%",
    height: 14,
  },
  skeletonMeta: {
    width: "50%",
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
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
  },
  indicator: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  // Round like the shopping list's tick: hollow, peach with a tomato core, tomato with a check.
  dotPending: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.hairlineStrong,
  },
  dotActiveRing: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotActiveCore: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  pulseRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  dotDone: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
