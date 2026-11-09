import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Tappable, Text } from "../primitives";

type Props = {
  name: string;
  /** The letter in the avatar: the user's first name, else the household's. */
  initial: string;
  label: string;
  onPress: () => void;
};

// The household switcher at the top right of the tab screens.
export function HouseholdPill({ name, initial, label, onPress }: Props) {
  return (
    <Tappable label={label} onPress={onPress} style={styles.pill}>
      <View style={styles.avatar}>
        <Text variant="small" color={colors.primary} weight="bold">
          {initial.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text variant="small" numberOfLines={1} weight="bold" style={styles.name}>
        {name}
      </Text>
      <Svg width={14} height={14} viewBox="0 0 24 24" accessible={false}>
        <Path d="M6 9l6 6 6-6" fill="none" stroke={colors.text} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
    paddingLeft: spacing.xxs,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  name: {
    flexShrink: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
});
