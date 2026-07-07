import { useEffect, useRef, useState } from "react";
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

export type ProcessingStep = "recognising" | "matching" | "estimating" | "complete";

const STEP_ORDER: Exclude<ProcessingStep, "complete">[] = ["recognising", "matching", "estimating"];

type RowStatus = "done" | "active" | "pending";

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

/** Green check that scales in when a step completes. */
function CheckDot() {
  const [scale] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 120 }).start();
  }, [scale]);
  return (
    <Animated.View style={[styles.checkDot, { transform: [{ scale }] }]}>
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
    </Animated.View>
  );
}

function StepRow({ label, status }: { label: string; status: RowStatus }) {
  const opacity = useRef(new Animated.Value(status === "pending" ? 0.4 : 1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: status === "pending" ? 0.4 : 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [status, opacity]);

  return (
    <Animated.View style={[styles.stepRow, { opacity }]}>
      {status === "done" ? (
        <CheckDot />
      ) : status === "active" ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      ) : (
        <View style={styles.pendingDot} />
      )}
      <Text variant="small" style={status === "active" ? undefined : styles.stepMuted}>
        {label}
      </Text>
    </Animated.View>
  );
}

/**
 * Receipt-reading loading state driven by real processing progress. Each step
 * shows done (check) / active (spinner) / pending (dim), derived from `step`.
 * The last step and the "complete" transition are gated on the real backend
 * response — earlier steps auto-advance as reassurance.
 */
export function ReceiptReadingProgress({ step = "recognising" }: { step?: ProcessingStep }) {
  const { t } = useTranslation();

  const currentIndex = step === "complete" ? STEP_ORDER.length : STEP_ORDER.indexOf(step);
  const labels = [t("scan.processingStep1"), t("scan.processingStep2"), t("scan.processingStep3")];
  const bodyKey =
    step === "recognising" ? "scan.processingBody1" : step === "matching" ? "scan.processingBody2" : "scan.processingBody3";

  function statusFor(index: number): RowStatus {
    if (index < currentIndex) return "done";
    if (index === currentIndex) return "active";
    return "pending";
  }

  return (
    <View style={styles.wrap}>
      <ReceiptPulse />
      <View style={styles.copy}>
        <Text variant="h1" center>
          {t("scan.processingTitle")}
        </Text>
        <Text variant="body" muted center style={styles.body}>
          {t(bodyKey)}
        </Text>
      </View>
      <View style={styles.steps}>
        {labels.map((label, index) => (
          <StepRow key={index} label={label} status={statusFor(index)} />
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
  pendingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.hairlineStrong,
  },
  stepMuted: {
    color: colors.muted,
  },
});
