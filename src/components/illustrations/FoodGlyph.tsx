import React from "react";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";
import { colors } from "../../theme";

type Props = {
  name: string;
  color?: string;
  size?: number;
};

export function FoodGlyph({ name, color = colors.primary, size = 36 }: Props) {
  const n = name.toLowerCase();
  const common = {
    stroke: color,
    strokeWidth: 1.5,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (n.includes("egg")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Ellipse cx="18" cy="20" rx="10" ry="13" {...common} />
      </Svg>
    );
  }

  if (n.includes("yog") || n.includes("milk")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Rect x="9" y="8" width="18" height="22" rx="2" {...common} />
        <Line x1="9" y1="14" x2="27" y2="14" {...common} />
      </Svg>
    );
  }

  if (n.includes("spin") || n.includes("lettuce") || n.includes("kale")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Path d="M6 22 Q10 8 18 8 Q26 8 30 22 Q26 28 18 28 Q10 28 6 22Z" {...common} />
        <Line x1="18" y1="8" x2="18" y2="28" {...common} />
      </Svg>
    );
  }

  if (n.includes("tomato")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Circle cx="18" cy="20" r="10" {...common} />
        <Path d="M14 10 Q18 8 22 10" {...common} />
      </Svg>
    );
  }

  if (n.includes("chick") || n.includes("beef") || n.includes("pork") || n.includes("meat")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Path d="M10 20 Q10 12 18 12 Q26 12 26 20 Q26 26 18 26 Q10 26 10 20Z" {...common} />
        <Circle cx="18" cy="20" r="3" {...common} />
      </Svg>
    );
  }

  if (n.includes("pasta") || n.includes("rice") || n.includes("bread") || n.includes("sourdough")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Path d="M8 22 L28 22 L26 12 L10 12 Z" {...common} />
      </Svg>
    );
  }

  if (n.includes("cheese")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Path d="M6 24 L18 10 L30 24 Z" {...common} />
        <Circle cx="16" cy="20" r="1" {...common} />
        <Circle cx="22" cy="22" r="1" {...common} />
      </Svg>
    );
  }

  if (n.includes("apple") || n.includes("orang") || n.includes("lemon")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Circle cx="18" cy="20" r="9" {...common} />
        <Line x1="18" y1="11" x2="20" y2="8" {...common} />
      </Svg>
    );
  }

  if (n.includes("carrot")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Path d="M12 12 L24 12 L18 30 Z" {...common} />
        <Line x1="14" y1="9" x2="16" y2="12" {...common} />
        <Line x1="22" y1="9" x2="20" y2="12" {...common} />
      </Svg>
    );
  }

  if (n.includes("butter")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Rect x="8" y="14" width="20" height="12" rx="1" {...common} />
        <Line x1="8" y1="18" x2="28" y2="18" {...common} />
      </Svg>
    );
  }

  if (n.includes("onion") || n.includes("garlic")) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Path d="M18 8 Q26 12 24 22 Q22 28 18 28 Q14 28 12 22 Q10 12 18 8Z" {...common} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Circle cx="18" cy="20" r="10" {...common} />
    </Svg>
  );
}

