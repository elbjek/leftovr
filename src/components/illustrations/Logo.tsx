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
 * Brand mark: "leftovr" wordmark in Young Serif with a gold diamond full stop.
 * Colors come from theme tokens so a colorscheme change carries the logo with it.
 */
export function Logo({ size = 48, variant = "primary" }: Props) {
  const text = variant === "inverse" ? colors.surface : colors.primary;
  const diamond = size * 0.22;
  return (
    <View style={styles.row}>
      <Text
        style={[styles.word, { fontSize: size, color: text }]}
        allowFontScaling={false}
        accessibilityRole="image"
        accessibilityLabel="leftovr"
      >
        leftovr
      </Text>
      <View
        style={{
          width: diamond,
          height: diamond,
          borderRadius: diamond * 0.28,
          backgroundColor: colors.accent,
          transform: [{ rotate: "45deg" }],
          marginLeft: size * 0.12,
          marginBottom: size * 0.06,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  word: {
    fontFamily: fonts.wordmark,
    includeFontPadding: false,
  },
});
