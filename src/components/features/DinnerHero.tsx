import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, fonts, radii, spacing } from "../../theme";
import { Text } from "../primitives";

type Props = {
  eyebrow: string;
  title: string;
  body?: string;
  /** Small line under the body (e.g. "20 min • Easy • 5 of 6 in kitchen"). */
  meta?: string;
  /** Trailing picture of the dish, drawn on a tile beside the title. */
  media?: React.ReactNode;
  ctaLabel: string;
  ctaIcon?: React.ReactNode;
  loading?: boolean;
  onPress: () => void;
  /** Quiet link under the CTA, with an optional lead-in ("Not feeling it?"). */
  secondary?: { prefix?: string; label: string; onPress: () => void };
};

// The app's home moment: one card that answers what's for dinner — a dish
// when there is one, the question when there isn't — with one action. Dark
// with a tomato disc in the corner, like Insights' Premium card.
export function DinnerHero({ eyebrow, title, body, meta, media, ctaLabel, ctaIcon, loading = false, onPress, secondary }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.mark} pointerEvents="none" />
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text variant="micro" uppercase color={colors.accent} style={styles.eyebrow}>
            {eyebrow}
          </Text>
          <Text variant="h2" color={colors.onPrimary} style={styles.title}>
            {title}
          </Text>
          {body ? (
            <Text variant="small" color={colors.onPrimary} style={[styles.body, styles.soft]}>
              {body}
            </Text>
          ) : null}
          {meta ? (
            <Text variant="micro" color={colors.onPrimary} style={[styles.meta, styles.soft]}>
              {meta}
            </Text>
          ) : null}
        </View>
        {media ? <View style={styles.media}>{media}</View> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: loading }}
        disabled={loading}
        onPress={onPress}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            {ctaIcon}
            <Text variant="label" color={colors.onPrimary}>
              {ctaLabel}
            </Text>
          </>
        )}
      </Pressable>

      {secondary ? (
        <View style={styles.secondary}>
          {secondary.prefix ? (
            <Text variant="small" color={colors.muted2}>
              {secondary.prefix}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={secondary.onPress}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text variant="small" color={colors.accent} weight="bold">
              {secondary.label}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.text,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    overflow: "hidden",
  },
  mark: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  soft: {
    opacity: 0.8,
  },
  top: {
    flexDirection: "row",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.bodyExtraBold,
    letterSpacing: 0.66,
  },
  title: {
    fontFamily: fonts.bodyExtraBold,
    marginTop: spacing.xs,
  },
  body: {
    marginTop: spacing.xxs,
  },
  meta: {
    marginTop: spacing.sm,
  },
  media: {
    width: 84,
    height: 84,
    borderRadius: radii.xl,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    marginTop: spacing.lg,
    minHeight: 50,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  secondary: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
});
