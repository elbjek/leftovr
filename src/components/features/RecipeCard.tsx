import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, radii } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";

type Props = {
  title: string;
  timeLabel: string;
  complexityLabel: string;
  usedItems: string[];
  usesLabel: string;
  metaSeparator?: string;
  favoriteLabel?: string;
  favorite?: boolean;
  cookedLabel?: string;
  /** Marks a just-generated recipe with an accent "new" eyebrow. */
  newLabel?: string;
  onPress?: () => void;
};

// White recipe row (TinyMeals list card): food tile, eyebrow, bold name, a
// dotted meta line and what it uses from the kitchen.
export function RecipeCard({
  title,
  timeLabel,
  complexityLabel,
  usedItems,
  usesLabel,
  metaSeparator = " · ",
  favoriteLabel,
  favorite = false,
  cookedLabel,
  newLabel,
  onPress,
}: Props) {
  const leadItem = usedItems[0] ?? title;
  const eyebrow = newLabel ?? cookedLabel;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.art}>
        <FoodGlyph name={leadItem} size={40} />
        {favorite ? (
          <View style={styles.favorite}>
            <Text variant="micro" color={colors.accentInk}>
              {favoriteLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.copy}>
        {eyebrow ? (
          <Text variant="micro" uppercase color={newLabel ? colors.accentInk : colors.muted} style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.dot} />
          <Text variant="small" color={colors.primary} style={styles.meta} numberOfLines={1}>
            {timeLabel}
            {metaSeparator}
            {complexityLabel}
          </Text>
        </View>
        {usedItems.length > 0 ? (
          <Text variant="small" muted numberOfLines={1} style={styles.uses}>
            {usesLabel} {usedItems.slice(0, 3).join(", ")}
          </Text>
        ) : null}
      </View>
      <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
        <Path d="M5 2.5 9.5 7 5 11.5" stroke={colors.muted2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xxl,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  art: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  favorite: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    letterSpacing: 0.77,
    marginBottom: 3,
  },
  title: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  meta: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  uses: {
    marginTop: 2,
  },
});
