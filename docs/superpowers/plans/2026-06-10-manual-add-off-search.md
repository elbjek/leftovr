# Manual Add: OFF Search + Custom Item Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manual add searches Open Food Facts alongside the local catalog; unknown items get a light create form with name, category, quantity + unit, and optional expiry date.

**Architecture:** Extend `barcodeService.ts` (existing OFF client) with a search-a-licious text search returning `BarcodeProduct[]`. Add `expires_at date` column; when set, urgency derives from days left in `groupInventoryLots`. UI changes live entirely in the manual mode of `scan.tsx`.

**Tech Stack:** Expo / React Native, Supabase (local CLI), vitest, `@react-native-community/datetimepicker` (new dependency).

**Spec:** `docs/superpowers/specs/2026-06-10-manual-add-off-search-design.md`

**Project rule:** CLAUDE.md forbids commits without asking the user. At each commit step, ask the user first (one batch ask at the end is fine if they prefer).

---

### Task 1: Migration — `expires_at` column

**Files:**
- Create: `supabase/migrations/20260610170000_inventory_expires_at.sql`

- [ ] **Step 1: Write migration**

```sql
alter table public.inventory_items
  add column expires_at date;
```

- [ ] **Step 2: Apply locally and verify**

Run: `supabase migration up --local`
Expected: `Applying migration 20260610170000_inventory_expires_at.sql...`

Run: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -tc "select column_name from information_schema.columns where table_name='inventory_items' and column_name='expires_at';"`
Expected: `expires_at`

- [ ] **Step 3: Commit (ask user first)**

```bash
git add supabase/migrations/20260610170000_inventory_expires_at.sql
git commit -m "feat: add expires_at column to inventory_items"
```

---

### Task 2: `inventoryRules` — shelf-life days helper, expiry urgency, lot field

**Files:**
- Modify: `src/services/inventoryRules.ts`
- Test: `src/services/inventoryRules.test.ts` (exists — append)
- Modify: `src/services/recipeGenerationService.test.ts`, `src/services/recipeService.test.ts` (fixture gains `expires_at: null`)

- [ ] **Step 1: Write failing tests** (append to `inventoryRules.test.ts`; match the file's existing import style)

```ts
describe("getShelfLifeDays", () => {
  it("returns catalog days for known foods and category defaults otherwise", () => {
    expect(getShelfLifeDays("Salmon", "fish")).toEqual([1, 2]);
    expect(getShelfLifeDays("Mystery item", "meat")).toEqual([1, 3]);
  });
});

describe("urgencyFromExpiry", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("maps days left to urgency bands", () => {
    expect(urgencyFromExpiry("2026-06-11", now)).toBe("urgent");
    expect(urgencyFromExpiry("2026-06-14", now)).toBe("use_soon");
    expect(urgencyFromExpiry("2026-06-20", now)).toBe("safe");
  });

  it("treats past dates as urgent", () => {
    expect(urgencyFromExpiry("2026-06-01", now)).toBe("urgent");
  });
});
```

Add `getShelfLifeDays`, `urgencyFromExpiry` to the test file's import from `./inventoryRules`.

- [ ] **Step 2: Run tests, verify failure**

Run: `npx vitest run src/services/inventoryRules.test.ts`
Expected: FAIL — `getShelfLifeDays` / `urgencyFromExpiry` not exported.

- [ ] **Step 3: Implement in `inventoryRules.ts`**

Add to `InventoryLot` (after `shelf_life_range`, line ~48):

```ts
  expires_at: string | null;
```

Replace `getShelfLifeRange` (line 129) with:

```ts
export function getShelfLifeDays(name: string, category: InventoryCategory): [number, number] {
  return getCatalogFood(name)?.shelfLifeDays ?? categoryDefaults[category];
}

export function getShelfLifeRange(name: string, category: InventoryCategory) {
  const range = getShelfLifeDays(name, category);
  return `${range[0]}-${range[1]} days`;
}
```

Add after `computeUrgency`:

```ts
export function urgencyFromExpiry(expiresAt: string, now: Date = new Date()): UrgencyBand {
  const expiry = new Date(`${expiresAt}T23:59:59`);
  const daysLeft = (expiry.getTime() - now.getTime()) / 86_400_000;
  if (daysLeft <= 2) return "urgent";
  if (daysLeft <= 5) return "use_soon";
  return "safe";
}
```

In `groupInventoryLots` replace the urgency line (181):

```ts
    const urgency = lot.expires_at
      ? urgencyFromExpiry(lot.expires_at)
      : lot.urgency ?? computeUrgency({ name: lot.name, category: lot.category, addedAt: lot.added_at });
```

In `recipeGenerationService.test.ts` and `recipeService.test.ts`, add `expires_at: null,` to the lot fixtures (next to the `brand_name: null,` line added by the barcode feature).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/services && npx tsc --noEmit`
Expected: all PASS, no type errors. (Typecheck will catch any other `InventoryLot` constructors missing `expires_at` — fix them with `expires_at: null`.)

- [ ] **Step 5: Commit (ask user first)**

```bash
git add src/services/inventoryRules.ts src/services/inventoryRules.test.ts src/services/recipeGenerationService.test.ts src/services/recipeService.test.ts
git commit -m "feat: derive urgency from expiry date when set"
```

---

### Task 3: Repository — accept and return `expires_at`

**Files:**
- Modify: `src/repositories/inventoryRepository.ts`

No unit tests exist for repositories (supabase client); verification is typecheck + the existing pattern.

- [ ] **Step 1: Extend `AddInventoryItemInput`** (after `netUnit`, line ~25)

```ts
  expiresAt?: string | null;
```

- [ ] **Step 2: Add column to both select strings**

In `listActiveHouseholdInventory` (line ~36) and `addInventoryItem`'s `.select(...)` (line ~116), add `expires_at` right after `shelf_life_range` in the column list.

In the row mapping inside `listActiveHouseholdInventory` add:

```ts
    expires_at: row.expires_at ?? null,
```

- [ ] **Step 3: Insert the value** — in `addInventoryItem`'s `.insert({...})` add:

```ts
      expires_at: input.expiresAt ?? null,
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit (ask user first)**

```bash
git add src/repositories/inventoryRepository.ts
git commit -m "feat: persist expires_at on inventory items"
```

---

### Task 4: `barcodeService` — OFF text search

**Files:**
- Modify: `src/services/barcodeService.ts`
- Test: `src/services/barcodeService.test.ts` (exists — append)

- [ ] **Step 1: Write failing tests** (append inside the existing `describe("barcodeService")`)

```ts
  it("maps Open Food Facts search hits to products", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        hits: [
          {
            code: "0894700010137",
            product_name: "Nonfat Greek Yogurt",
            brands: ["Chobani"],
            quantity: "32 OZ",
            categories_tags: ["en:dairies", "en:yogurts"],
          },
          {
            code: "5901234123457",
            product_name: "Plain Yogurt",
            brands: "Local Farm",
            categories_tags: ["en:yogurts"],
          },
          { code: "123", product_name: "  " },
          { product_name: "No code product" },
        ],
      }),
    })));

    await expect(searchOpenFoodFactsProducts("greek yogurt")).resolves.toEqual([
      {
        barcode: "0894700010137",
        name: "Nonfat Greek Yogurt",
        brandName: "Chobani",
        category: "dairy_eggs",
        quantity: 1,
        unit: "package",
        netAmount: 907.18,
        netUnit: "g",
      },
      {
        barcode: "5901234123457",
        name: "Plain Yogurt",
        brandName: "Local Farm",
        category: "dairy_eggs",
        quantity: 1,
        unit: "item",
        netAmount: null,
        netUnit: null,
      },
    ]);
  });

  it("returns empty list when search fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    await expect(searchOpenFoodFactsProducts("milk")).resolves.toEqual([]);
  });

  it("returns empty list for blank queries without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchOpenFoodFactsProducts("   ")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
```

Add `searchOpenFoodFactsProducts` to the imports from `./barcodeService`.

- [ ] **Step 2: Run tests, verify failure**

Run: `npx vitest run src/services/barcodeService.test.ts`
Expected: FAIL — `searchOpenFoodFactsProducts` not exported.

- [ ] **Step 3: Implement in `barcodeService.ts`**

Add constants near the existing ones:

```ts
const OPEN_FOOD_FACTS_SEARCH_URL = "https://search.openfoodfacts.org/search";
const OPEN_FOOD_FACTS_SEARCH_TIMEOUT_MS = 6000;
const OPEN_FOOD_FACTS_SEARCH_FIELDS = "code,product_name,brands,quantity,categories_tags";
```

Add types and functions:

```ts
type OpenFoodFactsSearchHit = {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  quantity?: string;
  categories_tags?: string[];
};

type OpenFoodFactsSearchResponse = {
  hits?: OpenFoodFactsSearchHit[];
};

export async function searchOpenFoodFactsProducts(query: string): Promise<BarcodeProduct[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPEN_FOOD_FACTS_SEARCH_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      q: normalizedQuery,
      page_size: "8",
      fields: OPEN_FOOD_FACTS_SEARCH_FIELDS,
    });
    const response = await fetch(`${OPEN_FOOD_FACTS_SEARCH_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Chomp/1.0 (local-dev@chomp.app)",
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as OpenFoodFactsSearchResponse;
    return (payload.hits ?? [])
      .map(mapSearchHit)
      .filter((product): product is BarcodeProduct => product !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function mapSearchHit(hit: OpenFoodFactsSearchHit): BarcodeProduct | null {
  const name = hit.product_name?.trim();
  if (!hit.code || !name) return null;

  const brands = Array.isArray(hit.brands) ? hit.brands.join(",") : hit.brands;
  const packageAmount = parseOpenFoodFactsQuantity(hit.quantity);

  return {
    barcode: hit.code,
    name,
    brandName: getBrandName(brands),
    category: inferOpenFoodFactsCategory(hit.categories_tags ?? []),
    quantity: 1,
    unit: packageAmount ? "package" : "item",
    netAmount: packageAmount?.netAmount ?? null,
    netUnit: packageAmount?.netUnit ?? null,
  };
}
```

Note: `parseOpenFoodFactsQuantity("32 OZ")` → `{ netAmount: 907.18, netUnit: "g" }` (32 × 28.3495 = 907.184, rounded). If the test expectation mismatches by a cent, trust the function's rounding and fix the test value.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/services/barcodeService.test.ts`
Expected: all PASS (9 tests).

- [ ] **Step 5: Commit (ask user first)**

```bash
git add src/services/barcodeService.ts src/services/barcodeService.test.ts
git commit -m "feat: add Open Food Facts text search"
```

---

### Task 5: Date picker dependency

**Files:**
- Modify: `package.json`, lockfile

- [ ] **Step 1: Install via expo (picks the SDK-compatible version)**

Run: `npx expo install @react-native-community/datetimepicker`
Expected: dependency added to `package.json`.

- [ ] **Step 2: Commit (ask user first)**

```bash
git add package.json package-lock.json
git commit -m "chore: add datetimepicker for expiry date"
```

---

### Task 6: i18n strings

**Files:**
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/sr.ts`

- [ ] **Step 1: Add keys**

In `en.ts`, inside the `scan` object's `manual` block that holds `searchLabel`/`placeholder`/`addCustom` (around line 295 region — the block used by `scan.manual.*` keys, not the small `scanChoice` one at line 189):

```ts
    onlineResults: "From Open Food Facts",
    quantityLabel: "Quantity",
    unitLabel: "Unit",
    expiryLabel: "Expires",
    expiryNone: "No date",
```

In `sr.ts`, same block:

```ts
    onlineResults: "Sa Open Food Facts",
    quantityLabel: "Kolicina",
    unitLabel: "Jedinica",
    expiryLabel: "Rok trajanja",
    expiryNone: "Bez datuma",
```

(Match surrounding ASCII-only Serbian style — existing file avoids diacritics.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (sr is typed against en).

- [ ] **Step 3: Commit (ask user first)**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/sr.ts
git commit -m "feat: manual add OFF search strings"
```

---

### Task 7: `scan.tsx` — OFF results + create form

**Files:**
- Modify: `src/app/(tabs)/scan.tsx`

No component test infra; verify via typecheck + manual run (Task 8).

- [ ] **Step 1: Imports and state**

Add imports: `searchOpenFoodFactsProducts`, `getShelfLifeDays` from `@/services`; `DateTimePicker` from `@react-native-community/datetimepicker`; ensure `useEffect` is imported from react; `Platform` from react-native if not present.

Add state next to `manualQuery`/`manualCategory` (line ~74):

```ts
  const [offResults, setOffResults] = useState<BarcodeProduct[]>([]);
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualUnit, setManualUnit] = useState("item");
  const [manualExpiry, setManualExpiry] = useState<Date | null>(null);
  const [manualExpiryEnabled, setManualExpiryEnabled] = useState(true);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
```

- [ ] **Step 2: Debounced OFF search effect** (after the `manualSuggestions` memo)

```ts
  useEffect(() => {
    const query = manualQuery.trim();
    if (query.length < 3) {
      setOffResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchOpenFoodFactsProducts(query);
      if (!cancelled) setOffResults(results);
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [manualQuery]);
```

- [ ] **Step 3: Extend `addManualItem`** (line 285) — replace the input type and insert call:

```ts
  async function addManualItem(input: {
    name: string;
    category?: InventoryCategory;
    unit?: string;
    quantity?: number;
    brandName?: string | null;
    netAmount?: number | null;
    netUnit?: "ml" | "g" | null;
    expiresAt?: string | null;
  }) {
```

and in the `addInventoryItem({...})` call add:

```ts
        quantity: input.quantity ?? 1,
        brandName: input.brandName ?? undefined,
        netAmount: input.netAmount,
        netUnit: input.netUnit,
        expiresAt: input.expiresAt,
```

After the success path (`setManualQuery("")`), also reset the form:

```ts
      setManualQuantity(1);
      setManualUnit("item");
      setManualExpiry(null);
      setManualExpiryEnabled(true);
```

- [ ] **Step 4: Render OFF results** — in the `mode === "manual"` block, after the local `styles.suggestions` View (line ~541), add:

```tsx
        {offResults.length > 0 ? (
          <View style={styles.suggestions}>
            <Text variant="small" muted>
              {t("scan.manual.onlineResults")}
            </Text>
            {offResults.map((product) => (
              <Pressable
                key={product.barcode}
                accessibilityRole="button"
                onPress={() =>
                  addManualItem({
                    name: product.name,
                    category: product.category,
                    unit: product.unit,
                    brandName: product.brandName,
                    netAmount: product.netAmount,
                    netUnit: product.netUnit,
                  })
                }
                style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
              >
                <View>
                  <Text variant="label">{product.name}</Text>
                  <Text variant="small" muted>
                    {[product.brandName, formatNet(product)].filter(Boolean).join(" · ") ||
                      t(`scan.categories.${product.category}`)}
                  </Text>
                </View>
                <Text variant="label" color={colors.primary}>
                  {t("scan.add")}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
```

Add a small helper above the component (module scope):

```ts
function formatNet(product: BarcodeProduct) {
  return product.netAmount && product.netUnit ? `${product.netAmount} ${product.netUnit}` : null;
}
```

- [ ] **Step 5: Extend the custom-add card** — inside the existing `showCustomManualAdd` Card, between the category grid and the Add button, add:

```tsx
            <View style={styles.formRow}>
              <Text variant="label">{t("scan.manual.quantityLabel")}</Text>
              <View style={styles.stepper}>
                <Button
                  title="−"
                  variant="text"
                  onPress={() => setManualQuantity((current) => Math.max(1, current - 1))}
                />
                <Text variant="label">{manualQuantity}</Text>
                <Button
                  title="+"
                  variant="text"
                  onPress={() => setManualQuantity((current) => current + 1)}
                />
              </View>
            </View>

            <TextField
              label={t("scan.manual.unitLabel")}
              value={manualUnit}
              onChangeText={setManualUnit}
              autoCapitalize="none"
            />

            <View style={styles.formRow}>
              <Text variant="label">{t("scan.manual.expiryLabel")}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (!manualExpiryEnabled) {
                    setManualExpiryEnabled(true);
                    return;
                  }
                  setShowExpiryPicker(true);
                }}
              >
                <Text variant="label" color={colors.primary}>
                  {manualExpiryEnabled
                    ? expiryValue.toLocaleDateString()
                    : t("scan.manual.expiryNone")}
                </Text>
              </Pressable>
              {manualExpiryEnabled ? (
                <Button
                  title={t("scan.manual.expiryNone")}
                  variant="text"
                  onPress={() => setManualExpiryEnabled(false)}
                />
              ) : null}
            </View>

            {showExpiryPicker && manualExpiryEnabled ? (
              <DateTimePicker
                value={expiryValue}
                mode="date"
                minimumDate={new Date()}
                onChange={(_event, date) => {
                  setShowExpiryPicker(Platform.OS === "ios");
                  if (date) setManualExpiry(date);
                }}
              />
            ) : null}
```

Add the derived default before the return (component body):

```ts
  const defaultExpiry = useMemo(() => {
    const [, upper] = getShelfLifeDays(manualQuery.trim(), manualCategory);
    const date = new Date();
    date.setDate(date.getDate() + upper);
    return date;
  }, [manualQuery, manualCategory]);
  const expiryValue = manualExpiry ?? defaultExpiry;
```

Change the card's Add button handler to:

```ts
              onPress={() =>
                addManualItem({
                  name: manualQuery,
                  category: manualCategory,
                  quantity: manualQuantity,
                  unit: manualUnit.trim() || "item",
                  expiresAt: manualExpiryEnabled
                    ? expiryValue.toISOString().slice(0, 10)
                    : null,
                })
              }
```

- [ ] **Step 6: Styles** — add to the StyleSheet (match existing token usage):

```ts
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
```

- [ ] **Step 7: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run src/services`
Expected: clean, all PASS.

- [ ] **Step 8: Commit (ask user first)**

```bash
git add "src/app/(tabs)/scan.tsx"
git commit -m "feat: manual add searches Open Food Facts with custom create form"
```

---

### Task 8: Docs + manual verification

**Files:**
- Modify: `docs/PRODUCT_SPEC.md` (Manual Entry section, line ~436)
- Modify: `docs/BUILD_PLAN.md` (manual entry task list, line ~395)

- [ ] **Step 1: Update PRODUCT_SPEC.md Manual Entry** — replace the V1 list and custom-item section with:

```markdown
V1 includes:

- search field
- autocomplete against a small local preset catalog (instant, offline)
- Open Food Facts text search below local matches (debounced, online only)
- tap-to-add suggestions from both sources

If item does not exist:

1. User types item name.
2. App shows `Add "{typed item}"`.
3. User chooses category, quantity + unit, and an optional expiry date
   (prefilled from the category shelf-life default, skippable).
4. Item is added; when an expiry date is set, urgency is derived from days
   left instead of the shelf-life heuristic.

Custom manual items require:

- name
- category

Quantity defaults to `1 item`; expiry is optional. Still no heavy form.
```

- [ ] **Step 2: Update BUILD_PLAN.md** — in the manual entry tasks, add:

```markdown
- Add Open Food Facts manual text search (search-a-licious) merged with local catalog autocomplete.
- Extend custom manual create with quantity/unit and optional expiry date (expires_at).
```

- [ ] **Step 3: Manual verification in simulator**

1. Scan tab → Add manually. Type "greek yogurt" → local matches instant, OFF results appear ~0.5 s later with brand/amount. Tap one → addSuccess, item in fridge.
2. Airplane mode → search still shows local matches, no error, no OFF section.
3. Type unknown name → `Add "..."` card: set quantity 2, unit "jar", keep prefilled expiry → add → fridge shows item; set expiry to tomorrow → item shows urgent band.
4. "No date" → adds with null expiry, heuristic urgency.

- [ ] **Step 4: Commit (ask user first)**

```bash
git add docs/PRODUCT_SPEC.md docs/BUILD_PLAN.md
git commit -m "docs: manual add OFF search + custom create spec"
```
