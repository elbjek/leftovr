import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../theme";

type Props = {
  /** Font size of the wordmark text. */
  size?: number;
  /** "primary" = green text for light surfaces; "inverse" = cream text for dark/green surfaces;
   * "onAccent" = green with a green "r" for gold surfaces, where a gold "r" would vanish. */
  variant?: "primary" | "inverse" | "onAccent";
};

const inkByVariant = {
  primary: { word: colors.text, r: colors.primary },
  inverse: { word: colors.onPrimary, r: colors.accent },
  onAccent: { word: colors.primary, r: colors.primary },
} as const;

/**
 * Brand mark (logo direction 08, "Stacked badge"): "leftovr" in Plus Jakarta
 * Sans ExtraBold, trailing "r" in gold rotated 9° (the intentional "crooked
 * r"). The "r" is colors.accent on every light surface — the one brand gold.
 * A logotype carries no contrast requirement (WCAG 1.4.11 exempts it), which
 * is why it can be the real gold here and nowhere else. The stacked version is the app icon (assets/images/icon.png). Colors
 * come from theme tokens so a colorscheme change carries the logo with it.
 */
export function Logo({ size = 48, variant = "primary" }: Props) {
  const ink = inkByVariant[variant];
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="leftovr">
      <Word fontSize={size} color={ink.word}>
        leftov
      </Word>
      <CrookedR fontSize={size} color={ink.r} />
    </View>
  );
}

type GlyphProps = { fontSize: number; color: string };

function Word({ fontSize, color, children }: GlyphProps & { children: string }) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        styles.word,
        { fontSize, color, letterSpacing: fontSize * -0.04 },
      ]}
    >
      {children}
    </Text>
  );
}

function CrookedR({ fontSize, color }: GlyphProps) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        styles.word,
        {
          fontSize,
          color,
          marginLeft: fontSize * 0.07,
          transform: [{ rotate: "9deg" }, { translateY: fontSize * 0.03 }],
        },
      ]}
    >
      r
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  word: {
    fontFamily: fonts.logo,
    includeFontPadding: false,
  },
});
