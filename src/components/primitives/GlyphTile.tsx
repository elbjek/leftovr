import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { categoryColors, CategoryTone, radii } from "../../theme";
import { FoodGlyph } from "../illustrations";

type Size = "sm" | "md" | "lg";

type Props = {
  /** A food name, or an icon id ("category_meat"). */
  name?: string | null;
  /** Tints the tile and picks the fallback glyph. */
  category?: string | null;
  size?: Size;
  /** Circular instead of the rounded square. */
  round?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<Size, { box: number; glyph: number; radius: number }> = {
  sm: { box: 40, glyph: 22, radius: radii.sm },
  md: { box: 44, glyph: 26, radius: radii.md },
  lg: { box: 64, glyph: 36, radius: radii.xl },
};

/**
 * A food icon in its category-tinted tile.
 *
 * The app repeats `categoryColors[x as CategoryTone] ?? categoryColors.other`
 * in six places with four different box sizes. Two of those six forget to
 * normalise the category first, so an underscored category ("dairy_eggs")
 * silently falls through to the grey "other" tint. The normalisation lives
 * here now, so it cannot be forgotten.
 */
export function GlyphTile({ name, category, size = "md", round = false, style }: Props) {
  const tone = toneFor(category);
  const { box, glyph, radius } = SIZES[size];

  return (
    <View
      style={[
        styles.tile,
        { width: box, height: box, borderRadius: round ? box / 2 : radius, backgroundColor: tone.background },
        style,
      ]}
    >
      <FoodGlyph name={name ?? ""} category={category} color={tone.mark} size={glyph} />
    </View>
  );
}

/** Category tints are keyed with hyphens; the data layer uses underscores. */
export function toneFor(category?: string | null) {
  const key = (category ?? "other").replace("_", "-") as CategoryTone;
  return categoryColors[key] ?? categoryColors.other;
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
  },
});
