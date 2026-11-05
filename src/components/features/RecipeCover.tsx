import { StyleSheet } from "react-native";
import { Image } from "expo-image";

import { recipeCoverUrl } from "@/services/recipeCoverService";
import { RecipeGlyph } from "./RecipeGlyph";

type Props = {
  /** Path in the recipe-covers bucket; null until the cover exists. */
  path?: string | null;
  glyphSize?: number;
  glyphVariant?: "detailed" | "simple";
};

/** Inside a recipe tile: the drawn glyph, with the cover photo fading in over
 *  it once it loads. No cover, or one that fails to load, leaves the glyph.
 *  The tile clips it (overflow hidden) to its own radius. */
export function RecipeCover({ path, glyphSize = 36, glyphVariant }: Props) {
  const uri = recipeCoverUrl(path);
  return (
    <>
      <RecipeGlyph size={glyphSize} variant={glyphVariant} />
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
    </>
  );
}
