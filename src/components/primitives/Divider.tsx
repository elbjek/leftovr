import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../../theme";

type Props = {
  /**
   * Pull the rule in from the leading edge so it starts under the text
   * rather than under the row's glyph. 56 clears a md GlyphTile plus its gap.
   */
  inset?: boolean | number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The one horizontal rule.
 *
 * Twelve row separators across the app, split between colors.hairline and
 * colors.cardLine and between a flat 1 and StyleSheet.hairlineWidth — four
 * combinations for one line. This is hairlineWidth on hairline.
 *
 * With borders coming off cards, this is how a list says "new item" and a
 * group says "new group". Prefer space first; reach for a rule only when
 * space alone stops reading as a boundary.
 */
export function Divider({ inset = false, style }: Props) {
  const left = inset === true ? 56 : inset === false ? 0 : inset;
  return <View style={[styles.rule, left ? { marginLeft: left } : null, style]} />;
}

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
});
