import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows } from "../../theme";
import { Tappable } from "./Tappable";

type Props = {
  onPress: () => void;
  /** Placement and, for the hook tour's footer, size. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's one back control: a white round button lifted off the cream page,
 * with an ink chevron. The same white card reads over a recipe's cover photo,
 * so there is no separate light variant.
 */
export function BackButton({ onPress, style }: Props) {
  const { t } = useTranslation();
  return (
    <Tappable label={t("common.back")} onPress={onPress} hitSlop={10} style={[styles.button, style]}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M15 5l-7 7 7 7" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
});
