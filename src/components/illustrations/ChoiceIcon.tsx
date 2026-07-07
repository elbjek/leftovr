import React from "react";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { colors, fonts } from "../../theme";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  RSD: "дин",
};

export const CHOICE_ICON_NAMES = [
  // cooking-for
  "me",
  "partner",
  "family",
  "big",
  // shopping style
  "weekly",
  "few",
  "asneed",
  // primary goal
  "waste",
  "money",
  "quick",
  "all",
  // dietary avoidances
  "meat",
  "fish",
  "dairy",
  "gluten",
  "nuts",
  // currency
  "USD",
  "EUR",
  "GBP",
  "RSD",
];

type Props = {
  name: string;
  color?: string;
  size?: number;
};

/**
 * Line-art glyphs for onboarding choice cards.
 * Returns null for unknown values so the caller can fall back to its emoji.
 */
export function ChoiceIcon({ name, color = colors.primary, size = 22 }: Props): React.ReactElement | null {
  const p = {
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  const box = (children: React.ReactNode) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {children}
    </Svg>
  );

  // ---- cooking-for ----
  if (name === "me") {
    return box(
      <>
        <Circle cx={12} cy={8} r={3.4} {...p} />
        <Path d="M5.5 19a6.5 6.5 0 0 1 13 0" {...p} />
      </>,
    );
  }
  if (name === "partner") {
    return box(
      <>
        <Circle cx={8.5} cy={8.5} r={2.8} {...p} />
        <Path d="M3.5 19a5 5 0 0 1 10 0" {...p} />
        <Circle cx={16} cy={8.5} r={2.8} {...p} />
        <Path d="M14 14.4a5 5 0 0 1 6.5 4.6" {...p} />
      </>,
    );
  }
  if (name === "family") {
    return box(
      <>
        <Circle cx={7} cy={7.5} r={2.4} {...p} />
        <Path d="M3 18a4 4 0 0 1 8 0" {...p} />
        <Circle cx={17} cy={7.5} r={2.4} {...p} />
        <Path d="M13 18a4 4 0 0 1 8 0" {...p} />
        <Circle cx={12} cy={11.5} r={1.9} {...p} />
        <Path d="M9 19.5a3 3 0 0 1 6 0" {...p} />
      </>,
    );
  }
  if (name === "big") {
    return box(
      <>
        <Path d="M4 11l8-6 8 6" {...p} />
        <Path d="M6 10v9h12v-9" {...p} />
        <Path d="M10 19v-4.5h4V19" {...p} />
      </>,
    );
  }

  // ---- shopping style ----
  if (name === "weekly") {
    // Full cart — the big weekly shop
    return box(
      <>
        <Path d="M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.1L20 7.5H6" {...p} />
        <Circle cx={9} cy={19} r={1.3} {...p} />
        <Circle cx={17} cy={19} r={1.3} {...p} />
      </>,
    );
  }
  if (name === "few") {
    // Basket — a couple of trips
    return box(
      <>
        <Path d="M4 9h16l-1.3 9a1.6 1.6 0 0 1-1.6 1.3H6.9a1.6 1.6 0 0 1-1.6-1.3L4 9Z" {...p} />
        <Path d="M8.5 9 11 4M15.5 9 13 4" {...p} />
        <Line x1={9.2} y1={12} x2={9.6} y2={16} {...p} />
        <Line x1={12} y1={12} x2={12} y2={16} {...p} />
        <Line x1={14.8} y1={12} x2={14.4} y2={16} {...p} />
      </>,
    );
  }
  if (name === "asneed") {
    // Single bag — grab what you need
    return box(
      <>
        <Path d="M6 8h12l-1 11a1.6 1.6 0 0 1-1.6 1.4H8.6A1.6 1.6 0 0 1 7 19L6 8Z" {...p} />
        <Path d="M9 8a3 3 0 0 1 6 0" {...p} />
      </>,
    );
  }

  // ---- primary goal ----
  if (name === "waste") {
    // Leaf — reduce waste
    return box(
      <>
        <Path d="M4 20c0-8 6-14 16-14 0 10-6 15-13 15-1 0-3 0-3-1Z" {...p} />
        <Path d="M4 20c2-5 6-8 11-9" {...p} />
      </>,
    );
  }
  if (name === "money") {
    // Coin — save money
    return box(
      <>
        <Circle cx={12} cy={12} r={8} {...p} />
        <Path d="M12 7.2v9.6" {...p} />
        <Path d="M14.3 9.4c-.6-.7-1.6-1.1-2.6-1.1-1.4 0-2.4.8-2.4 1.9 0 2.6 5.2 1.3 5.2 3.9 0 1.2-1.1 2-2.5 2-1.1 0-2.2-.4-2.8-1.2" {...p} />
      </>,
    );
  }
  if (name === "quick") {
    // Lightning — quick wins
    return box(<Path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" {...p} />);
  }
  if (name === "all") {
    // Sparkle — a bit of everything
    return box(<Path d="M12 4c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5Z" {...p} />);
  }

  // ---- dietary ----
  if (name === "meat") {
    // Drumstick
    return box(
      <>
        <Circle cx={9.5} cy={9.5} r={4.8} {...p} />
        <Path d="M6.3 12.7 3.6 18a1.7 1.7 0 0 0 2.4 2.4l5.3-2.7" {...p} />
      </>,
    );
  }
  if (name === "fish") {
    return box(
      <>
        <Path d="M3.5 12c3-5 10.5-5 13.5 0-3 5-10.5 5-13.5 0Z" {...p} />
        <Path d="M17 12l3.5-3v6l-3.5-3Z" {...p} />
        <Circle cx={8} cy={11} r={0.7} fill={color} stroke="none" />
      </>,
    );
  }
  if (name === "dairy") {
    // Milk carton
    return box(
      <>
        <Path d="M8 8.5h8V19a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19V8.5Z" {...p} />
        <Path d="M8 8.5 9.5 4h5L16 8.5" {...p} />
        <Line x1={8} y1={12.5} x2={16} y2={12.5} {...p} />
      </>,
    );
  }
  if (name === "gluten") {
    // Wheat
    return box(
      <>
        <Path d="M12 4.5v15.5" {...p} />
        <Path d="M12 9c-1.6-1-3.2-.8-3.8-2.6M12 9c1.6-1 3.2-.8 3.8-2.6" {...p} />
        <Path d="M12 13c-1.6-1-3.2-.8-3.8-2.6M12 13c1.6-1 3.2-.8 3.8-2.6" {...p} />
        <Path d="M12 17c-1.6-1-3.2-.8-3.8-2.6M12 17c1.6-1 3.2-.8 3.8-2.6" {...p} />
      </>,
    );
  }
  if (name === "nuts") {
    // Peanut
    return box(
      <>
        <Path
          d="M12 3.2a3.4 3.4 0 0 1 3.4 3.4c0 1.4-1 2.3-1 4s1 2.6 1 4A3.4 3.4 0 1 1 8.6 14.6c0-1.4 1-2.3 1-4s-1-2.6-1-4A3.4 3.4 0 0 1 12 3.2Z"
          {...p}
        />
        <Path d="M9.6 10.6h4.8" {...p} />
      </>,
    );
  }

  // ---- currency: coin with the symbol ----
  if (CURRENCY_SYMBOLS[name]) {
    const symbol = CURRENCY_SYMBOLS[name];
    return box(
      <>
        <Circle cx={12} cy={12} r={8} {...p} />
        <SvgText
          x={12}
          y={12}
          fontSize={name === "RSD" ? 6.5 : 11}
          fontFamily={fonts.bodyBold}
          fill={color}
          stroke="none"
          textAnchor="middle"
          alignmentBaseline="central"
        >
          {symbol}
        </SvgText>
      </>,
    );
  }

  return null;
}
