import React from "react";
import Svg, { Circle, Ellipse, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "../../theme";

type SizeProps = {
  width?: number;
  height?: number;
};

export function ForgottenFridgeIllustration({ width = 220, height = 220 }: SizeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 220 220">
      <Rect x="50" y="20" width="120" height="180" rx="14" fill={colors.surface2} stroke={colors.hairlineStrong} />
      <Line x1="50" y1="78" x2="170" y2="78" stroke={colors.hairlineStrong} />
      <Rect x="58" y="34" width="3" height="32" rx="1.5" fill={colors.primary} opacity="0.4" />
      <Rect x="58" y="92" width="3" height="92" rx="1.5" fill={colors.primary} opacity="0.4" />
      <Circle cx="115" cy="48" r="10" fill={colors.accent} opacity="0.4" />
      <Circle cx="90" cy="120" r="6" fill={colors.muted} opacity="0.25" />
      <Circle cx="130" cy="135" r="9" fill={colors.muted} opacity="0.2" />
      <Circle cx="105" cy="160" r="5" fill={colors.muted} opacity="0.3" />
      <Circle cx="145" cy="170" r="4" fill={colors.muted} opacity="0.25" />
      <SvgText x="190" y="32" fontSize="28" fill={colors.primary} opacity="0.4" fontStyle="italic">
        ?
      </SvgText>
      <SvgText x="34" y="64" fontSize="18" fill={colors.primary} opacity="0.3" fontStyle="italic">
        ?
      </SvgText>
    </Svg>
  );
}

export function AliveFridgeIllustration({ width = 220, height = 220 }: SizeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 220 220">
      <Circle cx="110" cy="110" r="86" fill={colors.primary700} opacity="0.42" />
      <Circle cx="110" cy="110" r="60" fill={colors.accent} opacity="0.34" />
      <Rect x="70" y="38" width="80" height="124" rx="10" fill={colors.surface} stroke={colors.accentSoft} strokeWidth="3" />
      <Line x1="70" y1="86" x2="150" y2="86" stroke={colors.primary} opacity="0.24" />
      <Rect x="82" y="50" width="18" height="34" rx="3" fill={colors.green} opacity="0.82" />
      <Rect x="106" y="50" width="18" height="34" rx="3" fill={colors.accent} opacity="0.82" />
      <Rect x="130" y="50" width="18" height="34" rx="3" fill={colors.red} opacity="0.82" />
      <Rect x="82" y="98" width="24" height="32" rx="3" fill={colors.green} opacity="0.58" />
      <Rect x="112" y="98" width="22" height="32" rx="3" fill={colors.accent} opacity="0.62" />
      <Rect x="82" y="138" width="38" height="18" rx="3" fill={colors.muted2} opacity="0.5" />
      <Rect x="126" y="138" width="22" height="18" rx="3" fill={colors.green} opacity="0.42" />
      <Path d="M38 110 H52 M45 103 V117" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" />
      <Path d="M166 62 H176 M171 57 V67" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" />
      <Path d="M176 146 H190 M183 139 V153" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" />
      <Path d="M52 166 H64 M58 160 V172" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

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

export function ScanLoopIllustration({ width = 260, height = 160 }: SizeProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 260 160">
      <Rect x="0" y="20" width="80" height="120" rx="10" fill={colors.paper} stroke={colors.hairlineStrong} />
      <Path d="M10 30 L10 40 M10 30 L20 30" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M70 30 L70 40 M70 30 L60 30" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M10 130 L10 120 M10 130 L20 130" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M70 130 L70 120 M70 130 L60 130" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" />
      <Rect x="20" y="50" width="40" height="2" rx="1" fill={colors.muted} />
      <Rect x="20" y="60" width="32" height="2" rx="1" fill={colors.muted} />
      <Rect x="20" y="70" width="44" height="2" rx="1" fill={colors.muted} />

      <Path d="M88 80 L98 80 M92 76 L98 80 L92 84" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      <Rect x="102" y="20" width="56" height="120" rx="8" fill={colors.surface2} stroke={colors.hairlineStrong} />
      <Line x1="102" y1="70" x2="158" y2="70" stroke={colors.hairlineStrong} />
      <Rect x="108" y="28" width="12" height="34" rx="2" fill={colors.green} opacity="0.7" />
      <Rect x="124" y="28" width="12" height="34" rx="2" fill={colors.accent} opacity="0.85" />
      <Rect x="140" y="28" width="12" height="34" rx="2" fill={colors.red} opacity="0.7" />
      <Rect x="108" y="78" width="20" height="28" rx="2" fill={colors.green} opacity="0.5" />
      <Rect x="132" y="78" width="20" height="28" rx="2" fill={colors.primary} opacity="0.5" />
      <Rect x="108" y="114" width="44" height="20" rx="2" fill={colors.accent} opacity="0.45" />

      <Path d="M166 80 L176 80 M170 76 L176 80 L170 84" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      <Rect x="180" y="20" width="80" height="120" rx="10" fill={colors.paper} stroke={colors.hairlineStrong} />
      <Ellipse cx="220" cy="100" rx="28" ry="6" fill={colors.primary} opacity="0.1" />
      <Ellipse cx="220" cy="94" rx="26" ry="14" fill={colors.paper} stroke={colors.hairlineStrong} />
      <Ellipse cx="220" cy="90" rx="22" ry="10" fill={colors.accent} opacity="0.4" />
      <Circle cx="212" cy="88" r="3" fill={colors.green} />
      <Circle cx="226" cy="85" r="2.5" fill={colors.red} />
      <Circle cx="220" cy="94" r="2" fill={colors.primary} opacity="0.6" />
      <SvgText x="220" y="126" fontSize="9" fill={colors.primary} textAnchor="middle" fontWeight="600">
        20 min
      </SvgText>
    </Svg>
  );
}
