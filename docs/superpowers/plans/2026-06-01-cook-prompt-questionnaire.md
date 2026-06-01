# Cook Prompt Questionnaire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping "What should I cook?" opens an optional sheet to filter generation by ingredients-to-use, meal type, time, and vibe — with a "Surprise me" instant path that preserves today's behavior.

**Architecture:** Add `mealType` to library recipes. Extend the pure `matchRecipes` with optional `filters`. `generateSession` forwards filters. A new `CookPromptSheet` (single BottomSheet) collects choices; the recipes-screen CTA opens it instead of generating directly.

**Tech Stack:** React Native (Expo), TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-cook-prompt-questionnaire-design.md`

---

## File Structure

- Modify `src/mocks/recipeLibrary.ts` — add `mealType` to type + 12 recipes.
- Modify `src/services/recipeService.ts` — `filters` on `RecipeMatcherInput`, apply in `matchRecipes`.
- Create `src/services/recipeService.test.ts` — vitest for the filters.
- Modify `src/hooks/useRecipes.ts` — `generateSession(cookingMode, filters?)`.
- Create `src/components/features/CookPromptSheet.tsx` — the prompt sheet.
- Modify `src/components/features/index.ts` — export it.
- Modify `src/app/(tabs)/recipes.tsx` — open sheet from CTA; thread filters into generate.
- Modify `src/i18n/locales/en.ts`, `src/i18n/locales/sr.ts` — sheet strings.
- Modify `docs/PRODUCT_SPEC.md` — document optional prompt.

---

## Task 1: Recipe `mealType` data

**Files:**
- Modify: `src/mocks/recipeLibrary.ts`

- [ ] **Step 1: Add `mealType` to the `MockRecipe` type**

In the `MockRecipe` type, after `category: string;` add:
```ts
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
```

- [ ] **Step 2: Add `mealType` to each of the 12 recipes**

Add a `mealType` field to every recipe object (place it next to `category`). Use these assignments by `key`:
```
spinach-feta-pasta        -> "dinner"
mediterranean-chicken-bowl -> "lunch"
cheesy-egg-toast          -> "breakfast"
tomato-basil-galette      -> "dinner"
green-shakshuka           -> "breakfast"
salmon-rice-bowl          -> "dinner"
banana-oat-pancakes       -> "breakfast"
one-pan-butter-dal        -> "dinner"
chicken-stir-fry          -> "dinner"
yogurt-fruit-bowl         -> "snack"
egg-fried-rice            -> "lunch"
hummus-veggie-wrap        -> "lunch"
```
Example for the first recipe (add the one line):
```ts
    category: "pasta",
    mealType: "dinner",
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors (every recipe now has `mealType`; if any is missing, TS reports the object literal missing the property — fix it).

- [ ] **Step 4: Commit**

```bash
git add src/mocks/recipeLibrary.ts
git commit -m "feat: add mealType to library recipes"
```

---

## Task 2: Matcher filters

**Files:**
- Modify: `src/services/recipeService.ts`
- Test: `src/services/recipeService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/recipeService.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { matchRecipes } from "./recipeService";

const base = { inventory: [], avoidances: [], isPremium: false };

describe("matchRecipes filters", () => {
  it("returns all (avoidance-filtered) recipes when no filters given", () => {
    const all = matchRecipes(base);
    expect(all.length).toBeGreaterThan(0);
  });

  it("filters by mealType", () => {
    const res = matchRecipes({ ...base, filters: { mealType: "breakfast" } });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.mealType === "breakfast")).toBe(true);
  });

  it("filters by maxMinutes", () => {
    const res = matchRecipes({ ...base, filters: { maxMinutes: 15 } });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.timeMinutes <= 15)).toBe(true);
  });

  it("filters by vibe tag", () => {
    const res = matchRecipes({ ...base, filters: { vibe: "comfort" } });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.tags.includes("comfort"))).toBe(true);
  });

  it("filters by useIngredients with AND semantics", () => {
    const res = matchRecipes({ ...base, filters: { useIngredients: ["pasta"] } });
    expect(res.length).toBeGreaterThan(0);
    expect(
      res.every((r) => r.ingredients.some((i) => i.name.toLowerCase() === "pasta")),
    ).toBe(true);
  });

  it("returns empty when filters match nothing", () => {
    const res = matchRecipes({ ...base, filters: { useIngredients: ["unobtainium"] } });
    expect(res).toEqual([]);
  });

  it("treats empty useIngredients as no constraint", () => {
    const res = matchRecipes({ ...base, filters: { useIngredients: [] } });
    expect(res.length).toBe(matchRecipes(base).length);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/recipeService.test.ts`
Expected: FAIL (filters not yet applied / type error on `filters`).

- [ ] **Step 3: Add `filters` to `RecipeMatcherInput`**

In `src/services/recipeService.ts`, extend the type:
```ts
export type RecipeMatcherInput = {
  inventory: InventoryLot[];
  avoidances: string[];
  isPremium: boolean;
  servings?: number;
  filters?: {
    useIngredients?: string[];
    mealType?: "breakfast" | "lunch" | "dinner" | "snack";
    maxMinutes?: number;
    vibe?: string;
  };
};
```

- [ ] **Step 4: Apply filters in `matchRecipes`**

In `matchRecipes`, replace the existing `const filtered = RECIPE_LIBRARY.filter(...)` block with one that also applies the prompt filters:
```ts
  const filters = input.filters;
  const filtered = RECIPE_LIBRARY.filter((recipe) => {
    if (recipe.avoidanceTags.some((tag) => avoidances.includes(tag))) return false;
    if (filters?.mealType && recipe.mealType !== filters.mealType) return false;
    if (filters?.maxMinutes != null && recipe.timeMinutes > filters.maxMinutes) return false;
    if (filters?.vibe && !recipe.tags.includes(filters.vibe)) return false;
    if (filters?.useIngredients && filters.useIngredients.length > 0) {
      const names = recipe.ingredients.map((i) => normalizeFoodName(i.name));
      const usesAll = filters.useIngredients.every((sel) => names.includes(normalizeFoodName(sel)));
      if (!usesAll) return false;
    }
    return true;
  });
```
(`normalizeFoodName` is already imported in this file.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/services/recipeService.test.ts`
Expected: PASS (all 7).

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: zero errors.
```bash
git add src/services/recipeService.ts src/services/recipeService.test.ts
git commit -m "feat: add prompt filters to recipe matcher"
```

---

## Task 3: Hook forwards filters

**Files:**
- Modify: `src/hooks/useRecipes.ts`

- [ ] **Step 1: Add `filters` param to `generateSession`**

In `src/hooks/useRecipes.ts`, change the `generateSession` signature and the `matchRecipes` call. Replace:
```ts
      generateSession: async (cookingMode: CookingMode) => {
        if (!householdId) return null;

        setState((s) => ({ ...s, generating: true, error: null }));

        try {
          const matches = matchRecipes({ inventory, avoidances, isPremium, servings });
```
with:
```ts
      generateSession: async (
        cookingMode: CookingMode,
        filters?: import("@/services/recipeService").RecipeMatcherInput["filters"],
      ) => {
        if (!householdId) return null;

        setState((s) => ({ ...s, generating: true, error: null }));

        try {
          const matches = matchRecipes({ inventory, avoidances, isPremium, servings, filters });
```
(If `matchRecipes`/`RecipeMatcherInput` are already imported from `@/services/recipeService`, use a direct named import `RecipeMatcherInput` instead of the inline `import(...)` type — check the existing import block and prefer the named import.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors. (Callers passing no filters still typecheck — param is optional.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRecipes.ts
git commit -m "feat: generateSession accepts prompt filters"
```

---

## Task 4: CookPromptSheet component

**Files:**
- Create: `src/components/features/CookPromptSheet.tsx`
- Modify: `src/components/features/index.ts`

- [ ] **Step 1: Create the component**

Create `src/components/features/CookPromptSheet.tsx`:
```tsx
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BottomSheet, Button, FilterChip, SegmentedControl, Text } from "../primitives";
import { colors, spacing } from "../../theme";

export type CookFilters = {
  useIngredients?: string[];
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  maxMinutes?: number;
  vibe?: string;
};

type MealOption = "any" | "breakfast" | "lunch" | "dinner" | "snack";
type TimeOption = "any" | "20" | "45";

type IngredientChoice = { normalizedName: string; label: string };

type Props = {
  visible: boolean;
  ingredients: IngredientChoice[];
  vibes: string[];
  labels: {
    title: string;
    useWhat: string;
    meal: string;
    mealOptions: Record<MealOption, string>;
    time: string;
    timeOptions: Record<TimeOption, string>;
    vibe: string;
    formatVibe: (tag: string) => string;
    surprise: string;
    generate: string;
  };
  onDismiss: () => void;
  onGenerate: (filters?: CookFilters) => void;
};

export function CookPromptSheet({ visible, ingredients, vibes, labels, onDismiss, onGenerate }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [meal, setMeal] = useState<MealOption>("any");
  const [time, setTime] = useState<TimeOption>("any");
  const [vibe, setVibe] = useState<string | null>(null);

  // Reset choices each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      setMeal("any");
      setTime("any");
      setVibe(null);
    }
  }, [visible]);

  function toggleIngredient(norm: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) next.delete(norm);
      else next.add(norm);
      return next;
    });
  }

  function buildFilters(): CookFilters {
    return {
      useIngredients: selected.size > 0 ? [...selected] : undefined,
      mealType: meal === "any" ? undefined : meal,
      maxMinutes: time === "any" ? undefined : Number(time),
      vibe: vibe ?? undefined,
    };
  }

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="h2">{labels.title}</Text>

        {ingredients.length > 0 ? (
          <View style={styles.block}>
            <Text variant="small" muted>{labels.useWhat}</Text>
            <View style={styles.chipWrap}>
              {ingredients.map((ing) => (
                <FilterChip
                  key={ing.normalizedName}
                  label={ing.label}
                  active={selected.has(ing.normalizedName)}
                  onPress={() => toggleIngredient(ing.normalizedName)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text variant="small" muted>{labels.meal}</Text>
          <SegmentedControl
            options={(["any", "breakfast", "lunch", "dinner", "snack"] as MealOption[]).map((v) => ({
              label: labels.mealOptions[v],
              value: v,
            }))}
            value={meal}
            onChange={setMeal}
          />
        </View>

        <View style={styles.block}>
          <Text variant="small" muted>{labels.time}</Text>
          <SegmentedControl
            options={(["any", "20", "45"] as TimeOption[]).map((v) => ({
              label: labels.timeOptions[v],
              value: v,
            }))}
            value={time}
            onChange={setTime}
          />
        </View>

        {vibes.length > 0 ? (
          <View style={styles.block}>
            <Text variant="small" muted>{labels.vibe}</Text>
            <View style={styles.chipWrap}>
              {vibes.map((tag) => (
                <FilterChip
                  key={tag}
                  label={labels.formatVibe(tag)}
                  active={vibe === tag}
                  onPress={() => setVibe((v) => (v === tag ? null : tag))}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.buttons}>
          <Button title={labels.generate} onPress={() => onGenerate(buildFilters())} />
          <Button title={labels.surprise} variant="text" onPress={() => onGenerate(undefined)} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  block: {
    gap: spacing.sm,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  buttons: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
```
Note: verify `BottomSheet`, `Button`, `FilterChip`, `SegmentedControl`, `Text` are all exported from `../primitives`. If `FilterChip` lives elsewhere in the barrel, import it from the correct path (check `src/components/index.ts`). `colors` import may be unused — remove it if so to keep lint clean.

- [ ] **Step 2: Export from features barrel**

In `src/components/features/index.ts` add:
```ts
export * from "./CookPromptSheet";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/CookPromptSheet.tsx src/components/features/index.ts
git commit -m "feat: add CookPromptSheet component"
```

---

## Task 5: Wire the sheet into the recipes screen

**Files:**
- Modify: `src/app/(tabs)/recipes.tsx`

- [ ] **Step 1: Import the sheet + add state**

Add `CookPromptSheet` and its `CookFilters` type to the `@/components` import. Add state near the other `useState` hooks:
```ts
  const [showCookPrompt, setShowCookPrompt] = useState(false);
```

- [ ] **Step 2: Make the CTA open the sheet**

The `BottomDock` button currently calls `handleGenerate`. Change its `onPress` to gate then open:
```tsx
        <Button
          title={t("recipes.generateCta")}
          onPress={() => {
            if (!canGenerate) {
              setShowPremium(true);
              return;
            }
            setShowCookPrompt(true);
          }}
          loading={generating}
        />
```

- [ ] **Step 3: Update `handleGenerate` to accept filters**

Replace the existing `handleGenerate`:
```ts
  const handleGenerate = useCallback(async (filters?: CookFilters) => {
    if (!canGenerate) {
      setShowPremium(true);
      return;
    }
    setShowCookPrompt(false);
    await generateSession(cookingMode, filters);
  }, [canGenerate, cookingMode, generateSession]);
```

- [ ] **Step 4: Render the sheet**

Just before the closing of the screen (next to `<PremiumSheet ... />`), add:
```tsx
      <CookPromptSheet
        visible={showCookPrompt}
        ingredients={[...new Map(inventory.map((lot) => [lot.normalized_name, lot.name])).entries()].map(
          ([normalizedName, label]) => ({ normalizedName, label }),
        )}
        vibes={categories}
        labels={{
          title: t("recipes.cookPrompt.title"),
          useWhat: t("recipes.cookPrompt.useWhat"),
          meal: t("recipes.cookPrompt.meal"),
          mealOptions: {
            any: t("recipes.cookPrompt.mealOptions.any"),
            breakfast: t("recipes.cookPrompt.mealOptions.breakfast"),
            lunch: t("recipes.cookPrompt.mealOptions.lunch"),
            dinner: t("recipes.cookPrompt.mealOptions.dinner"),
            snack: t("recipes.cookPrompt.mealOptions.snack"),
          },
          time: t("recipes.cookPrompt.time"),
          timeOptions: {
            any: t("recipes.cookPrompt.timeOptions.any"),
            "20": t("recipes.cookPrompt.timeOptions.20"),
            "45": t("recipes.cookPrompt.timeOptions.45"),
          },
          vibe: t("recipes.cookPrompt.vibe"),
          formatVibe: formatCategory,
          surprise: t("recipes.cookPrompt.surprise"),
          generate: t("recipes.cookPrompt.generate"),
        }}
        onDismiss={() => setShowCookPrompt(false)}
        onGenerate={handleGenerate}
      />
```
(`inventory`, `categories`, and `formatCategory` already exist in this file. `categories` is the union of suggestion + saved-recipe tags, which suits the vibe chips.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/(tabs)/recipes.tsx
git commit -m "feat: open cook prompt sheet from recipes CTA"
```

---

## Task 6: i18n strings

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/sr.ts`

- [ ] **Step 1: Add English keys**

In `src/i18n/locales/en.ts`, inside the `recipes` object, add:
```ts
    cookPrompt: {
      title: "What should I cook?",
      useWhat: "Use what? (tap to pick)",
      meal: "Meal",
      mealOptions: { any: "Any", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" },
      time: "Time",
      timeOptions: { any: "Any", "20": "≤ 20 min", "45": "≤ 45 min" },
      vibe: "Vibe",
      surprise: "Surprise me",
      generate: "Generate",
    },
```

- [ ] **Step 2: Add Serbian keys**

In `src/i18n/locales/sr.ts`, inside the `recipes` object, add:
```ts
    cookPrompt: {
      title: "Sta da kuvam?",
      useWhat: "Sta da iskoristim? (dodirni za izbor)",
      meal: "Obrok",
      mealOptions: { any: "Bilo sta", breakfast: "Dorucak", lunch: "Rucak", dinner: "Vecera", snack: "Uzina" },
      time: "Vreme",
      timeOptions: { any: "Bilo koje", "20": "≤ 20 min", "45": "≤ 45 min" },
      vibe: "Stil",
      surprise: "Iznenadi me",
      generate: "Generisi",
    },
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck`
Expected: zero errors.
```bash
git add src/i18n/locales/en.ts src/i18n/locales/sr.ts
git commit -m "feat: add cook prompt i18n strings"
```

---

## Task 7: PRODUCT_SPEC update

**Files:**
- Modify: `docs/PRODUCT_SPEC.md`

- [ ] **Step 1: Document the optional prompt**

In the `## Recipes` section (after the "Premium rule" block, before `### Avoidances`), add:
```markdown
### Cook Prompt (optional)

Tapping "What should I cook?" opens an optional prompt sheet before generating:

- which fridge ingredients to use (must use all selected)
- meal type: breakfast / lunch / dinner / snack
- time available
- vibe / category (a recipe tag)

A "Surprise me" action skips the prompt and generates instantly (the original
one-tap behaviour). The prompt is available to all users; the weekly session
limit remains the free/premium gate.
```

- [ ] **Step 2: Commit**

```bash
git add docs/PRODUCT_SPEC.md
git commit -m "docs: document optional cook prompt"
```

---

## Task 8: Full verification

- [ ] **Step 1: Static checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck clean; lint no new errors (pre-existing warnings in `HouseholdSection.tsx`/`recipeService.ts` are acceptable); all tests pass (units + new matcher tests).

- [ ] **Step 2: Manual / Playwright walk (web)**

Run `npm run web` (Supabase running), then via Playwright (log in first):
1. Tap "What should I cook?" → sheet opens with fridge ingredient chips, meal/time segmented, vibe chips.
2. Select Spinach + Dinner + ≤45 + Comfort → Generate → suggestions reflect filters.
3. Reopen → "Surprise me" → generates without filters (instant path).
4. Pick an impossible combo (ingredient + meal that no recipe has) → generation returns no new cards / empty (no crash).
5. As a free user at the weekly limit → CTA shows Premium sheet, prompt does not open.

- [ ] **Step 3: Final commit (if manual fixups)**

```bash
git add -A
git commit -m "test: verify cook prompt questionnaire end-to-end"
```

---

## Notes / Risks

- `SegmentedControl` is generic over the string value type; `meal`/`time` use string-literal option types — confirm `onChange` infers correctly (it did for the units toggle). If TS complains, cast the value in `onChange` as in `settings.tsx`.
- `categories` in `recipes.tsx` is derived from suggestions + saved recipes; it is reused as the vibe list. If it's empty (no suggestions yet), the vibe block hides — acceptable.
- `BottomSheet` must support tall scrollable content; the sheet uses an inner `ScrollView`. Verify it renders within the sheet's height on small screens.
