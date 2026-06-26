import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Line, Path } from "react-native-svg";

import { colors, spacing } from "../../theme";
import { Text } from "./Text";

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return reduce;
}

/** Pulsing accent halo behind the receipt glyph — the one hero animation. */
function ReceiptPulse() {
  const reduce = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.25] });

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[styles.halo, !reduce && { transform: [{ scale }], opacity }]}
      />
      <Svg width={50} height={50} viewBox="0 0 50 50" fill="none">
        <Path
          d="M14 8h22v34l-3.5-3-3.5 3-3.5-3-3.5 3-3.5-3-3.5 3-3.5-3-3-2.5z"
          stroke={colors.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          fill={colors.surface}
        />
        <Line x1={18} y1={16} x2={32} y2={16} stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
        <Line x1={18} y1={22} x2={28} y2={22} stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function CheckDot() {
  return (
    <View style={styles.checkDot}>
      <Svg width={11} height={11} viewBox="0 0 11 11">
        <Path
          d="M2 6L4.5 8.5L9 3"
          stroke={colors.surface}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/**
 * Receipt-reading loading state: pulsing receipt glyph, title/body, and a
 * status checklist (first steps done, last one in progress). The checklist is
 * a reassurance cue, not wired to real OCR stages.
 */
export function ReceiptReadingProgress() {
  const { t } = useTranslation();
  const steps = [
    { label: t("scan.processingStep1"), done: true },
    { label: t("scan.processingStep2"), done: true },
    { label: t("scan.processingStep3"), done: false },
  ];

  return (
    <View style={styles.wrap}>
      <ReceiptPulse />
      <View style={styles.copy}>
        <Text variant="h1" center>
          {t("scan.processingTitle")}
        </Text>
        <Text variant="body" muted center style={styles.body}>
          {t("scan.processingBody")}
        </Text>
      </View>
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            {step.done ? (
              <CheckDot />
            ) : (
              <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
            )}
            <Text variant="small" style={step.done ? styles.stepDone : undefined}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.huge,
  },
  pulseWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.accentSoft,
  },
  copy: {
    alignItems: "center",
    maxWidth: 300,
  },
  body: {
    marginTop: spacing.md,
  },
  steps: {
    width: "100%",
    maxWidth: 300,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  spinner: {
    width: 20,
    height: 20,
  },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: {
    color: colors.muted,
  },
});
