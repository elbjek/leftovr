import { router } from "expo-router";

import type { RecipeRow } from "@/repositories/recipeRepository";

/** Where the recipe screen's back button returns to. */
export type RecipeReturnTo = "recipes" | "all-recipes";

type RecipeDetailInput = {
  title: string;
  description: string;
  timeMinutes: number;
  complexity: string;
  servings: number;
  ingredients: unknown;
  steps: unknown;
  recipeId: string;
  isFavorite: boolean;
  cookedCount: number;
  coverPath?: string | null;
};

// Recipe detail lives inside the tab group, so every path to it passes the full
// recipe as params (the detail screen recomputes fridge matches live).
export function openRecipeDetail(recipe: RecipeDetailInput, returnTo: RecipeReturnTo = "recipes") {
  router.push({
    pathname: "/recipe-detail",
    params: {
      title: recipe.title,
      description: recipe.description,
      timeMinutes: String(recipe.timeMinutes),
      complexity: recipe.complexity,
      servings: String(recipe.servings),
      ingredients: JSON.stringify(recipe.ingredients),
      steps: JSON.stringify(recipe.steps),
      recipeId: recipe.recipeId,
      isFavorite: String(recipe.isFavorite),
      cookedCount: String(recipe.cookedCount),
      coverPath: recipe.coverPath ?? "",
      returnTo,
    },
  });
}

export function openSavedRecipe(recipe: RecipeRow, returnTo: RecipeReturnTo = "recipes") {
  openRecipeDetail(
    {
      title: recipe.title,
      description: recipe.description ?? "",
      timeMinutes: recipe.time_minutes ?? 20,
      complexity: recipe.complexity ?? "simple",
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      recipeId: recipe.id,
      isFavorite: recipe.is_favorite,
      cookedCount: recipe.cooked_count ?? 0,
      coverPath: recipe.cover_path,
    },
    returnTo,
  );
}
