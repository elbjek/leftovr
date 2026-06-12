# AI Recipe Generation — Design

Date: 2026-06-12
Status: Approved (approach A)

## Goal

Replace the mock-only recipe generation with real Anthropic-backed generation via the
`generate-recipes` Supabase Edge Function, per BUILD_PLAN backlog item "Real Anthropic
recipe generation via Supabase Edge Functions". The curated mock matcher stays as a
silent fallback so Generate never breaks.

## Decisions

- **Model:** `claude-haiku-4-5` (cheap, fast, sufficient for structured recipe cards).
- **Key handling:** `ANTHROPIC_API_KEY` lives only in edge function env
  (local: `supabase/functions/.env`, hosted: `supabase secrets set`). Never in the app bundle.
- **Failure mode:** any error (missing key, network, rate limit, bad response) →
  client falls back to the existing mock matcher, `source: "mock"`.
- **Structured outputs:** `output_config.format` with a JSON schema guarantees parseable
  recipe cards — no parsing heuristics.

## Architecture

```
useRecipes.generateSession
  └─ recipeGenerationService.generateRecipeMatches
       ├─ supabase.functions.invoke("generate-recipes")   ← AI path
       │    └─ Edge Function → Anthropic messages.create (Haiku, JSON schema)
       │         └─ guardrails: drop cards violating avoidances / empty ingredients
       └─ on any error → matchRecipes(RECIPE_LIBRARY)      ← mock fallback (unchanged)
```

## Components

### Edge function `supabase/functions/generate-recipes/index.ts`

- Keeps existing `buildPrompt` / `formatInventory`.
- Calls Anthropic via `npm:@anthropic-ai/sdk`, model `claude-haiku-4-5`,
  `max_tokens: 8000`, `output_config: { format: { type: "json_schema", schema } }`.
- Schema: `{ recipes: AiRecipeCard[] }` where a card has title, description,
  timeMinutes, complexity (simple|medium|involved), servings, mealType, category,
  tags, avoidanceTags, ingredients (name, amount, required, countable), steps.
- Server guardrails: drop cards whose `avoidanceTags` intersect requested avoidances,
  or with empty ingredients/steps.
- Returns `{ source: "ai", recipes }`; non-200 JSON error body on failure.

### Client `src/services/recipeGenerationService.ts`

- AI cards are converted to the existing `MockRecipe` shape and scored with the
  existing `matchRecipes` logic (gains `matchedItems`, `coverage`, urgency sorting
  for free). `matchRecipes` gets an optional `library` parameter (defaults to
  `RECIPE_LIBRARY`) — only signature change.
- AI matches filtered to `matchCount >= 1` (spec: every generated recipe must use
  at least one fridge item). Fridge linkage (`usedInventoryItemIds`) is computed
  client-side via the existing canonical-name matching, not trusted from the model.
- `RecipeGenerationResult.source` becomes `"ai" | "mock"`.
- `useRecipes` unchanged — same `RecipeMatch` shape flows into session auto-save.

## Testing

- Vitest: AI-card → `RecipeMatch` mapping (filters non-fridge recipes, preserves fields);
  existing mock-path tests keep passing (no supabase config in test env → mock path).
- Manual: `supabase functions serve` with key → AI recipes in app; remove key → mock fallback.

## Out of scope

Weekly session limits, avoidance settings UI, recipe storage/favorites — untouched.
Receipt normalization AI (separate backlog item).
