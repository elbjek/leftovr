import { StyleSheet, View } from "react-native";

import { foodIconKey } from "@/lib/foodIcons";
import { FoodGlyph } from "../illustrations";
import { RecipeGlyph } from "./RecipeGlyph";

// Icon sizes (pt) and lifts by how many are shown: the middle ones larger, so
// a recipe's ingredients sit together like a small still life.
const LAYOUTS: Record<number, { size: number; lift: number }[]> = {
  1: [{ size: 88, lift: 0 }],
  2: [{ size: 72, lift: 4 }, { size: 72, lift: -4 }],
  3: [{ size: 60, lift: 6 }, { size: 78, lift: -4 }, { size: 60, lift: 6 }],
  4: [{ size: 52, lift: 6 }, { size: 68, lift: -4 }, { size: 68, lift: 2 }, { size: 52, lift: -2 }],
};

/** A recipe's first few ingredients as food icons (one per distinct icon),
 *  or the recipe glyph when none of them has one. */
export function IngredientIcons({ names }: { names: string[] }) {
  const ids: string[] = [];
  for (const name of names) {
    const id = foodIconKey(name);
    if (id && !id.startsWith("category_") && !ids.includes(id)) ids.push(id);
    if (ids.length === 4) break;
  }
  if (ids.length === 0) return <RecipeGlyph size={48} />;

  return (
    <View style={styles.row}>
      {ids.map((id, index) => {
        const { size, lift } = LAYOUTS[ids.length][index];
        return (
          <View key={id} style={{ transform: [{ translateY: lift }] }}>
            {/* FoodGlyph draws icons at 1.2x its size. */}
            <FoodGlyph name={id} size={size / 1.2} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
});
