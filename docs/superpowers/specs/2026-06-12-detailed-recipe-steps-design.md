# Detailed Recipe Steps — Design

**Date:** 2026-06-12
**Status:** Approved scope, pending implementation

## Problem

AI-generated recipes return terse instructions (often ~4 short steps). Users want
directions detailed enough for a beginner to follow, with step count driven by the
recipe itself rather than an implicit cap.

## Decision

Prompt-only change. Steps stay `string[]` end to end — no schema, DB, or UI changes.

Considered and rejected:
- **Structured steps** (`{ text, durationMinutes, tip }`): enables per-step timers but
  touches edge function schema, DB rows, types, and recipe-detail UI. Not needed for
  the stated goal.
- **TheMealDB inspiration injection**: small amateur dataset the model already knows,
  free tier searches one ingredient at a time, production use needs a paid key, and it
  adds latency/failure surface inside the cost-guarded function. Dropped.

## Changes

### 1. Server prompt — `supabase/functions/generate-recipes/index.ts` (`buildPrompt`)

Add instruction lines:

- Write steps for a beginner cook: each step names heat level, pan/pot size where
  relevant, a time estimate, and a visual or sensory doneness cue (e.g. "until
  translucent", "until shimmering").
- Include prep detail inside steps (dice size, drain/pat dry) instead of assuming
  knowledge.
- One action per step. Use as many steps as the recipe needs — do not compress
  multiple actions into one step, and do not pad simple recipes.

### 2. Token headroom — same file

`max_tokens: 8000` → `12000`. Detailed steps roughly double step text across up to
5 recipes. Haiku output tokens are cheap; worst-case cost increase per generation is
on the order of fractions of a cent, within the cost-guard budget.

### 3. Client mirror prompt — `src/services/recipeGenerationService.ts` (`buildRecipeGenerationPrompt`)

Add the same instruction lines. This prompt is debug/logging only (the edge function
builds its own), but the two are kept in sync by convention.

## Gotcha: idempotency cache

Completed generations are cached forever by fridge+filters hash in
`recipe_generation_attempts`. After deploying the new prompt, an unchanged fridge
returns old short-step recipes. Local dev verification requires
`truncate recipe_generation_attempts;` (or changing a filter) to force a fresh
generation.

## Verification

1. Truncate local `recipe_generation_attempts`.
2. Generate recipes in the app; open recipe detail.
3. Confirm steps include heat/timing/doneness cues and step count varies by recipe
   complexity (simple recipes stay short, involved ones grow).
4. Check edge function logs for response length; confirm no truncation against
   `max_tokens`.
5. Existing `recipeGenerationService.test.ts` suite still passes (no contract change).
