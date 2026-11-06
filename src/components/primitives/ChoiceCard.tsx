import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { StatusPill } from "./StatusPill";
import { Tappable } from "./Tappable";
import { Text } from "./Text";

type Props = {
  title: string;
  subtitle?: string;
  recommendedLabel?: string;
  recommended?: boolean;
  selected?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Tighter list-style sizing for sheets and settings. */
  compact?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * One option in a list of options.
 *
 * The 1.5px outline is gone. Resting is a white surface on the grey page;
 * selected flips the fill to sageTint, which is a stronger signal than the
 * border ever was and does not depend on noticing a colour change in a
 * 1.5px line.
 *
 * The fill is a tint rather than the solid primary the interaction spec
 * uses for chips: a ChoiceCard carries a muted subtitle, and muted text on
 * dark green is unreadable. The tint keeps both lines legible.
 */
export function ChoiceCard({
  title,
  subtitle,
  recommendedLabel,
  recommended = false,
  selected = false,
  icon,
  trailing,
  compact = false,
  onPress,
  style,
}: Props) {
  const active = recommended || selected;

  return (
    <Tappable
      onPress={onPress}
      feedback="scale"
      selected={selected}
      label={[title, subtitle].filter(Boolean).join(". ")}
      hitSlop={0}
      style={[styles.card, compact && styles.cardCompact, active && styles.active, style]}
    >
      {icon ? <View style={[styles.icon, active && styles.activeIcon]}>{icon}</View> : null}
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text variant={compact ? "label" : "h3"}>{title}</Text>
          {recommended && recommendedLabel ? <StatusPill label={recommendedLabel} tone="accent" /> : null}
        </View>
        {subtitle ? (
          <Text variant="small" muted style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  cardCompact: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  active: {
    backgroundColor: colors.sageTint,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIcon: {
    backgroundColor: colors.surface,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  subtitle: {
    marginTop: spacing.xxs,
  },
});
