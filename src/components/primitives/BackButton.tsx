import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { colors } from "../../theme";
import { Text } from "./Text";

type Props = {
  onPress?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ onPress, label, style }: Props) {
  const { t } = useTranslation();
  const text = label ?? t("common.back");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <Svg width={16} height={16} viewBox="0 0 14 14">
        <Path
          d="M9 2L3 7L9 12"
          stroke={colors.primary}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text variant="label" color={colors.primary}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.6,
  },
});
