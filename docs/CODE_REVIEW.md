# Chomp — Hardcore App & Code Review

> Full-codebase review: services, repositories, hooks, all tab screens, theme, auth, i18n.
> Snapshot: branch `feat/add-items`, 2026-06-11. Tests: 53/53 pass. Lint: 2 errors, 1 warning.
> Ordered by severity; each finding has a fix.

---

## 🔴 Critical — logic bugs

### 1. Urgency frozen at insert time — aging never makes items urgent
`addInventoryItem` computes urgency at insert (`src/repositories/inventoryRepository.ts:88`) — always `"safe"` since age = 0. Nothing ever updates the `urgency` column. On read, `groupInventoryLots` prefers the stored value: `lot.urgency ?? computeUrgency(...)` (`src/services/inventoryRules.ts:196`) — stored is never null, so the recompute fallback is dead code. Result: items without an expiry date **stay "safe" forever**. Eat First shelf, urgent shelf, sorting — all silently broken for non-expiry items. This is the app's core promise.

**Fix:** always compute urgency on read from `added_at` / `expires_at`; stop trusting the stored column (treat it as cache only, or drop it). One-line change at `inventoryRules.ts:194-196`: compute, ignore `lot.urgency`.

### 2. Recipe matching uses the same stale urgency — and ignores expiry entirely
`matchRecipes` reads `lot.urgency` raw (`src/services/recipeService.ts:54`). Even items with expiry dates (which the fridge shows as urgent via `urgencyFromExpiry`) count as safe here. Premium "urgency-optimized" sorting and `urgentItemCount` are no-ops — direct conflict with the fridge display and with the product's "save food first" idea.

**Fix:** same as #1 — one shared `resolveUrgency(lot)` helper used by both grouping and matching.

### 3. "Best by" label ignores user-set expiry date
`computeBestByLabel` (`src/app/(tabs)/fridge.tsx:693`) derives days from `added_at` + catalog shelf life. If the user explicitly set expiry tomorrow, the badge can say "in 5 days" while the card shows urgent. Two sources of truth on one card.

**Fix:** if `expires_at` is set, compute remaining days from it; fall back to shelf life otherwise.

### 4. Net amount doesn't scale with quantity in manual add
The manual sheet passes OFF's per-package `netAmount` as-is (`src/app/(tabs)/scan.tsx:797`), while the repo's catalog path multiplies by quantity (`src/repositories/inventoryRepository.ts:95`). Add 2 × 250 g chocolate → stored as quantity 2, net 250 g total. Meta line and depletion math wrong by 2×.

**Fix:** in `addManualItem`, send `netAmount * quantity` (or normalize the semantics in the repo — pick one, document it).

---

## 🟠 High — functional conflicts & broken UI

### 5. Urgent shelf with action cards is unreachable dead UI
`renderShelf` is called with `emptyOnly = groups.length === 0` (`src/app/(tabs)/fridge.tsx:201`) and bails with `if (!emptyOnly || ...)` (`fridge.tsx:400`). So it renders **only when the fridge is empty** — when `urgentGroups` is also empty. The whole action-card block (`fridge.tsx:425-443`) with use/partial/remove buttons can never render with items. ~60 lines of dead JSX plus a confusing double empty-state.

**Fix:** delete `renderShelf` and its empty-shelf placeholder; `EatFirstShelf` + `ItemActionSheet` already cover the job.

### 6. Fridge search button does nothing
`src/app/(tabs)/fridge.tsx:89` — `IconButton` with no `onPress`. Dead control shipping in the header.

**Fix:** wire it or remove until fridge search exists (recipes has search; fridge doesn't).

### 7. Food intelligence is English-only, app is bilingual
`demoFoodCatalog` keys on English names (`src/services/inventoryRules.ts:91`). A Serbian user adding "Млечни производ" or any OFF Serbian product gets `category: other`, generic shelf life, no net-amount catalog match, and `isMetricAmountRunningLow` never fires. Recipe matching (`RECIPE_LIBRARY` ingredient names, English) won't match Serbian inventory names either — the recipes feature is effectively broken for the sr locale.

**Fix (short-term):** match on normalized names per-locale or add sr aliases to the catalog and recipe ingredients. Long term this is the AI / OFF-taxonomy job — flag it in BUILD_PLAN now.

### 8. Hardcoded English strings in the UI path
- `formatComplexity` / `formatTimeLabel` (`src/services/recipeService.ts:134-147`) — "Simple", "2 hr 15 min" — rendered in `recipes.tsx:433`. Serbian UI shows English.
- Missing sr key: `onboarding.hook.slides.3.titleAfter` (en has it, sr doesn't — i18next falls back or prints the key).
- `getShelfLifeRange` returns `"5-10 days"` in English (`inventoryRules.ts:136`), stored in DB and shown in meta.

**Fix:** move all three to i18n keys; add the missing sr key.

### 9. Lint errors — setState-in-effect cascades
`src/app/(tabs)/scan.tsx:126` and `src/components/features/HouseholdSection.tsx:49` (the latter also has an unused `Pressable` import). Real `react-hooks` errors failing `expo lint`.

**Fix:** scan: derive "query too short" at render instead of setting state in the effect; HouseholdSection: key the component on `initialJoinCode` or set state in the event handler.

---

## 🟡 Medium — redundancy & duplication

### 10. `cooked_events` fetched 3× per recipes load, counted 3 ways
One `load()` in `useRecipes` triggers: `listHouseholdRecipes` → `withCookedCounts` (query 1), `listCookedRecipes` (query 2, counts again inline), `listCookedEventRows` (query 3, counted again in the hook into `cookedSummaries`). Three round-trips, three counting implementations of the same fact.

**Fix:** fetch cooked events once in `load()`, derive counts + summaries + cooked list from it; delete `withCookedCounts`.

### 11. `removeInventoryGroup` is N queries
`Promise.all` of per-lot updates (`src/repositories/inventoryRepository.ts:143`).

**Fix:** single `.update(...).in("id", lotIds)`.

### 12. Duplicated urgency ranking
`urgencyRank` (`src/services/inventoryRules.ts:296`) vs `urgencyDepletionRank` (`src/repositories/inventoryRepository.ts:191`) — identical.

**Fix:** export one.

### 13. Overlapping partial-state logic
`getNextPartialState` and `getDepletionUpdate` (`src/services/inventoryRules.ts:164-185`) encode the same full → some_used → low ladder twice.

**Fix:** `getDepletionUpdate` should call `getNextPartialState`.

### 14. Recipe passed to detail screen as 10 JSON-stringified route params
`src/app/(tabs)/recipes.tsx:104-150` — two near-identical param builders. Fragile, duplicated, URL-size-bound.

**Fix:** pass `recipeId` (or a match index), fetch/look up in `recipe-detail`. Kills both builders.

### 15. Barcode lookup has no timeout; search does
`lookupOpenFoodFactsBarcode` can hang the locked barcode camera indefinitely on bad network (`src/services/barcodeService.ts:72` — no AbortController; search has 6 s at `:197`). UI symptom: scanner freezes, `barcodeLocked` stays true.

**Fix:** same AbortController pattern, ~6 s.

### 16. `toggleRecipeFavorite` delete has no `user_id` filter
`src/repositories/recipeRepository.ts:223` — correctness rests entirely on RLS. Works, but one policy regression away from deleting housemates' favorites.

**Fix:** add `.eq("user_id", uid)` defense-in-depth.

---

## 🟢 Dead / unused code (safe deletes)

| What | Where |
|---|---|
| `getRecipeFridgeLabel` (hardcoded English too) | `src/services/recipeService.ts:120` |
| `listHouseholdRecipeSessions` | `src/repositories/recipeRepository.ts:116` |
| `generateFromInventory` action | `src/hooks/useRecipes.ts:200` |
| `addExpiringDemoItem` action | `src/hooks/useInventory.ts:84` |
| `RecipeGenerationResult.prompt` + `buildRecipeGenerationPrompt` (never consumed — keep only if AI integration is next sprint) | `src/services/recipeGenerationService.ts:40` |
| `InventoryReviewCard` component (zero usages) | `src/components/features/InventoryReviewCard.tsx` |
| `groups: []` field in `useInventory` state (always overridden by memo) | `src/hooks/useInventory.ts:17` |
| `styles.refreshButton` — defined, unreferenced | `src/app/(tabs)/fridge.tsx:775` |
| `renderShelf` dead branch (see #5) | `src/app/(tabs)/fridge.tsx:385` |
| `day7Recap` payload values — computed, used only as boolean | `src/hooks/useRetention.ts:46-53` |

---

## Architecture notes (keep the core idea)

- **Mock leakage into prod paths:** `lookupBarcodeProduct` merges live OFF with `mockBarcodeProducts` (`src/services/barcodeService.ts:44`), and the live barcode camera renders a mock-product chip rail (`src/app/(tabs)/scan.tsx:524`). Fine for the prototype per spec — but isolate behind a `__DEV__` / prototype flag now so the seam is visible when receipt OCR/AI lands per BUILD_PLAN.
- **Premium preview self-upgrade (`setPreviewTier`)** is client-side tier writing — correct for the prototype, must die before any real billing.
- **The cross-screen `notifyInventoryChanged` listener set** (`src/hooks/useInventory.ts:24`) is a hand-rolled cache. Works, but it's the first thing React Query/SWR would replace — BUILD_PLAN decision, not urgent.
- Layering is genuinely good: screens → hooks → repositories → services, tests on pure services, RLS-aware comments. The rot is concentrated in the urgency lifecycle (#1–#3) and recipes-load redundancy (#10).

---

## Status (2026-06-11)

| # | Status |
|---|---|
| 1 | ✅ Fixed — `resolveUrgency()` computes on read from expiry/age; stored column never trusted (`inventoryRules.ts`). 3 new tests. |
| 2 | ✅ Fixed — `matchRecipes` uses `resolveUrgency` instead of stale `lot.urgency`. |
| 3 | ✅ Fixed — `computeBestByLabel` uses `expires_at` when set, falls back to shelf life. |
| 4 | ✅ Fixed — manual add scales `netAmount × quantity` to match the catalog path. |
| 5 | ✅ Fixed — unreachable `renderShelf` + orphaned `urgentGroups`/styles deleted. |
| 6 | ✅ Fixed — dead fridge search button + orphaned `SearchIcon`/`Circle` import removed (search is a future feature, not wired to nothing). |
| 7 | ⏳ Deferred — English-only food catalog/recipe matching is an architectural/product decision (per-locale catalog vs AI/OFF taxonomy). Flagged, no mechanical fix. |
| 8 | ✅ Fixed — `formatComplexity`/`formatTimeLabel` now i18n (en+sr keys added); recipe-detail inline English replaced; missing `slides.3.titleAfter` sr key added (parity now 0). `shelf_life_range` left as-is — it's number-parsed, never rendered. |
| 9 | ✅ Fixed — scan effect moves all setState into the timer callback; HouseholdSection uses the render-time prop-sync pattern; unused `Pressable` import removed. Lint clean. |
| 10 | ✅ Fixed in DATABASE_REVIEW D10 (single cooked-events query). |
| 11 | ✅ Fixed in DATABASE_REVIEW D11 (one `.in()` update). |
| 12 | ✅ Fixed — `urgencyRank` exported and reused; duplicate `urgencyDepletionRank` deleted. |
| 13 | ✅ Fixed — `getDepletionUpdate` reuses `getNextPartialState`. |
| 14 | ⏳ Deferred — 10-param navigation → fetch-by-id is a feature-sized refactor touching the cook flow; needs its own PR with on-device verification. Maintainability, not a correctness bug. |
| 15 | ✅ Fixed — `lookupOpenFoodFactsBarcode` now uses an AbortController timeout. |
| 16 | ✅ Fixed — favorite delete scoped with `.eq("user_id", uid)`. |

## Suggested fix order

1. **#1 + #2 + #3** — single PR: "urgency computed, never trusted from DB" (the product's heart, and testable — `inventoryRules.test.ts` already exists).
2. **#4** net × quantity, **#15** timeout, **#9** lint — small, independent.
3. **#8** i18n strings + missing sr key.
4. **#5, #6** + dead-code table — pure deletion PR.
5. **#10, #11, #14** — refactor PR.
