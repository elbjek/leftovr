import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { Text } from "./Text";

/**
 * safe / useSoon / urgent / expired match the Urgency keys exactly, so a
 * caller can pass `tone={item.urgency}` without a lookup table.
 */
export type PillTone = "neutral" | "safe" | "useSoon" | "urgent" | "expired" | "accent" | "solid";

type Props = {
  label: string;
  tone?: PillTone;
  /** A small glyph before the label. */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const TONES: Record<PillTone, { background: string; ink: string }> = {
  neutral: { background: colors.surface2, ink: colors.muted },
  safe: { background: colors.sageTint, ink: colors.primary },
  useSoon: { background: colors.accentSoft, ink: colors.accentInk },
  urgent: { background: colors.redSoft, ink: colors.redInk },
  expired: { background: colors.surface3, ink: colors.muted },
  accent: { background: colors.accent, ink: colors.text },
  solid: { background: colors.primary, ink: colors.onPrimary },
};

/**
 * A short status or count on a soft fill.
 *
 * The app hand-rolls thirteen of these with five different paddings and four
 * vertical rhythms. FoodListCard had the only correct model — a soft
 * background with its own ink, rather than coloured text on the page — and
 * this is that model, promoted.
 *
 * The label is required, which is the point: a pill always says the status
 * in words as well as colour, so it never fails WCAG 1.4.1.
 */
export function StatusPill({ label, tone = "neutral", icon, style }: Props) {
  const { background, ink } = TONES[tone];

  return (
    <View style={[styles.pill, { backgroundColor: background }, style]}>
      {icon}
      <Text variant="micro" color={ink} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xxs,
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
});
