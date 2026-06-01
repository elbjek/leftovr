import { View, StyleSheet } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { colors } from "../../theme";

type Props = {
  size?: number;
  variant?: "detailed" | "simple";
};

export function RecipeGlyph({ size = 34, variant = "detailed" }: Props) {
  if (variant === "simple") {
    return (
      <View style={[styles.wrap, { width: size, height: size }]}>
        <View style={[styles.bowl, { width: size * 0.82, height: size * 0.41, borderRadius: size * 0.41 }]} />
        <View style={[styles.dot, { top: size * 0.29, left: size * 0.26, width: size * 0.09, height: size * 0.09, borderRadius: size * 0.045 }]} />
        <View style={[styles.dot, { top: size * 0.26, right: size * 0.24, width: size * 0.09, height: size * 0.09, borderRadius: size * 0.045 }]} />
      </View>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Ellipse cx={24} cy={32} rx={18} ry={4} stroke={colors.primary} strokeOpacity={0.3} strokeWidth={1.5} />
      <Ellipse cx={24} cy={28} rx={16} ry={8} stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M12 28 Q16 22 24 22 Q32 22 36 28" stroke={colors.primary} strokeWidth={1.5} />
      <Circle cx={20} cy={26} r={1.5} fill={colors.primary} />
      <Circle cx={28} cy={25} r={1.5} fill={colors.primary} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  bowl: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderTopWidth: 0,
  },
  dot: {
    position: "absolute",
    backgroundColor: colors.primary,
  },
});
