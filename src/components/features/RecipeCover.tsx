import { StyleSheet } from "react-native";
import { Image } from "expo-image";

import { recipeCoverUrl } from "@/services/recipeCoverService";
import { RecipeGlyph } from "./RecipeGlyph";

type Props = {
  /** Path in the recipe-covers bucket; null until the cover exists. */
  path?: string | null;
  /** A bundled photo instead, from require() (the feature tour's demo recipe). */
  source?: number;
  glyphSize?: number;
  glyphVariant?: "detailed" | "simple";
};

/** Inside a recipe tile: the drawn glyph, with the cover photo fading in over
 *  it once it loads. No cover, or one that fails to load, leaves the glyph.
 *  The tile clips it (overflow hidden) to its own radius. */
export function RecipeCover({ path, source, glyphSize = 36, glyphVariant }: Props) {
  const uri = recipeCoverUrl(path);
  const image = source ?? (uri ? { uri } : null);
  return (
    <>
      <RecipeGlyph size={glyphSize} variant={glyphVariant} />
      {image ? <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
    </>
  );
}
