import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
        <Text variant="h3">{title}</Text>
        <Text variant="small" muted style={styles.meta}>
          {timeLabel}
          {metaSeparator}
          {complexityLabel}
        </Text>
        <Text variant="small" color={colors.primary} style={styles.uses} numberOfLines={1}>
          {usesLabel} {usedItems.slice(0, 3).join(", ")}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  art: {
    height: 128,
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
    padding: spacing.lg,
  },
  meta: {
    marginTop: spacing.xs,
  },
  uses: {
    marginTop: spacing.sm,
    fontWeight: "600",
  },
});
