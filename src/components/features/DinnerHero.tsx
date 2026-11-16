import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, fonts, radii, shadows, spacing } from "../../theme";
import { Text } from "../primitives";
import { FoodShelf } from "./FoodShelf";

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
  /** Foods hopping on a peach shelf across the top of the card. */
  shelf?: { name: string; category?: string | null }[];
  /** Butter pill under the body ("Your first recipe idea is free"). */
  pill?: string;
  /** Quiet link under the CTA, with an optional lead-in ("Not feeling it?"). */
  secondary?: { prefix?: string; label: string; onPress: () => void };
};

// The app's home moment: one card that answers what's for dinner — a dish
// when there is one, the question when there isn't — with one action.
export function DinnerHero({ eyebrow, title, body, meta, media, shelf, pill, ctaLabel, ctaIcon, loading = false, onPress, secondary }: Props) {
  return (
    <View style={styles.card}>
      {shelf ? (
        <View style={styles.shelf}>
          <FoodShelf foods={shelf} height={68} size={28} once />
        </View>
      ) : null}
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text variant="micro" uppercase color={colors.primary} style={styles.eyebrow}>
            {eyebrow}
          </Text>
          <Text variant="h3" style={styles.title}>
            {title}
          </Text>
          {body ? (
            <Text variant="small" muted style={styles.body}>
              {body}
            </Text>
          ) : null}
          {meta ? (
            <Text variant="micro" muted style={styles.meta}>
              {meta}
            </Text>
          ) : null}
          {pill ? (
            <View style={styles.pill}>
              <Text variant="micro" color={colors.accentInk}>
                {pill}
              </Text>
            </View>
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
            <Text variant="small" muted>
              {secondary.prefix}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={secondary.onPress}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text variant="small" color={colors.primary} weight="bold">
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
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    ...shadows.soft,
    padding: spacing.lg,
  },
  // Inset by the card's padding, like the paywall's shelf in its sheet.
  shelf: {
    marginBottom: spacing.md,
  },
  pill: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
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
