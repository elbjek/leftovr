import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Tappable, Text } from "../primitives";
import { useOpenAddSheet } from "./AddSheet";

type Props = {
  name: string;
  /** The letter in the avatar: the user's first name, else the household's. */
  initial: string;
  label: string;
  onPress: () => void;
  /** The Add screen hides its own way in. */
  hideAdd?: boolean;
};

// The household switcher at the top right of the tab screens, with the round
// tomato scan button (a viewfinder) that opens Add's choices as a sheet (2026-11-12: Add left the
// dock for Settings).
export function HouseholdPill({ name, initial, label, onPress, hideAdd }: Props) {
  const { t } = useTranslation();
  const openAdd = useOpenAddSheet();
  return (
    <View style={styles.row}>
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
      {hideAdd ? null : (
        <Tappable label={t("fridge.addItem")} onPress={openAdd} style={styles.add}>
          <ScanFrameIcon />
        </Tappable>
      )}
    </View>
  );
}

// A viewfinder (four corners, one scan line): reads as "scan food in",
// unlike a "+" or the receipt, which is only one of Add's ways in.
function ScanFrameIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="M3.5 8V5.5a2 2 0 012-2H8M16 3.5h2.5a2 2 0 012 2V8M20.5 16v2.5a2 2 0 01-2 2H16M8 20.5H5.5a2 2 0 01-2-2V16M7 12h10"
        stroke={colors.onPrimary}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
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
  // Same height as the pill (28pt avatar + 4pt padding top and bottom).
  add: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
