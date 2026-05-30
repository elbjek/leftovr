import React from "react";
import { Text as RNText, TextProps as RNTextProps, StyleProp, StyleSheet, TextStyle } from "react-native";
import { colors, fonts, typography } from "../../theme";

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
        italic && getItalicStyle(variant),
        muted && styles.muted,
        center && styles.center,
        uppercase && styles.uppercase,
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

function getItalicStyle(variant: TextVariant): TextStyle {
  if (variant === "display" || variant === "hero") {
    return { fontFamily: fonts.displayItalic, fontStyle: "normal" };
  }

  return styles.italic;
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
