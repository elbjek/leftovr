import React from "react";
import { Text as RNText, TextProps as RNTextProps, StyleProp, StyleSheet, TextStyle } from "react-native";
import { colors, typography } from "../../theme";

export type TextVariant = keyof typeof typography;

type Props = RNTextProps & {
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  center?: boolean;
  uppercase?: boolean;
  italic?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Text({
  variant = "body",
  color,
  muted,
  center,
  uppercase,
  italic,
  style,
  children,
  ...props
}: Props) {
  return (
    <RNText
      {...props}
      style={[
        styles.base,
        typography[variant] as TextStyle,
        muted && styles.muted,
        center && styles.center,
        uppercase && styles.uppercase,
        italic && styles.italic,
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
  center: {
    textAlign: "center",
  },
  uppercase: {
    textTransform: "uppercase",
  },
  italic: {
    fontStyle: "italic",
  },
});

