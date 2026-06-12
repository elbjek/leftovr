import React from "react";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../theme";

type Props = {
  size?: number;
  /** "primary" = green bowl for light surfaces; "inverse" = cream bowl for dark/green surfaces. */
  variant?: "primary" | "inverse";
};

/**
 * Brand mark: bowl with gold steam (docs/E3 exports are the source of truth).
 * Strokes use theme tokens so a colorscheme change carries the logo with it.
 */
export function Logo({ size = 48, variant = "primary" }: Props) {
  const bowl = variant === "inverse" ? colors.surface : colors.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Path d="M5 19 h26 a13 13 0 0 1 -26 0 Z" stroke={bowl} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M12.5 13 c0 -2.4 2 -2.4 2 -4.8" stroke={colors.accent} strokeWidth={2.55} strokeLinecap="round" />
      <Path d="M21.5 13 c0 -2.4 2 -2.4 2 -4.8" stroke={colors.accent} strokeWidth={2.55} strokeLinecap="round" />
    </Svg>
  );
}
