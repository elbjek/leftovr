# Manual Add: Open Food Facts Search + Custom Item Creation

Date: 2026-06-10
Status: Approved

## Goal

Manual add searches Open Food Facts (OFF) alongside the local preset catalog.
If the item doesn't exist, the user creates a custom item with name, category,
quantity + unit, and an optional expiry date.

## Decisions

- **Search source:** merged — local catalog matches render instantly on top,
  OFF results load below after a debounce. Offline search still works locally.
- **Amount:** quantity + unit (e.g. "2 cartons"), matching existing
  `quantity`/`unit` columns. Not net amount.
- **Expiry:** optional exact date, new `expires_at date` column. Date picker
  prefilled from the category shelf-life default; user can adjust or skip.
  When set, urgency is computed from days left instead of the heuristic.
- **Tap OFF result:** instant add with OFF data (name, brand, category,
  package amount), quantity 1, `source: "manual"` — same one-tap behavior as
  catalog suggestions and barcode scan.
- **Service location:** extend `src/services/barcodeService.ts` (the existing
  OFF client) rather than a new service. Reuses
  `parseOpenFoodFactsQuantity`, `inferOpenFoodFactsCategory`, brand parsing.
- **Search endpoint:** search-a-licious
  (`https://search.openfoodfacts.org/search`) — verified fast and returns
  `code, product_name, brands, quantity, categories_tags`. Legacy
  `cgi/search.pl` rejected (slow, discouraged for autocomplete).

## Data model

Migration `inventory_expires_at`:

```sql
alter table public.inventory_items
  add column expires_at date;
```

- `AddInventoryItemInput` gains `expiresAt?: string | null`.
- `InventoryLot` gains `expires_at: string | null`; both inventory selects in
  `inventoryRepository.ts` include the column.
- `computeUrgency`: when `expires_at` is set, derive band from days left —
  ≤ 2 days `urgent`, ≤ 5 days `use_soon`, else `safe` (same bands as the
  existing heuristic). Otherwise unchanged heuristic.
- Only the manual create form sets `expires_at` for now; barcode and receipt
  flows are unchanged (column stays null).

## Service

`searchOpenFoodFactsProducts(query: string): Promise<BarcodeProduct[]>` in
`barcodeService.ts`:

- GET `https://search.openfoodfacts.org/search?q=<query>&page_size=8&fields=code,product_name,brands,quantity,categories_tags`
- Same User-Agent header as the product lookup; `AbortSignal.timeout` so a
  dead network can't hang the UI.
- Maps each hit to `BarcodeProduct` via the existing helpers. Note:
  search-a-licious returns `brands` as a **string array** (product API returns
  a comma-separated string) — mapping handles both.
- Returns `[]` on any failure (network, non-OK, parse). Search degrades
  silently to local-catalog-only; no error surfaced.

## UI flow (`src/app/(tabs)/scan.tsx`, manual mode)

1. Search field unchanged. Local catalog matches render instantly at the top
   (current behavior).
2. Query ≥ 3 chars → debounced (~400 ms) OFF search. Results render below the
   local matches showing name, brand, and package amount. Tap = instant add.
3. `Add "{typed}"` row stays last. Tapping it opens a light create form:
   - name (prefilled with typed query)
   - category (existing picker)
   - quantity stepper + unit
   - expiry date picker, prefilled to today + the upper bound of the category
     shelf-life range (`getShelfLifeRange`), skippable
4. Add button inserts with `source: "manual"`, then the existing
   success flow (`completeFirstFillIfNeeded`, `refresh`, `addSuccess`).

## Error handling

- OFF search failure/offline: local catalog and custom create fully work; no
  error banner.
- Create form validation: name non-empty (existing), quantity > 0.

## Testing

- Search response mapping: brands-as-array, missing quantity, empty hits,
  failure → `[]`.
- Urgency-from-expiry thresholds: 1 day → urgent, 4 days → use_soon,
  10 days → safe, null → heuristic fallback.
- Debounce is UI behavior, not unit-tested.
- Existing barcode tests untouched.

## Spec updates

- `docs/PRODUCT_SPEC.md` Manual Entry: OFF search merged with local catalog;
  custom item fields = name, category, quantity + unit, optional expiry date.
- `docs/BUILD_PLAN.md`: task line for OFF manual search + custom create form.
