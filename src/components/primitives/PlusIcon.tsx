import Svg, { Path } from "react-native-svg";

import { colors } from "../../theme";

/** The app's "add" mark: the dock's Add button and Kitchen's round "+". */
export function PlusIcon({ color = colors.surface, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M10 4V16M4 10H16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
