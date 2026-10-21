// Identifies a recipe by its ingredient set (sorted, normalized names) so
// near-duplicates that differ only by title — e.g. "cheesy spinach & egg
// sourdough toast" vs "cheesy spinach & egg toast" — collapse to one.
export function ingredientSignature(
  ingredients: { name?: string | null }[] | null | undefined,
): string {
  if (!ingredients) return "";
  return ingredients
    .map((ingredient) => (ingredient.name ?? "").toLowerCase().trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort()
    .join("|");
}

// Identifies a recipe by the fridge lots it uses. Unlike display names this
// doesn't change with language (saved recipes carry localized, expanded names;
// fresh cards carry canonical ones), so cross-session dedupe compares like
// with like (FIXES B14). Falls back to the ingredient-name signature when a
// recipe uses no known lots.
export function recipeSignature(
  usedLotIds: string[] | null | undefined,
  ingredients: { name?: string | null }[] | null | undefined,
): string {
  const ids = (usedLotIds ?? []).filter(Boolean);
  return ids.length > 0 ? `lots:${[...ids].sort().join("|")}` : ingredientSignature(ingredients);
}
