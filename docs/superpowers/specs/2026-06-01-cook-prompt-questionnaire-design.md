# Cook Prompt Questionnaire — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)
**Branch:** feat/precise-depletion (or successor)

## Problem

Tapping "What should I cook?" generates recipes instantly from fridge contents
with no input. Users want to steer the result: which ingredients to use up, what
meal, how much time, what vibe.

## Conflict with PRODUCT_SPEC and resolution

`docs/PRODUCT_SPEC.md` (L671–691) specifies an instant matcher: tap → select
from inventory → hard-filter avoidances → return cards; premium adds
time/complexity/serving filters. There is no pre-generation questionnaire, and
"one question per screen, no typing" is reserved for onboarding (L279).

This design **extends** that flow with an **optional** prompt sheet: a one-tap
"Surprise me" path preserves the instant behavior, while "Generate" applies
chosen filters. PRODUCT_SPEC's Recipes section is updated to document it (see §7).

## Decisions captured during brainstorming

1. Override spec: build the prompt flow; update PRODUCT_SPEC.
2. Ask four things: which ingredients to use, meal type, time available, vibe/category.
3. Optional/skippable: a "Surprise me" button generates instantly like today.
4. Add `mealType` to each of the 12 library recipes (sensible assignments).
5. Single bottom-sheet layout (not a multi-step wizard).
6. Ingredient selection uses **AND** semantics (recipe must use all chosen items).
7. Premium: keep the sheet fully usable for everyone; only the existing weekly
   session limit gates free users (intentional loosening of the spec's
   "premium filters").

## Components

### 1. Recipe data — `src/mocks/recipeLibrary.ts`

Add to `MockRecipe`:
```ts
mealType: "breakfast" | "lunch" | "dinner" | "snack";
```
Assign one to each of the 12 recipes (e.g. cheesy egg toast → breakfast,
banana oat pancakes → breakfast, green shakshuka → dinner, tomato & basil
galette → dinner, salmon → dinner, pasta → dinner, no-cook/snack items → snack
or lunch as fitting). `mealType` lives in-code on `MockRecipe`/`RecipeMatch`;
it is NOT added to the `recipes` DB table (filtering happens on the library
pre-generation, so no schema change is required).

### 2. Matcher filters — `src/services/recipeService.ts` (pure)

Extend `RecipeMatcherInput` with an optional `filters`:
```ts
filters?: {
  useIngredients?: string[]; // normalized fridge names
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  maxMinutes?: number;
  vibe?: string;             // a recipe tag
};
```
In `matchRecipes`, after the existing avoidance filter and before ranking, drop
recipes that fail any provided filter:
- `useIngredients` (non-empty): every selected name must appear in the recipe's
  normalized ingredient names (AND).
- `mealType`: `recipe.mealType === filters.mealType`.
- `maxMinutes`: `recipe.timeMinutes <= filters.maxMinutes`.
- `vibe`: `recipe.tags.includes(filters.vibe)`.

Absent/undefined filter fields are ignored. If the result is empty, return an
empty array (UI handles the empty case). The function stays pure and
unit-testable.

### 3. Hook — `src/hooks/useRecipes.ts`

`generateSession(cookingMode, filters?)` forwards `filters` to `matchRecipes`.
The live top-3 fridge preview (the non-generating `matchRecipes` call) stays
unfiltered — the questionnaire only affects an explicit generation. Persisted
recipe rows are unchanged (tags already saved; no `mealType` column).

### 4. UI — `CookPromptSheet` component + recipes screen wiring

New component `src/components/features/CookPromptSheet.tsx` rendered from
`src/app/(tabs)/recipes.tsx`. A `BottomSheet` containing:
- Ingredient chips built from current inventory groups (multi-select; stores a
  Set of normalized names).
- Meal type `SegmentedControl`: `Any / Breakfast / Lunch / Dinner / Snack`.
- Time `SegmentedControl`: `Any / ≤20 / ≤45` (maps to `maxMinutes` 20 / 45 / undefined).
- Vibe chips: `Comfort / Healthy / Veggie / Quick` (single-select; maps to a tag).
- Buttons: **Surprise me** → `handleGenerate()` with no filters; **Generate** →
  `handleGenerate(filters)` with the chosen filters.

Wiring in `recipes.tsx`:
- The `BottomDock` CTA `onPress` opens the sheet (`setShowCookPrompt(true)`)
  instead of generating directly.
- `handleGenerate(filters?)` keeps the existing `canGenerate` check first: if the
  weekly limit is reached, show the Premium sheet and do not open/keep the prompt.
- On Generate/Surprise me: close the sheet, then call `generateSession(cookingMode, filters)`.
- Sheet state resets (cleared selections) each time it opens.

Empty inventory: ingredient section shows nothing selectable; user can still pick
meal/time/vibe or Surprise me.

### 5. Premium gating

The prompt sheet is fully usable for all users. The only gate is the existing
weekly session limit (`canGenerate`) checked before generation, unchanged. No
per-filter locking (intentional loosening of the spec's "premium filters" line;
recorded in §7).

### 6. i18n

Add keys under `recipes` for the sheet: title, the "use what" label, meal-type
options, time options, vibe options, and the two buttons — in both
`src/i18n/locales/en.ts` and `src/i18n/locales/sr.ts`.

### 7. PRODUCT_SPEC.md update

Amend the Recipes section: document the optional pre-generation prompt
(ingredients to use, meal type, time, vibe), the "Surprise me" instant path, and
note that the prompt is available to all users while the weekly session limit
remains the free/premium gate.

## Data flow (Generate: spinach + dinner + ≤45 + comfort)

1. Tap "What should I cook?" → `CookPromptSheet` opens.
2. User selects Spinach, Meal=Dinner, Time=≤45, Vibe=Comfort → Generate.
3. `handleGenerate({ useIngredients:["spinach"], mealType:"dinner", maxMinutes:45, vibe:"comfort" })`.
4. `canGenerate` ok → `generateSession("household", filters)`.
5. `matchRecipes` filters library to recipes that use spinach, are dinner, ≤45 min, tagged comfort, then ranks.
6. Session persists; suggestions update; sheet closes.

## Error handling / edge cases

- No recipes match the filters → empty result; sheet (or section) shows a
  "nothing matches — loosen filters" message; user can adjust or Surprise me.
- Weekly limit reached → Premium sheet, prompt not generated.
- No ingredients selected → `useIngredients` omitted (no ingredient constraint).
- Selected ingredient not used by any recipe → empty result (handled above).

## Testing

- vitest unit tests for `matchRecipes` filters: each filter alone, combined,
  AND semantics for `useIngredients`, empty-result case, and that absent filters
  are no-ops.
- Manual/Playwright: open sheet, Surprise me (instant), Generate with each filter,
  empty-match message, weekly-limit gate.

## Out of scope

- Persisting `mealType` to the `recipes` DB table.
- Per-filter premium locking.
- Multi-step wizard layout.
- Free-text recipe requests / AI generation (V1 uses mock matcher).
