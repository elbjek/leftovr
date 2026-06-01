import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radii, spacing } from "../../theme";
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
  onPress?: () => void;
};

export function RecipeCard({
  title,
  timeLabel,
  complexityLabel,
  usedItems,
  usesLabel,
  metaSeparator = " - ",
  favoriteLabel,
  favorite = false,
  cookedLabel,
  onPress,
}: Props) {
  const leadItem = usedItems[0] ?? title;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.art}>
        <FoodGlyph name={leadItem} size={54} />
        {favorite ? (
          <View style={styles.favorite}>
            <Text variant="micro" color={colors.text}>
              {favoriteLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.copy}>
        <Text variant="h3" numberOfLines={1}>{title}</Text>
        <View style={styles.metaRow}>
          <Text variant="small" muted>
            {timeLabel}
            {metaSeparator}
            {complexityLabel}
          </Text>
          {cookedLabel ? (
            <View style={styles.cookedBadge}>
              <Text variant="micro" color={colors.primary}>{cookedLabel}</Text>
            </View>
          ) : null}
        </View>
        {usedItems.length > 0 ? (
          <Text variant="small" color={colors.primary} style={styles.uses} numberOfLines={1}>
            {usesLabel} {usedItems.slice(0, 3).join(", ")}
          </Text>
        ) : null}
      </View>
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Path d="M5 3L9 7L5 11" stroke={colors.muted2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 82,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  art: {
    width: 60,
    height: 60,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  favorite: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(248,244,238,0.92)",
    borderRadius: radii.pill,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  uses: {
    marginTop: spacing.xs,
    fontWeight: "600",
  },
  cookedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
  },
});
