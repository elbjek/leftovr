import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";

import { colors, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations/FoodGlyph";
import { Text } from "./Text";

type GeneratingOverlayProps = {
  title: string;
  /** Rotating status lines shown under the title, in order. */
  phrases: string[];
};

// Cycled through FoodGlyph's known shapes — feels like ingredients being considered.
const GLYPHS = ["tomato", "carrot", "cheese", "milk", "spinach", "bread", "egg", "onion"];

const GLYPH_INTERVAL_MS = 1100;
const PHRASE_INTERVAL_MS = 3000;

/**
 * Full-screen loading state for AI recipe generation. One hero animation
 * (pulsing halo + cycling ingredient glyph) per the one-key-element rule;
 * everything else is static. Honors the system reduce-motion setting by
 * swapping content without pulses or fades.
 */
export function GeneratingOverlay({ title, phrases }: GeneratingOverlayProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [glyphIndex, setGlyphIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const [screenOpacity] = useState(() => new Animated.Value(0));
  const [halo] = useState(() => new Animated.Value(0));
  const [glyphPop] = useState(() => new Animated.Value(1));
  const [phraseOpacity] = useState(() => new Animated.Value(1));

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

  useEffect(() => {
    if (phrases.length < 2) return;
    const timer = setInterval(() => {
      if (reduceMotion) {
        setPhraseIndex((index) => (index + 1) % phrases.length);
        return;
      }
      Animated.timing(phraseOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setPhraseIndex((index) => (index + 1) % phrases.length);
        Animated.timing(phraseOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [phraseOpacity, phrases.length, reduceMotion]);

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.3] });

  return (
    <Animated.View
      style={[styles.overlay, { opacity: screenOpacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={styles.hero}>
        <Animated.View
          style={[
            styles.halo,
            !reduceMotion && { transform: [{ scale: haloScale }], opacity: haloOpacity },
          ]}
        />
        <Animated.View style={!reduceMotion && { transform: [{ scale: glyphPop }] }}>
          <FoodGlyph name={GLYPHS[glyphIndex]} size={64} color={colors.primary} />
        </Animated.View>
      </Animated.View>
      <Text variant="h2" center style={styles.title}>
        {title}
      </Text>
      <Animated.View style={!reduceMotion && { opacity: phraseOpacity }}>
        <Text variant="body" muted center>
          {phrases[phraseIndex] ?? ""}
        </Text>
      </Animated.View>
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.appBackground,
    paddingHorizontal: spacing.screenX,
    zIndex: 50,
  },
  hero: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.huge,
  },
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 75,
    backgroundColor: colors.accentSoft,
    opacity: 0.55,
  },
  title: {
    marginBottom: spacing.md,
  },
});
