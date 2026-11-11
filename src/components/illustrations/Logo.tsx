import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts } from "../../theme";

type Props = {
  /** Font size of the wordmark text. */
  size?: number;
  /** "primary" = ink text for light surfaces; "inverse" = white text for tomato surfaces. */
  variant?: "primary" | "inverse";
};

const inkByVariant = {
  primary: { word: colors.text, r: colors.primary },
  inverse: { word: colors.onPrimary, r: colors.accent },
} as const;

/**
 * Brand mark (logo direction 08, "Stacked badge"): "leftovr" in Plus Jakarta
 * Sans ExtraBold, trailing "r" in gold rotated 9° (the intentional "crooked
 * r"). The "r" is colors.accent on every light surface — the one brand gold.
 * A logotype carries no contrast requirement (WCAG 1.4.11 exempts it), which
 * is why it can be the real gold here and nowhere else. Two gold steam wisps
 * rise over "left", as on the icon. The stacked version is the app icon (assets/images/icon.png). Colors
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
      <Steam fontSize={size} color={colors.accent} />
    </View>
  );
}

// The two gold steam wisps over "left", as on the app icon and splash: same paths
// as SteamSplash, in its 36-unit grid, one unit = 0.034em of the wordmark.
// Placed absolutely so the logo's layout box doesn't grow.
const STEAM_UNIT = 0.034;
const STEAM_LEFT = 0.46;
const STEAM_TOP = -0.115;
const WISPS = ["M12.5 13 c0 -2.4 2 -2.4 2 -4.8", "M21.5 13 c0 -2.4 2 -2.4 2 -4.8"];

function Steam({ fontSize, color }: GlyphProps) {
  const u = fontSize * STEAM_UNIT;
  return (
    <Svg
      pointerEvents="none"
      width={15 * u}
      height={8 * u}
      viewBox="10 6.5 15 8"
      style={{ position: "absolute", left: fontSize * STEAM_LEFT, top: fontSize * STEAM_TOP }}
    >
      {WISPS.map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={2.55} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
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
