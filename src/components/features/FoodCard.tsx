import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { CategoryTone, colors, radii, spacing, Urgency, urgencyColors } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Card, Tappable, Text, toneFor } from "../primitives";

type Props = {
  name: string;
  category?: CategoryTone | string;
  meta: string;
  metaLines?: string[];
  bestBy?: string;
  urgency?: Urgency;
  size?: "small" | "large";
  addedBy?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** One food as a tile, for the horizontal shelves. */
export function FoodCard({
  name,
  category = "other",
  meta,
  metaLines,
  bestBy,
  urgency = "safe",
  size = "small",
  addedBy,
  onPress,
  style,
}: Props) {
  const isLarge = size === "large";
  const tone = toneFor(category);
  const displayMeta = (metaLines?.length ? metaLines : [meta]).join(" · ");

  return (
    <Tappable
      feedback="scale"
      onPress={onPress}
      label={[name, displayMeta, bestBy, addedBy].filter(Boolean).join(". ")}
      hitSlop={0}
      style={style}
    >
      <Card padded={false} style={[styles.card, isLarge && styles.largeCard]}>
        <View style={[styles.image, isLarge && styles.largeImage]}>
          <FoodGlyph name={name} category={category} color={tone.mark} size={isLarge ? 46 : 36} />
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.dot, { backgroundColor: urgencyColors[urgency] }]}
          />
        </View>
        <View style={styles.copy}>
          <Text variant="label" numberOfLines={2}>
            {name}
          </Text>
          {bestBy ? null : (
            <Text variant="small" muted numberOfLines={1}>
              {displayMeta}
            </Text>
          )}
          {bestBy ? (
            <Text variant="small" color={colors.muted} numberOfLines={1}>
              {bestBy}
            </Text>
          ) : null}
          {addedBy ? (
            <Text variant="small" muted numberOfLines={1}>
              {addedBy}
            </Text>
          ) : null}
        </View>
      </Card>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 118,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  largeCard: {
    width: 168,
    padding: spacing.md,
    gap: spacing.md,
  },
  image: {
    aspectRatio: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.sageTint,
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
    gap: 2,
  },
});
