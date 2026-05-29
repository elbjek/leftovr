import React from "react";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../theme";

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

export function ScannerCorners({ width = 220, height = 320, color = colors.accent }: Props) {
  const inset = 0;
  const len = 30;
  const strokeWidth = 4;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={`M${inset} ${len} L${inset} ${inset} L${len} ${inset}`} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
      <Path d={`M${width - len} ${inset} L${width} ${inset} L${width} ${len}`} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
      <Path d={`M${inset} ${height - len} L${inset} ${height} L${len} ${height}`} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
      <Path d={`M${width - len} ${height} L${width} ${height} L${width} ${height - len}`} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

