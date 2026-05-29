import React from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../../theme";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  label: string;
  transparent?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  children,
  onPress,
  label,
  transparent = false,
  size = 38,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: transparent ? "transparent" : colors.paper,
          borderWidth: transparent ? 0 : 1,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.hairline,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
