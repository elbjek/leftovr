import React from "react";
import { Text as RNText, TextProps as RNTextProps, StyleProp, StyleSheet, TextStyle } from "react-native";
import { colors, fonts, typography } from "../../theme";

export type TextVariant = keyof typeof typography;

/**
 * Overrides the variant's own cut. The app sets fontFamily by hand 77 times
 * across 26 files — almost always to bold a label or extra-bold a number —
 * and every one of those also sets a numeric fontWeight that does nothing,
 * because a named font cut makes it a no-op on iOS. This is that, once.
 */
export type TextWeight = "regular" | "medium" | "semibold" | "bold" | "extrabold";

const WEIGHTS: Record<TextWeight, string> = {
  regular: fonts.body,
  medium: fonts.bodyMedium,
  semibold: fonts.bodySemiBold,
  bold: fonts.bodyBold,
  extrabold: fonts.bodyExtraBold,
};

type Props = RNTextProps & {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: string;
  muted?: boolean;
  center?: boolean;
  uppercase?: boolean;
  italic?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Text({
  variant = "body",
  weight,
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
        weight ? { fontFamily: WEIGHTS[weight] } : null,
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

function getItalicStyle(_variant: TextVariant): TextStyle {
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
