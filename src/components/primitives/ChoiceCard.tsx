import React from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../../theme";
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        active && styles.active,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? (
        <View style={[styles.icon, active && styles.activeIcon]}>{icon}</View>
      ) : null}
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text variant={compact ? "label" : "h3"} color={colors.text}>
            {title}
          </Text>
          {recommended && recommendedLabel ? (
            <View style={styles.badge}>
              <Text variant="micro" color={colors.text}>
                {recommendedLabel}
              </Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text
            variant="small"
            color={colors.muted}
            style={styles.subtitle}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: spacing.xl,
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  cardCompact: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  active: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sage,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
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
    backgroundColor: colors.paper,
  },
  copy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  subtitle: {
    marginTop: spacing.xxs,
  },
});
