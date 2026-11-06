import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, spacing } from "../../theme";
import { Tappable } from "./Tappable";
import { Text } from "./Text";

type Props = {
  title: string;
  subtitle?: string;
  /** A GlyphTile, a date block, an icon. */
  leading?: React.ReactNode;
  /** A StatusPill, a value, a switch. */
  trailing?: React.ReactNode;
  /** Defaults to true when the row is pressable. */
  chevron?: boolean;
  onPress?: () => void;
  /** Spoken name. Defaults to the title and subtitle read together. */
  label?: string;
  /** Destructive rows: the label goes red. */
  danger?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Leading glyph, title over subtitle, trailing status, chevron.
 *
 * The app writes this anatomy out by hand in FoodListCard, settings,
 * SavedRecipeRow, ReceiptConfirmList, InsightsSections and the fridge
 * sheets, with two different minimum heights and three chevrons drawn as
 * inline SVG.
 *
 * Destructive rows use redInk, not red: red on a light surface measures
 * 2.9:1, which fails the 4.5:1 bar for body text.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  chevron,
  onPress,
  label,
  danger = false,
  disabled = false,
  style,
}: Props) {
  const showChevron = chevron ?? Boolean(onPress);

  const body = (
    <View style={[styles.row, style]}>
      {leading}
      <View style={styles.copy}>
        <Text variant="label" numberOfLines={1} color={danger ? colors.redInk : undefined}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" muted numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <Chevron /> : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Tappable
      label={label ?? [title, subtitle].filter(Boolean).join(". ")}
      onPress={onPress}
      disabled={disabled}
      hitSlop={0}
    >
      {body}
    </Tappable>
  );
}

function Chevron() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path
        d="M5 3L9 7L5 11"
        stroke={colors.muted2}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
