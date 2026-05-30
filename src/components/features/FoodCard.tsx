import React from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { CategoryTone, categoryColors, colors, radii, spacing, Urgency, urgencyColors } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";

type Props = {
  name: string;
  category?: CategoryTone | string;
  meta: string;
  urgency?: Urgency;
  size?: "small" | "large";
  addedBy?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function FoodCard({
  name,
  category = "other",
  meta,
  urgency = "safe",
  size = "small",
  addedBy,
  onPress,
  style,
}: Props) {
  const isLarge = size === "large";
  const tone = categoryColors[(category as CategoryTone)] ?? categoryColors.other;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isLarge && styles.largeCard,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.image, isLarge && styles.largeImage, { backgroundColor: tone.background }]}>
        <FoodGlyph name={name} color={tone.mark} size={isLarge ? 46 : 36} />
        <View style={[styles.dot, { backgroundColor: urgencyColors[urgency] }]} />
      </View>
      <View style={styles.copy}>
        <Text variant="label" numberOfLines={2} style={isLarge && styles.largeTitle}>
          {name}
        </Text>
        <Text variant="micro" muted style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        {addedBy ? (
          <Text variant="micro" muted style={styles.meta} numberOfLines={1}>
            {addedBy}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 118,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm + 2,
    gap: spacing.sm,
  },
  largeCard: {
    width: 168,
    padding: spacing.md,
    gap: spacing.md,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  image: {
    aspectRatio: 1,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  largeImage: {
    height: 130,
    aspectRatio: undefined,
    borderRadius: radii.md,
  },
  dot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  copy: {
    paddingHorizontal: spacing.xxs,
    paddingBottom: spacing.xxs,
  },
  largeTitle: {
    fontSize: 14,
  },
  meta: {
    marginTop: 2,
    textTransform: "none",
    letterSpacing: 0,
  },
});

