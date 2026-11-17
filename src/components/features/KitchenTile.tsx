import { StyleSheet } from "react-native";

import { InventoryCategory, toUiCategory } from "@/services";
import { CategoryTone, categoryColors, colors, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Tappable, Text } from "../primitives";

type Props = {
  category: InventoryCategory;
  label: string;
  /** "8 items · 2 soon". */
  detail: string;
  /** Omitted in the feature tour, where the tile is only a picture. */
  onPress?: () => void;
};

/** A category in the Kitchen's "Your kitchen" grid, four across (also the tour's Kitchen slide). */
export function KitchenTile({ category, label, detail, onPress }: Props) {
  const tone = categoryColors[toUiCategory(category) as CategoryTone] ?? categoryColors.other;
  return (
    <Tappable label={`${label}, ${detail}`} onPress={onPress} style={styles.tile}>
      <FoodGlyph name="" category={category} color={tone.mark} size={52} />
      <Text variant="small" numberOfLines={1} weight="bold" center>
        {label}
      </Text>
      <Text variant="micro" muted numberOfLines={1} center>
        {detail}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  tile: {
    // Four per row: a quarter of the row minus the gaps.
    width: "23.4%",
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxs,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
});
