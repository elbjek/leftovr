import React from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, fonts, radii, shadows, spacing, typography } from "../../theme";
import { Text } from "./Text";

type ButtonVariant = "primary" | "ghost" | "text" | "accent";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Hug the label as a centered pill instead of stretching to the container. */
  fit?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  fit = false,
  iconLeft,
  iconRight,
  style,
}: Props) {
  const isText = variant === "text";
  const foreground = getForeground(variant);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isText && styles.textButton,
        fit && styles.fit,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {iconLeft ? <View style={styles.iconLeft}>{iconLeft}</View> : null}
          <Text
            variant="label"
            color={foreground}
            style={[styles.title, isText && styles.textTitle]}
          >
            {title}
          </Text>
          {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

function getForeground(variant: ButtonVariant) {
  if (variant === "primary") return colors.surface;
  if (variant === "accent") return colors.text;
  return colors.primary;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.primary,
    ...shadows.primaryButton,
  },
  accent: {
    backgroundColor: colors.accent,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
  },
  text: {
    backgroundColor: "transparent",
  },
  textButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  fit: {
    alignSelf: "center",
    minWidth: 200,
    paddingHorizontal: spacing.huge,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  title: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.body,
  },
  textTitle: {
    color: colors.muted,
  },
});
