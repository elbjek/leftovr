import React from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { colors } from "../../theme";

type SizeProps = {
  width?: number;
  height?: number;
};

export function ReceiptToFridgeIllustration({ width = 280, height = 200 }: SizeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 280 200">
      <Path d="M10 20 L90 20 L90 160 L80 152 L70 160 L60 152 L50 160 L40 152 L30 160 L20 152 L10 160 Z" fill={colors.paper} stroke={colors.hairlineStrong} />
      <Rect x="20" y="34" width="50" height="3" rx="1" fill={colors.text} opacity="0.6" />
      <Rect x="20" y="46" width="40" height="2" rx="1" fill={colors.muted} />
      <Rect x="20" y="64" width="60" height="2" rx="1" fill={colors.muted} />
      <Rect x="20" y="72" width="44" height="2" rx="1" fill={colors.muted} />
      <Rect x="20" y="80" width="56" height="2" rx="1" fill={colors.muted} />
      <Rect x="20" y="98" width="60" height="3" rx="1" fill={colors.text} opacity="0.7" />
      <Path d="M110 100 H150 M140 90 L150 100 L140 110" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="120" cy="84" r="2" fill={colors.accent} />
      <Circle cx="140" cy="126" r="2" fill={colors.accent} />
      <Rect x="170" y="18" width="100" height="160" rx="12" fill={colors.surface2} stroke={colors.hairlineStrong} />
      <Line x1="170" y1="80" x2="270" y2="80" stroke={colors.hairlineStrong} />
      <Rect x="180" y="32" width="22" height="36" rx="3" fill={colors.green} opacity="0.7" />
      <Rect x="208" y="32" width="22" height="36" rx="3" fill={colors.accent} opacity="0.85" />
      <Rect x="236" y="32" width="22" height="36" rx="3" fill={colors.red} opacity="0.7" />
      <Rect x="180" y="92" width="18" height="34" rx="3" fill={colors.primary} opacity="0.5" />
      <Rect x="204" y="92" width="28" height="34" rx="3" fill={colors.green} opacity="0.55" />
      <Rect x="238" y="92" width="20" height="34" rx="3" fill={colors.accent} opacity="0.65" />
      <Rect x="180" y="134" width="34" height="32" rx="3" fill={colors.muted} opacity="0.45" />
      <Rect x="220" y="134" width="38" height="32" rx="3" fill={colors.green} opacity="0.45" />
    </Svg>
  );
}
