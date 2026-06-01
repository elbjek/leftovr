# Precise Magnitude Depletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deplete measured goods (milk, flour, oil) by the real recipe amount in metric — milk 1L, cook 200ml → 800ml left — while leaving counted goods and the rough partial-state fallback intact.

**Architecture:** Approach B (additive). Two nullable metric columns (`net_amount`, `net_unit`) on `inventory_items`. A pure conversion module (`units.ts`) is the single source of unit math; backend stores metric only. Depletion picks a precise branch when a lot has a metric magnitude and the recipe amount converts to the same dimension, else falls back to today's count/partial-state path. UI gains a display-only metric/imperial toggle and a per-item magnitude override.

**Tech Stack:** React Native (Expo), TypeScript, Supabase (Postgres), vitest (new), AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-06-01-precise-magnitude-depletion-design.md`

---

## File Structure

- Create `src/services/units.ts` — pure unit conversion + formatting.
- Create `src/services/units.test.ts` — vitest unit tests.
- Create `src/services/depletionPlan.ts` — pure depletion planner (no DB).
- Create `src/services/depletionPlan.test.ts` — vitest unit tests.
- Create `supabase/migrations/20260601120000_inventory_net_amount.sql` — schema.
- Create `src/features/settings/useMeasurementSystem.ts` — local metric/imperial setting hook.
- Modify `src/services/inventoryRules.ts` — `CatalogFood`/`InventoryLot`/`InventoryGroup` net fields, catalog seeds, `getCatalogNet`, grouping sums net.
- Modify `src/repositories/inventoryRepository.ts` — select net, seed net on add, rewrite `depleteItemQuantity`, update `recordCookedEventAndDepleteInventory`, add `updateInventoryNetAmount`.
- Modify `src/app/recipe-detail.tsx` — `parseIngredientAmount`, cook handler passes `{normalizedName, amount, unit}`.
- Modify `src/components/features/FoodCard.tsx` — optional `bestBy`/meta already exist; no change unless net shown (net surfaced via `meta` upstream — see Task 9).
- Modify `src/app/(tabs)/fridge.tsx` — show net in item action sheet + magnitude override field.
- Modify `src/app/(tabs)/settings.tsx` — metric/imperial toggle.
- Modify `docs/PRODUCT_SPEC.md` — depletion rules extension.
- Modify `package.json` — vitest dev dep + `test` script.
- Create `vitest.config.ts` — alias `@/` → `src/`.

---

## Task 1: vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Add vitest dev dependency**

Run:
```bash
npm install -D vitest@^3
```
Expected: `vitest` added under devDependencies, install succeeds.

- [ ] **Step 2: Add test script to package.json**

In `package.json` `scripts`, add after `"typecheck"`:
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Create vitest config with path alias**

Create `vitest.config.ts`:
```ts
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Verify the runner starts (no tests yet)**

Run: `npm test`
Expected: vitest runs, reports "No test files found" (exit non-zero is fine here) — confirms vitest is installed and config loads.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-logic tests"
```

---

## Task 2: Unit conversion module (`units.ts`)

**Files:**
- Create: `src/services/units.ts`
- Test: `src/services/units.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/units.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dimensionOf, formatAmount, toMetric } from "./units";

describe("toMetric", () => {
  it("converts volume units to ml", () => {
    expect(toMetric(1, "l")).toEqual({ value: 1000, dimension: "volume" });
    expect(toMetric(200, "ml")).toEqual({ value: 200, dimension: "volume" });
  });
  it("converts cooking units to ml", () => {
    expect(toMetric(1, "tbsp").value).toBeCloseTo(14.79, 2);
    expect(toMetric(1, "tsp").value).toBeCloseTo(4.93, 2);
    expect(toMetric(1, "cup")).toEqual({ value: 240, dimension: "volume" });
  });
  it("converts mass units to g", () => {
    expect(toMetric(1, "kg")).toEqual({ value: 1000, dimension: "mass" });
    expect(toMetric(100, "g")).toEqual({ value: 100, dimension: "mass" });
  });
  it("treats count units as count", () => {
    expect(toMetric(3, "item").dimension).toBe("count");
    expect(toMetric(2, "egg").dimension).toBe("count");
  });
  it("returns null dimension for unconvertible units", () => {
    expect(toMetric(1, "cloves").dimension).toBeNull();
    expect(toMetric(2, "slices").dimension).toBeNull();
    expect(toMetric(1, "handful").dimension).toBeNull();
  });
});

describe("dimensionOf", () => {
  it("maps net units to dimensions", () => {
    expect(dimensionOf("ml")).toBe("volume");
    expect(dimensionOf("g")).toBe("mass");
  });
});

describe("formatAmount", () => {
  it("formats metric volume", () => {
    expect(formatAmount(800, "ml", "metric")).toBe("800 ml");
    expect(formatAmount(1500, "ml", "metric")).toBe("1.5 l");
  });
  it("formats metric mass", () => {
    expect(formatAmount(200, "g", "metric")).toBe("200 g");
    expect(formatAmount(1200, "g", "metric")).toBe("1.2 kg");
  });
  it("formats imperial volume in fl oz", () => {
    expect(formatAmount(29.57, "ml", "imperial")).toBe("1 fl oz");
  });
  it("formats imperial mass in oz", () => {
    expect(formatAmount(28.35, "g", "imperial")).toBe("1 oz");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/units.test.ts`
Expected: FAIL — "Cannot find module './units'".

- [ ] **Step 3: Implement `units.ts`**

Create `src/services/units.ts`:
```ts
export type MetricUnit = "ml" | "g";
export type Dimension = "volume" | "mass" | "count";
export type MeasurementSystem = "metric" | "imperial";

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 240,
};

const MASS_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
};

const COUNT_UNITS = new Set(["item", "items", "egg", "eggs", "piece", "pieces"]);

export function toMetric(
  value: number,
  unit: string,
): { value: number; dimension: Dimension | null } {
  const key = unit.trim().toLowerCase();
  if (key in VOLUME_TO_ML) return { value: value * VOLUME_TO_ML[key], dimension: "volume" };
  if (key in MASS_TO_G) return { value: value * MASS_TO_G[key], dimension: "mass" };
  if (COUNT_UNITS.has(key)) return { value, dimension: "count" };
  return { value, dimension: null };
}

export function dimensionOf(netUnit: MetricUnit): "volume" | "mass" {
  return netUnit === "ml" ? "volume" : "mass";
}

const ML_PER_FL_OZ = 29.5735;
const G_PER_OZ = 28.3495;
const G_PER_LB = 453.592;

function trim(n: number): string {
  return Number(n.toFixed(1)).toString();
}

export function formatAmount(
  metricValue: number,
  netUnit: MetricUnit,
  system: MeasurementSystem,
): string {
  if (system === "imperial") {
    if (netUnit === "ml") return `${trim(metricValue / ML_PER_FL_OZ)} fl oz`;
    if (metricValue >= G_PER_LB) return `${trim(metricValue / G_PER_LB)} lb`;
    return `${trim(metricValue / G_PER_OZ)} oz`;
  }
  if (netUnit === "ml") {
    return metricValue >= 1000 ? `${trim(metricValue / 1000)} l` : `${trim(metricValue)} ml`;
  }
  return metricValue >= 1000 ? `${trim(metricValue / 1000)} kg` : `${trim(metricValue)} g`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/services/units.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Export from services barrel**

In `src/services/index.ts` add:
```ts
export * from "./units";
```

- [ ] **Step 6: Commit**

```bash
git add src/services/units.ts src/services/units.test.ts src/services/index.ts
git commit -m "feat: add metric unit conversion module"
```

---

## Task 3: Catalog magnitudes + types

**Files:**
- Modify: `src/services/inventoryRules.ts`

- [ ] **Step 1: Extend `CatalogFood` type**

In `src/services/inventoryRules.ts`, change the `CatalogFood` type (currently lines ~25-30):
```ts
export type CatalogFood = {
  name: string;
  category: InventoryCategory;
  shelfLifeDays: [number, number];
  unit?: string;
  netAmount?: number;
  netUnit?: "ml" | "g";
};
```

- [ ] **Step 2: Add net fields to `InventoryLot` and `InventoryGroup`**

In the `InventoryLot` type add after `unit: string;`:
```ts
  net_amount: number | null;
  net_unit: "ml" | "g" | null;
```
In the `InventoryGroup` type add after `unit: string;`:
```ts
  netAmount: number | null;
  netUnit: "ml" | "g" | null;
```

- [ ] **Step 3: Seed catalog net amounts**

Replace the measured entries in `demoFoodCatalog` (keep count goods unchanged):
```ts
export const demoFoodCatalog: CatalogFood[] = [
  { name: "Eggs", category: "dairy_eggs", shelfLifeDays: [14, 21], unit: "egg" },
  { name: "Greek yogurt", category: "dairy_eggs", shelfLifeDays: [5, 8], unit: "tub", netAmount: 500, netUnit: "g" },
  { name: "Milk", category: "dairy_eggs", shelfLifeDays: [4, 7], unit: "carton", netAmount: 1000, netUnit: "ml" },
  { name: "Chicken breast", category: "meat", shelfLifeDays: [1, 2], unit: "pack", netAmount: 400, netUnit: "g" },
  { name: "Salmon", category: "fish", shelfLifeDays: [1, 2], unit: "fillet" },
  { name: "Spinach", category: "vegetables", shelfLifeDays: [2, 4], unit: "bag", netAmount: 200, netUnit: "g" },
  { name: "Tomatoes", category: "vegetables", shelfLifeDays: [4, 7], unit: "item" },
  { name: "Bananas", category: "fruit", shelfLifeDays: [3, 5], unit: "item" },
  { name: "Sourdough", category: "bakery", shelfLifeDays: [2, 4], unit: "loaf" },
  { name: "Rice", category: "pantry", shelfLifeDays: [60, 180], unit: "bag", netAmount: 1000, netUnit: "g" },
  { name: "Frozen peas", category: "frozen", shelfLifeDays: [60, 120], unit: "bag", netAmount: 500, netUnit: "g" },
  { name: "Orange juice", category: "drinks", shelfLifeDays: [5, 10], unit: "bottle", netAmount: 1000, netUnit: "ml" },
  { name: "Hummus", category: "snacks", shelfLifeDays: [4, 7], unit: "tub", netAmount: 200, netUnit: "g" },
  { name: "Cheddar", category: "dairy_eggs", shelfLifeDays: [14, 30], unit: "block", netAmount: 200, netUnit: "g" },
];
```
(Note: `Cheddar` is a new catalog entry — recipes reference it as a non-countable gram ingredient.)

- [ ] **Step 4: Add `getCatalogNet` helper**

After `getCatalogFood` (~line 105) add:
```ts
export function getCatalogNet(name: string): { netAmount: number; netUnit: "ml" | "g" } | null {
  const food = getCatalogFood(name);
  if (food?.netAmount && food.netUnit) {
    return { netAmount: food.netAmount, netUnit: food.netUnit };
  }
  return null;
}
```

- [ ] **Step 5: Sum net in `groupInventoryLots`**

In `groupInventoryLots`, when creating a new group set `netAmount`/`netUnit` from the lot, and when merging an existing group add the lot's net. Find the new-group object literal (the `else` branch creating a group) and add:
```ts
      netAmount: lot.net_amount,
      netUnit: lot.net_unit,
```
In the existing-group merge branch (where `existing.quantity += Number(lot.quantity)`), add:
```ts
      if (lot.net_amount != null) {
        existing.netAmount = (existing.netAmount ?? 0) + lot.net_amount;
        existing.netUnit = lot.net_unit;
      }
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: errors only in files not yet updated (inventoryRepository.ts, fridge.tsx) about missing `net_amount`/`net_unit` — those are fixed in later tasks. No errors inside `inventoryRules.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/services/inventoryRules.ts
git commit -m "feat: add catalog net magnitudes and inventory net fields"
```

---

## Task 4: Database migration

**Files:**
- Create: `supabase/migrations/20260601120000_inventory_net_amount.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260601120000_inventory_net_amount.sql`:
```sql
-- Precise magnitude tracking: optional metric net amount per inventory lot.
-- net_unit is canonical metric only (ml | g). Both null = rough item.
alter table public.inventory_items
  add column net_amount numeric(10, 2)
    check (net_amount is null or net_amount > 0),
  add column net_unit text
    check (net_unit is null or net_unit in ('ml', 'g')),
  add constraint inventory_items_net_paired
    check ((net_amount is null) = (net_unit is null));
```

- [ ] **Step 2: Apply locally and verify**

Run: `npm run supabase:reset`
Expected: migrations apply cleanly, including the new one; no SQL errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260601120000_inventory_net_amount.sql
git commit -m "feat: add net_amount/net_unit columns to inventory_items"
```

---

## Task 5: Repository read/write of net

**Files:**
- Modify: `src/repositories/inventoryRepository.ts`

- [ ] **Step 1: Select net columns in `listActiveHouseholdInventory`**

In the `.select(...)` string add `net_amount, net_unit` (after `unit, display_quantity`). In the row mapper add after `unit: row.unit,`:
```ts
    net_amount: row.net_amount ?? null,
    net_unit: row.net_unit ?? null,
```

- [ ] **Step 2: Seed net on `addInventoryItem`**

Import `getCatalogNet` from `@/services` (add to existing import block). In `addInventoryItem`, after `const unit = ...`, add:
```ts
  const catalogNet = getCatalogNet(name);
  const netUnit = catalogNet?.netUnit ?? null;
  const netAmount = catalogNet ? catalogNet.netAmount * quantity : null;
```
In the `.insert({...})` object add after `unit,`:
```ts
      net_amount: netAmount,
      net_unit: netUnit,
```
Add `net_amount, net_unit` to the insert's `.select(...)` string too.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: `addInventoryItem`/`listActiveHouseholdInventory` no longer error on net fields. `depleteItemQuantity` still references old shape — fixed in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/repositories/inventoryRepository.ts
git commit -m "feat: read and seed inventory net amounts"
```

---

## Task 6: Pure depletion planner + repository rewrite

**Files:**
- Create: `src/services/depletionPlan.ts`
- Test: `src/services/depletionPlan.test.ts`
- Modify: `src/repositories/inventoryRepository.ts`
- Modify: `src/services/index.ts`

- [ ] **Step 1: Write failing tests for the planner**

Create `src/services/depletionPlan.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { planDepletion, PlanLot } from "./depletionPlan";

const lot = (over: Partial<PlanLot>): PlanLot => ({
  id: "x",
  quantity: 1,
  partial_state: "full",
  unit: "item",
  net_amount: null,
  net_unit: null,
  ...over,
});

describe("planDepletion - precise", () => {
  it("subtracts recipe ml from a single net lot", () => {
    const lots = [lot({ id: "a", net_amount: 1000, net_unit: "ml" })];
    const ops = planDepletion(lots, { amount: 200, unit: "ml" });
    expect(ops).toEqual([{ kind: "setNet", id: "a", netAmount: 800 }]);
  });
  it("removes a net lot when fully consumed", () => {
    const lots = [lot({ id: "a", net_amount: 200, net_unit: "ml" })];
    const ops = planDepletion(lots, { amount: 200, unit: "ml" });
    expect(ops).toEqual([{ kind: "remove", id: "a" }]);
  });
  it("spills across net lots, soonest first (caller pre-sorts)", () => {
    const lots = [
      lot({ id: "a", net_amount: 150, net_unit: "ml" }),
      lot({ id: "b", net_amount: 1000, net_unit: "ml" }),
    ];
    const ops = planDepletion(lots, { amount: 400, unit: "ml" });
    expect(ops).toEqual([
      { kind: "remove", id: "a" },
      { kind: "setNet", id: "b", netAmount: 750 },
    ]);
  });
});

describe("planDepletion - fallback", () => {
  it("dimension mismatch falls back to partial step", () => {
    const lots = [lot({ id: "a", net_amount: 200, net_unit: "g", partial_state: "full" })];
    const ops = planDepletion(lots, { amount: 200, unit: "ml" });
    expect(ops).toEqual([{ kind: "setPartial", id: "a", partialState: "some_used" }]);
  });
  it("no-net countable lot decrements count", () => {
    const lots = [lot({ id: "a", quantity: 12, unit: "egg" })];
    const ops = planDepletion(lots, { amount: 2, unit: "egg" });
    expect(ops).toEqual([{ kind: "setQuantity", id: "a", quantity: 10 }]);
  });
  it("no-net single unit advances partial state", () => {
    const lots = [lot({ id: "a", quantity: 1, unit: "bag", partial_state: "full" })];
    const ops = planDepletion(lots, { amount: 1, unit: "handful" });
    expect(ops).toEqual([{ kind: "setPartial", id: "a", partialState: "some_used" }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/depletionPlan.test.ts`
Expected: FAIL — "Cannot find module './depletionPlan'".

- [ ] **Step 3: Implement the planner**

Create `src/services/depletionPlan.ts`:
```ts
import { getDepletionUpdate, PartialState } from "./inventoryRules";
import { dimensionOf, toMetric } from "./units";

export type PlanLot = {
  id: string;
  quantity: number;
  partial_state: PartialState;
  unit: string;
  net_amount: number | null;
  net_unit: "ml" | "g" | null;
};

export type DepletionOp =
  | { kind: "remove"; id: string }
  | { kind: "setNet"; id: string; netAmount: number }
  | { kind: "setQuantity"; id: string; quantity: number }
  | { kind: "setPartial"; id: string; partialState: PartialState };

// Lots MUST be pre-sorted soonest-expiry first by the caller.
export function planDepletion(
  lots: PlanLot[],
  need: { amount: number; unit: string },
): DepletionOp[] {
  const ops: DepletionOp[] = [];
  const metric = toMetric(need.amount, need.unit);
  let remainingMetric = metric.dimension === "volume" || metric.dimension === "mass"
    ? metric.value
    : 0;
  let remainingCount = Math.max(1, Math.round(need.amount));

  for (const lot of lots) {
    const precise =
      lot.net_amount != null &&
      lot.net_unit != null &&
      (metric.dimension === "volume" || metric.dimension === "mass") &&
      metric.dimension === dimensionOf(lot.net_unit);

    if (precise) {
      if (remainingMetric <= 0) break;
      const consume = Math.min(lot.net_amount as number, remainingMetric);
      const next = (lot.net_amount as number) - consume;
      ops.push(next <= 0 ? { kind: "remove", id: lot.id } : { kind: "setNet", id: lot.id, netAmount: Number(next.toFixed(2)) });
      remainingMetric -= consume;
      continue;
    }

    // Fallback: count / partial-state, one lot's worth at a time.
    if (remainingCount <= 0) break;
    if (lot.quantity > 1) {
      const consume = Math.min(lot.quantity, remainingCount);
      const nextQ = lot.quantity - consume;
      ops.push(nextQ <= 0 ? { kind: "remove", id: lot.id } : { kind: "setQuantity", id: lot.id, quantity: nextQ });
      remainingCount -= consume;
    } else {
      const d = getDepletionUpdate(lot, 1);
      ops.push(d.shouldRemove ? { kind: "remove", id: lot.id } : { kind: "setPartial", id: lot.id, partialState: d.partialState });
      remainingCount -= 1;
    }
  }

  return ops;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/services/depletionPlan.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Export planner from barrel**

In `src/services/index.ts` add:
```ts
export * from "./depletionPlan";
```

- [ ] **Step 6: Rewrite `depleteItemQuantity` to use the planner**

In `src/repositories/inventoryRepository.ts`, add `planDepletion` to the `@/services` import. Replace the entire `depleteItemQuantity` function with:
```ts
export async function depleteItemQuantity(
  householdId: string,
  normalizedName: string,
  amount = 1,
  unit = "item",
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, quantity, partial_state, unit, urgency, added_at, net_amount, net_unit")
    .eq("household_id", householdId)
    .eq("normalized_name", normalizedName)
    .is("removed_at", null);

  if (error) throw error;

  const lots = (data ?? []) as {
    id: string;
    quantity: number;
    partial_state: PartialState;
    unit: string;
    urgency: "safe" | "use_soon" | "urgent" | null;
    added_at: string;
    net_amount: number | null;
    net_unit: "ml" | "g" | null;
  }[];

  lots.sort((a, b) => {
    const rank = urgencyDepletionRank(b.urgency) - urgencyDepletionRank(a.urgency);
    if (rank !== 0) return rank;
    return a.added_at.localeCompare(b.added_at);
  });

  const ops = planDepletion(lots, { amount, unit });

  for (const op of ops) {
    if (op.kind === "remove") {
      await removeInventoryLot(op.id, "cooked");
      continue;
    }
    const lot = lots.find((l) => l.id === op.id)!;
    const update: Record<string, unknown> = {};
    if (op.kind === "setNet") {
      update.net_amount = op.netAmount;
      update.display_quantity = formatDisplayQuantity(op.netAmount, lot.net_unit ?? lot.unit);
    } else if (op.kind === "setQuantity") {
      update.quantity = op.quantity;
      update.display_quantity = formatDisplayQuantity(op.quantity, lot.unit);
    } else {
      update.partial_state = op.partialState;
    }
    const { error: updateError } = await supabase
      .from("inventory_items")
      .update(update)
      .eq("id", op.id);
    if (updateError) throw updateError;
  }
}
```
(`urgencyDepletionRank` already exists above the old function — keep it.)

- [ ] **Step 7: Update `recordCookedEventAndDepleteInventory` signature**

Change its `usedItems` type and the depletion loop:
```ts
  usedItems: { normalizedName: string; amount?: number | null; unit?: string | null }[];
```
Replace the depletion loop body:
```ts
  for (const item of input.usedItems) {
    await depleteItemQuantity(
      input.householdId,
      item.normalizedName,
      item.amount ?? 1,
      item.unit ?? "item",
    );
  }
```

- [ ] **Step 8: Typecheck + run all tests**

Run: `npm run typecheck && npm test`
Expected: typecheck errors only remain in `recipe-detail.tsx` (caller not yet updated) and `useInventory.ts` `useFirstLot` call (needs unit arg). Tests PASS. Fix `useInventory.ts` `useFirstLot` to pass a unit:
```ts
      useFirstLot: async (group: InventoryGroup) => {
        if (!householdId || !group.lots[0]) return;
        await depleteItemQuantity(householdId, group.normalizedName, 1, group.unit);
        await reloadAndBroadcast();
      },
```
Re-run `npm run typecheck` — only `recipe-detail.tsx` should remain (fixed in Task 7).

- [ ] **Step 9: Commit**

```bash
git add src/services/depletionPlan.ts src/services/depletionPlan.test.ts src/services/index.ts src/repositories/inventoryRepository.ts src/hooks/useInventory.ts
git commit -m "feat: metric-aware depletion via pure planner"
```

---

## Task 7: Recipe amount parsing + cook handler

**Files:**
- Modify: `src/app/recipe-detail.tsx`

- [ ] **Step 1: Replace `parseIngredientQuantity` with `parseIngredientAmount`**

Replace the existing `parseIngredientQuantity` function (~line 316) with:
```ts
function parseIngredientAmount(amount: string): { value: number; unit: string | null } {
  const match = amount.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  const value = match ? Number(match[1]) : NaN;
  const unit = match?.[2]?.toLowerCase() ?? null;
  return {
    value: Number.isFinite(value) && value > 0 ? value : 1,
    unit,
  };
}
```

- [ ] **Step 2: Update `cookedItems` state shape and `handleCookPress`**

Change the `cookedItems` state type's `quantityToUse: number;` line to:
```ts
    quantityToUse: number;
    unit: string;
```
In `handleCookPress`, replace the per-ingredient object's `quantityToUse` line and add `unit`:
```ts
      const parsed = parseIngredientAmount(ing.amount);
      return {
        name: ing.name,
        amount: ing.amount,
        itemId,
        quantityToUse: ing.countable ? parsed.value : (parsed.unit ? parsed.value : 1),
        unit: ing.countable ? "item" : (parsed.unit ?? "item"),
        used: itemId !== null,
      };
```

- [ ] **Step 3: Update `confirmCooked` to pass unit**

Replace the `amountByName` aggregation block with one that also carries unit (first unit seen per name wins):
```ts
      const byName = new Map<string, { amount: number; unit: string }>();
      for (const item of cookedItems) {
        if (!item.used) continue;
        const key = normalizeFoodName(item.name);
        const existing = byName.get(key);
        byName.set(key, {
          amount: (existing?.amount ?? 0) + item.quantityToUse,
          unit: existing?.unit ?? item.unit,
        });
      }
      const usedItems = [...byName.entries()].map(([normalizedName, v]) => ({
        normalizedName,
        amount: v.amount,
        unit: v.unit,
      }));
```

- [ ] **Step 4: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS, zero typecheck errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/recipe-detail.tsx
git commit -m "feat: parse recipe ingredient units for precise depletion"
```

---

## Task 8: Measurement-system setting

**Files:**
- Create: `src/features/settings/useMeasurementSystem.ts`

- [ ] **Step 1: Implement the hook**

Create `src/features/settings/useMeasurementSystem.ts`:
```ts
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MeasurementSystem } from "@/services";

const KEY = "chomp.measurementSystem";
const listeners = new Set<(value: MeasurementSystem) => void>();

export function useMeasurementSystem() {
  const [system, setSystem] = useState<MeasurementSystem>("metric");

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY).then((value) => {
      if (active && (value === "metric" || value === "imperial")) setSystem(value);
    });
    const listener = (value: MeasurementSystem) => setSystem(value);
    listeners.add(listener);
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback(async (value: MeasurementSystem) => {
    await AsyncStorage.setItem(KEY, value);
    for (const l of listeners) l(value);
  }, []);

  return { system, setMeasurementSystem: update };
}
```

- [ ] **Step 2: Export from features barrel**

Check `src/features/index.ts` exists and follows the `export * from "./..."` pattern; add:
```ts
export * from "./settings/useMeasurementSystem";
```
If there is no `settings` barrel convention, this single re-export from the top-level features index is sufficient.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/useMeasurementSystem.ts src/features/index.ts
git commit -m "feat: add metric/imperial measurement system setting"
```

---

## Task 9: UI — show net + override + settings toggle

**Files:**
- Modify: `src/app/(tabs)/fridge.tsx`
- Modify: `src/app/(tabs)/settings.tsx`

- [ ] **Step 1: Settings toggle**

In `src/app/(tabs)/settings.tsx`, import the hook and `SegmentedControl` (already imported). Inside the component add:
```ts
  const { system, setMeasurementSystem } = useMeasurementSystem();
```
Render a settings row (place near the language `SegmentedControl`, matching its surrounding markup):
```tsx
  <SegmentedControl
    options={[
      { label: t("settings.units.metric"), value: "metric" },
      { label: t("settings.units.imperial"), value: "imperial" },
    ]}
    value={system}
    onChange={(value) => setMeasurementSystem(value as "metric" | "imperial")}
  />
```
Add i18n keys `settings.units.metric` = "Metric", `settings.units.imperial` = "Imperial" to `src/i18n/locales/en.ts` and Serbian equivalents to `src/i18n/locales/sr.ts` ("Metrički" / "Imperijalni"). Match `SegmentedControl`'s actual prop names — verify against an existing usage in this file before writing.

- [ ] **Step 2: Show net amount in the item action sheet**

In `src/app/(tabs)/fridge.tsx`, import:
```ts
import { formatAmount } from "@/services";
import { useMeasurementSystem } from "@/features";
```
In `FridgeRoute` add `const { system } = useMeasurementSystem();`. Pass a formatted net string into `ItemActionSheet` via a new prop, or compute inline where the sheet is rendered. In `ItemActionSheet`, under the `group?.meta` line add:
```tsx
{group?.netAmount != null && group.netUnit ? (
  <Text variant="small" muted>
    {formatAmount(group.netAmount, group.netUnit, system)}
  </Text>
) : null}
```
(Thread `system` into `ItemActionSheet` props; follow how `labels` is already passed.)

- [ ] **Step 3: Magnitude override field**

Add `updateInventoryNetAmount` to `src/repositories/inventoryRepository.ts`:
```ts
export async function updateInventoryNetAmount(itemId: string, netAmount: number) {
  if (!(netAmount > 0)) throw new Error("net amount must be positive");
  const supabase = getSupabaseClient();
  const { data: lot, error: readError } = await supabase
    .from("inventory_items")
    .select("net_unit, unit")
    .eq("id", itemId)
    .single<{ net_unit: string | null; unit: string }>();
  if (readError) throw readError;
  const { error } = await supabase
    .from("inventory_items")
    .update({
      net_amount: netAmount,
      display_quantity: formatDisplayQuantity(netAmount, lot.net_unit ?? lot.unit),
    })
    .eq("id", itemId);
  if (error) throw error;
}
```
In `ItemActionSheet`, when `group.netAmount != null`, render a `TextField` (numeric) seeded with the first lot's net and a save button calling `updateInventoryNetAmount(group.lots[0].id, value)` then `reloadAndBroadcast` (expose the refresh via props as the sheet's other actions are). Override edits the **first lot** only; multi-lot precise items show the summed display but edit per-lot.

- [ ] **Step 4: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(tabs)/fridge.tsx src/app/(tabs)/settings.tsx src/repositories/inventoryRepository.ts src/i18n/locales/en.ts src/i18n/locales/sr.ts
git commit -m "feat: show net amount, magnitude override, units toggle"
```

---

## Task 10: PRODUCT_SPEC update

**Files:**
- Modify: `docs/PRODUCT_SPEC.md`

- [ ] **Step 1: Amend depletion rules**

In `docs/PRODUCT_SPEC.md`, under "I Cooked This" → "Depletion rules" (L648), extend the list:
```markdown
Depletion rules:

- countable items decrement quantity
- measured items with a known metric magnitude (net_amount/net_unit) subtract the
  recipe amount converted to metric (e.g. 1L milk, cook 200ml -> 800ml)
- when no magnitude is known, or the recipe unit cannot be converted, fall back
  to partial-use: full -> some used -> low -> removed
- if item is already low, next confirmed use removes it
```
Under "Inventory item fields" (L538) add:
```markdown
- net amount (optional, canonical metric)
- net unit (optional: ml | g)
```
Add a short note that a per-user metric/imperial toggle controls display only; storage is always metric.

- [ ] **Step 2: Commit**

```bash
git add docs/PRODUCT_SPEC.md
git commit -m "docs: extend depletion rules with metric magnitude"
```

---

## Task 11: Full verification

- [ ] **Step 1: Static checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 2: Manual / Playwright walk (web)**

Run: `npm run web`, then drive via Playwright MCP:
1. Add Milk → fridge shows ~1000 ml (1 l). Cook a recipe using 200ml milk → fridge shows ~800 ml without manual reload.
2. Cook eggs recipe (`"2"`) → egg count drops by 2 (count path unchanged).
3. Cook an item whose recipe unit can't convert (spinach "1 handful" if present, else force) → rough partial step, not over-depletion.
4. Toggle Settings → Imperial → milk shows fl oz.
5. Item detail sheet → override milk net to 500 → display updates to 500 ml.

- [ ] **Step 3: Final commit (if any manual fixups)**

```bash
git add -A
git commit -m "test: verify precise magnitude depletion end-to-end"
```

---

## Notes / Risks

- `SegmentedControl` and `TextField` prop names must be confirmed against existing usages in `settings.tsx` before writing Task 9 — the plan assumes `options/value/onChange`-style props.
- `src/features/index.ts` export convention must be confirmed in Task 8.
- The cook handler aggregates by name with "first unit wins"; recipes don't list the same ingredient twice in different units, so this is safe for current data.
- DB stores metric only; imperial is never persisted (display-only), per spec.
