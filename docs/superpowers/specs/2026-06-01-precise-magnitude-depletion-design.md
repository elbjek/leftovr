# Precise Magnitude Depletion — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)
**Branch:** fix/split-across-lots (or successor)

## Problem

Inventory depletion treats every non-countable item as a single coarse step
(`full → some_used → low → removed`). Cooking with "200ml milk" or "100g flour"
knocks one vague step off a `1 carton` / `1 bag` item instead of reflecting the
real amount used. Counted goods (eggs, bananas, tomatoes) already decrement
correctly; measured goods do not.

User goal: when an item's magnitude is known (milk = 1L), using 200ml should
leave 800ml. Not gram-perfect tracking of everything — magnitude respected
**when known**, rough state as the fallback.

## Conflict with PRODUCT_SPEC and resolution

`docs/PRODUCT_SPEC.md` mandates an approximate model:
- L536 "Track approximate food, not exact household stock."
- L627/629 "rough quantity state", "adjust rough quantity"
- L648–652 depletion rules: countable decrement; partial-use `full → some_used → low → removed`.

This design **extends** that model rather than replacing it: precise magnitude
depletion applies only where a metric magnitude is known and the recipe amount
converts to it. Everywhere else, the documented rough partial-state model
remains as the fallback floor. PRODUCT_SPEC is updated to record the extension
(see §7).

## Decisions captured during brainstorming

1. Scoped precision: magnitude-aware depletion when known; rough fallback otherwise.
2. Magnitude source: catalog default **+ per-item user override**.
3. Backend canonical = **metric** (`ml` for volume, `g` for mass). Counts stay counts.
4. Recipe cooking units (`tsp`/`tbsp`/`cup`) normalize to `ml` in backend.
5. UI metric/imperial toggle is **display-only**; nothing imperial is stored.
6. Fallback when unconvertible / no magnitude → existing rough partial-state.
7. Data model = **Approach B**: additive nullable metric columns; count model untouched.
8. Add **vitest** for pure-logic tests. Magnitude override UI shipped this round.

## Architecture (Approach B — additive)

Two new nullable columns on `inventory_items`, paired:

```sql
net_amount numeric(10,2) check (net_amount is null or net_amount > 0)
net_unit   text          check (net_unit is null or net_unit in ('ml','g'))
check ((net_amount is null) = (net_unit is null))
```

- Both null → **rough item**: uses today's `partial_state` path, unchanged.
- Both set → **precise item**: `net_amount` is remaining quantity in canonical
  metric unit (`net_unit`).
- Existing `quantity` / `unit` / `partial_state` semantics unchanged. Eggs,
  bananas, scan, and receipt-review flows are untouched.
- Multiple containers remain separate lots (existing split-across-lots). Each
  lot carries its own `net_amount` (e.g. 2 milk cartons = 2 lots × 1000ml).

## Components

### 1. Conversion module — `src/services/units.ts` (pure, unit-tested)

Single source of truth for all unit math. Backend stores metric only.

- `toMetric(value: number, unit: string): { value: number; dimension: 'volume' | 'mass' | 'count' | null }`
  - volume table → `ml`: `ml=1, l=1000, tsp=4.93, tbsp=14.79, cup=240`
  - mass table → `g`: `g=1, kg=1000`
  - count units (`item`, `egg`, etc.) → `dimension: 'count'`
  - unknown (`cloves`, `slices`, `handful`, `ripe`, `large`, `medium`) → `dimension: null`
- `formatAmount(metricValue: number, netUnit: 'ml' | 'g', system: 'metric' | 'imperial'): string`
  - metric: `ml`/`l`, `g`/`kg` with sensible thresholds and rounding
  - imperial: volume → `fl oz`; mass → `oz`/`lb`
- `dimensionOf(netUnit: 'ml' | 'g'): 'volume' | 'mass'` helper for matching.

### 2. Catalog magnitudes — `src/services/inventoryRules.ts`

Extend `CatalogFood` with optional `netAmount?: number` and `netUnit?: 'ml' | 'g'`.
Seed measured foods:

| Food | net |
|------|-----|
| Milk | 1000 ml |
| Orange juice | 1000 ml |
| Greek yogurt | 500 g |
| Hummus | 200 g |
| Spinach | 200 g |
| Rice | 1000 g |
| Frozen peas | 500 g |
| Chicken breast | 400 g |
| Cheddar | 200 g |

Count goods (Eggs, Bananas, Tomatoes, Salmon fillets, Sourdough) → no net.

`addInventoryItem` seeds each lot's `net_amount`/`net_unit` from the catalog
default when present. `net_amount` is the **total** metric amount for the lot:
when a lot is added with `quantity > 1` (e.g. a receipt row of 2 cartons),
`net_amount = catalogNet × quantity` (2 × 1000 = 2000 ml). Depletion subtracts
from this total; the lot is removed when it reaches 0. (Receipt/barcode
templates may carry explicit net later; not required for V1 of this feature.)

### 3. Recipe amount parsing — `src/app/recipe-detail.tsx`

Replace number-only `parseIngredientQuantity` with
`parseIngredientAmount(str): { value: number; unit: string | null }`.
Examples: `"200ml" → {200,"ml"}`, `"2 tbsp" → {2,"tbsp"}`, `"3 cloves" → {3,"cloves"}`,
`"2 ripe" → {2,null}`.

Routing per ingredient:
- `countable: true` → **count path** (today's behavior, unchanged).
- `countable: false` + unit converts to metric → **precise path**.
- `countable: false` + unit does not convert → **rough fallback**.

The cook handler passes `{ normalizedName, amount, unit }` per used ingredient
(summed by normalized name as today).

### 4. Depletion — `src/repositories/inventoryRepository.ts`

Rewrite `depleteItemQuantity` to accept `{ householdId, normalizedName, amount, unit }`.
Fetch active lots, sort soonest-expiry first (existing urgency + added_at sort).

Per lot, choose branch:
- **Precise** — lot has `net_amount`/`net_unit` AND recipe amount's dimension
  (via `toMetric`) matches `dimensionOf(net_unit)`:
  - `consume = min(lot.net_amount, remainingMetric)`
  - `next = net_amount - consume`; if `next <= 0` → `removeInventoryLot(lot.id, "cooked")`,
    else update `net_amount = next` + recompute `display_quantity`
  - `remainingMetric -= consume`
- **Fallback** — no net on lot, or dimension mismatch, or recipe unit unconvertible:
  - today's logic: `quantity > 1` → decrement count; single unit → `getDepletionUpdate`
    partial-state step.

`recordCookedEventAndDepleteInventory` updates its `usedItems` shape to
`{ normalizedName, amount, unit }[]` and depletes sequentially (as today, to
avoid races on the same lot).

**Scope cut:** precise depletion fires only from **recipe cooking**, where an
explicit amount exists. Fridge manual "use" (`useFirstLot`) stays rough — "use 1"
carries no amount. Amount entry on manual use is deferred (YAGNI).

### 5. UI — display + metric/imperial toggle

- Per-user setting `measurementSystem: 'metric' | 'imperial'`, default `metric`,
  persisted locally (follow existing local settings persistence; no DB column).
- Settings tab gains the toggle.
- `FoodCard` and the item detail sheet show net when present, formatted via
  `formatAmount(...)` using the active system (e.g. "≈800 ml left").
- Item detail sheet gains a magnitude **override** field for precise items
  (edit `net_amount`; unit follows the item's `net_unit`).

### 6. PRODUCT_SPEC.md update

Amend the "I Cooked This → Depletion rules" section to add:
- measured-goods precise rule (subtract recipe amount from known metric magnitude),
- `net_amount` / `net_unit` inventory fields,
- metric/imperial display toggle,
- explicit note: rough partial-state remains the fallback when magnitude unknown.

## Data flow (cook with 200ml milk, carton = 1000ml)

1. Recipe ingredient `"200ml" milk`, `countable:false`.
2. `parseIngredientAmount` → `{200, "ml"}`.
3. Cook handler sums by name → `{ normalizedName:"milk", amount:200, unit:"ml" }`.
4. `depleteItemQuantity`: lot net `1000ml`, dimension volume matches → consume 200 → net `800ml`.
5. `display_quantity` recomputed; fridge refreshes via `notifyInventoryChanged`.
6. UI shows "≈800 ml" (or fl oz under imperial toggle).

## Error handling / edge cases

- Recipe amount larger than one lot's net → spills to next lot (soonest-expiry
  first), exactly like count spill.
- Precise item but recipe gives unconvertible unit (e.g. "1 handful spinach") →
  rough fallback step on that lot.
- Rough item (no net) cooked with a metric amount → rough fallback (no net to
  subtract from).
- `net_amount` reaching 0 removes the lot (`quantity > 0` DB check already
  enforces positive `quantity`; net handled in app logic).
- User override sets `net_amount` ≤ 0 → reject in UI; minimum positive.

## Testing

- **vitest** added as dev dependency.
- Unit tests: `units.ts` (`toMetric` across all units incl. unknown → null;
  `formatAmount` metric + imperial rounding) and the pure depletion-calc
  (precise consume/spill, fallback selection, mixed lots).
- Manual/Playwright: cook precise item (milk 200ml → 800ml), cook count item
  (eggs unchanged), cook unconvertible (rough fallback), metric/imperial toggle,
  magnitude override in detail sheet.

## Out of scope

- Amount entry on manual fridge "use".
- Receipt/barcode template net seeding.
- Imperial storage (display-only).
- Per-household measurement system sync.
