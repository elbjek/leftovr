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
  /** Label over the placeholder cards ("Your ideas"). */
  listLabel: string;
  /** Ordered pipeline steps; one shows at a time as work proceeds. */
  steps: string[];
  /** The screen's own top (logo, household pill), so the overlay keeps it. */
  header?: ReactNode;
  /** Kitchen foods to show on the plate, soonest to go off first. */
  foods?: string[];
};

/**
 * Full-screen loading state for AI recipe generation, built from the home's
 * own pieces: the header, then a white card with the hero's peach blob
 * holding a plate where the household's own foods (going-off first) take
 * turns under the logo's butter steam; the title, the current step, and a
 * four-part progress bar. Under it, h3 "Your ideas" over placeholder recipe
 * cards. Steps advance on a timer (perceived progress) and hold on the last
 * until the overlay unmounts. Honors reduce motion.
 */
export function GeneratingOverlay({ eyebrow, title, listLabel, steps, header, foods }: GeneratingOverlayProps) {
  const reduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [screenOpacity] = useState(() => new Animated.Value(0));
  const [phrase] = useState(() => new Animated.Value(1));

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

  // Each new step's line fades up in place of the last.
  useEffect(() => {
    if (reduceMotion) return;
    phrase.setValue(0);
    Animated.timing(phrase, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [activeStep, phrase, reduceMotion]);

  return (
    <Animated.View
      style={[styles.overlay, { opacity: screenOpacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`${title}. ${steps[activeStep] ?? ""}`}
      accessibilityLiveRegion="polite"
    >
      {/* The screen's safe area already clears the notch; lg matches the home's top. */}
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={false}>
        {header}
        <View style={styles.body}>
          <View style={styles.card}>
            <Plate foods={foods && foods.length > 0 ? foods : GLYPHS} reduceMotion={reduceMotion} />
            <View style={styles.copy}>
              <Text variant="micro" uppercase color={colors.primary}>
                {eyebrow}
              </Text>
              <Text variant="h3" style={styles.center}>
                {title}
              </Text>
              <Animated.View
                style={
                  !reduceMotion && {
                    opacity: phrase,
                    transform: [{ translateY: phrase.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
                  }
                }
              >
                <Text variant="small" muted style={styles.center}>
                  {steps[activeStep]}
                </Text>
              </Animated.View>
            </View>
            <View style={styles.progress}>
              {steps.map((_, i) => (
                <Segment key={i} state={i < activeStep ? "done" : i === activeStep ? "active" : "pending"} reduceMotion={reduceMotion} />
              ))}
            </View>
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

// The home hero's tilted peach blob with a white plate on it; the foods take
// turns on the plate and the logo's two butter wisps rise off it.
function Plate({ foods, reduceMotion }: { foods: string[]; reduceMotion: boolean }) {
  const [index, setIndex] = useState(0);
  const [pop] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % foods.length);
      if (reduceMotion) return;
      pop.setValue(0);
      Animated.timing(pop, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
    }, GLYPH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [foods.length, pop, reduceMotion]);

  return (
    <View style={styles.art}>
      <View style={styles.blob} />
      <View style={styles.steam}>
        <Wisp delay={0} reduceMotion={reduceMotion} />
        <Wisp delay={550} reduceMotion={reduceMotion} />
      </View>
      <View style={styles.plate}>
        <Animated.View
          style={
            !reduceMotion && {
              opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            }
          }
        >
          <FoodGlyph name={foods[index % foods.length]} size={64} />
        </Animated.View>
      </View>
    </View>
  );
}

// One steam wisp, as on the logo: rises, sways, fades, starts again.
function Wisp({ delay, reduceMotion }: { delay: number; reduceMotion: boolean }) {
  const [rise] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(rise, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rise, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, reduceMotion, rise]);

  return (
    <Animated.View
      style={
        !reduceMotion && {
          opacity: rise.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [8, -10] }) },
            { rotate: rise.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-6deg", "6deg", "-4deg"] }) },
          ],
        }
      }
    >
      <Svg width={10} height={20} viewBox="0 0 10 20" fill="none">
        <Path d="M4 18c0-4 4-4 4-8.5S4 5 5 2" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

// One quarter of the progress bar: tomato once reached, the current one breathing.
function Segment({ state, reduceMotion }: { state: "done" | "active" | "pending"; reduceMotion: boolean }) {
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduceMotion || state !== "active") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [pulse, reduceMotion, state]);

  return (
    <View style={styles.segment}>
      {state !== "pending" ? (
        <Animated.View style={[styles.segmentFill, state === "active" && !reduceMotion && { opacity: pulse }]} />
      ) : null}
    </View>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  body: {
    paddingHorizontal: spacing.screenX,
  },
  // The home's card surface: white, 24pt corners, the soft lift, no outline.
  card: {
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    ...shadows.soft,
  },
  art: {
    width: 168,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  // RecipeIdeas' heroBlob, scaled up.
  blob: {
    position: "absolute",
    width: 168,
    height: 140,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    transform: [{ rotate: "-14deg" }],
  },
  steam: {
    position: "absolute",
    top: 0,
    flexDirection: "row",
    gap: spacing.sm,
  },
  plate: {
    width: 104,
    height: 104,
    marginTop: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  copy: {
    alignItems: "center",
    gap: spacing.xxs,
  },
  center: {
    textAlign: "center",
  },
  progress: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  segmentFill: {
    flex: 1,
    backgroundColor: colors.primary,
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
});
