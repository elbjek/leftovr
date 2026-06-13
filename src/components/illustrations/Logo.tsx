import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../theme";

type Props = {
  /** Font size of the wordmark text. */
  size?: number;
  /** "primary" = green text for light surfaces; "inverse" = cream text for dark/green surfaces. */
  variant?: "primary" | "inverse";
};

/**
 * Brand mark: "leftovr" wordmark in Fraunces SemiBold — "leftov" in the brand
 * color, trailing "r" in gold rotated 9° (the intentional "crooked r"), same
 * size as the other letters. Colors come from theme tokens so a colorscheme
 * change carries the logo with it. (Source: docs/Q _ Fridge magnet export.)
 */
export function Logo({ size = 48, variant = "primary" }: Props) {
  const head = variant === "inverse" ? colors.surface : colors.primary;
  return (
    <View style={styles.row}>
      <Text
        style={[styles.word, { fontSize: size, color: head }]}
        allowFontScaling={false}
        accessibilityRole="image"
        accessibilityLabel="leftovr"
      >
        leftov
      </Text>
      <Text
        allowFontScaling={false}
        style={[
          styles.word,
          {
            fontSize: size,
            color: colors.accent,
            transform: [{ rotate: "9deg" }, { translateY: size * 0.03 }],
          },
        ]}
      >
        r
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  word: {
    fontFamily: fonts.displaySemiBold,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
});
