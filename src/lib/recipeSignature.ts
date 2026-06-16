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
