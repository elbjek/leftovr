import Svg, { Line, Path } from "react-native-svg";

import { colors } from "../../theme";

/**
 * The app's canonical "scan" mark (also the Scan tab icon): a receipt with
 * scan lines. Shared so scan CTAs across screens use one consistent glyph.
 */
export function ScanIcon({ color = colors.surface, size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 3h14v18l-2.3-1.8-2.35 1.8L12 19.2 9.65 21 7.3 19.2 5 21V3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={9} y1={8} x2={15} y2={8} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={9} y1={12} x2={13} y2={12} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
