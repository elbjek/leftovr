# Receipt Normalization Pipeline + Cache — Design

**Date:** 2026-06-12
**Status:** Approved scope, pending implementation

## Problem

Receipt scanning is the product's selling point, but the flow is mock-only:
`scan.tsx` shows a camera, then injects `mockReceiptTemplates[0]`. The
`normalize-receipt` Edge Function is a 7-line stub. This design replaces the
mock with a real Claude-vision pipeline and adds the industry-standard
normalization cache.

## Decisions

- **OCR location: server-side Claude vision** (one multimodal call). Chosen over
  on-device ML Kit OCR + text-only Claude because it needs no native module
  (stays Expo Go compatible) and is the simplest robust pipeline. Tradeoff
  accepted: the vision call runs on every new receipt (~0.5–2¢ on Haiku), so
  the cache buys consistency and a data asset, not large cost cuts. A later
  switch to on-device OCR reuses the cache unchanged.
- **No silent mock fallback.** Recipes fall back to the mock matcher on AI
  failure; receipts must not — inserting fake groceries corrupts the fridge.
  Failure marks the scan `failed` and shows an error with retry. Mock
  templates remain only when Supabase config is absent (dev).
- **`receipt_scans` is the attempt record.** It already has
  `processing/completed/failed` status, error message, and a duplicate
  signature index — no new attempts table. It gains an `image_path` column.
- **Model:** `claude-haiku-4-5`. The spec's old "future model"
  (`claude-sonnet-4-20250514`) is stale; Haiku vision is sufficient and far
  cheaper for receipt transcription.

## Components

### 1. Storage

Private bucket `receipt-images`. Objects at `{householdId}/{uuid}.jpg`.
RLS: household members may insert/read within their household's prefix.
Client compresses before upload (~1500px max dimension, JPEG ~0.7 quality)
via `expo-image-manipulator` (new dependency, Expo Go compatible).

### 2. Edge Function `normalize-receipt`

Request: `{ householdId, scanId, imagePath }` with user JWT.

Pipeline:

1. Auth: resolve user from JWT; verify profile's active household matches
   `householdId` (same pattern as `generate-recipes`).
2. Gate server-side: premium tier, or free receipt scan unused
   (`profiles.free_receipt_scan_used_at`). Today only the client checks.
3. Rate limit: daily cap counted from `receipt_scans` per user
   (premium 30/day, free 1 total via the free-scan flag).
4. Mark scan `processing`; download image from Storage with service role.
5. One Claude vision call, `json_schema`-constrained output:

   ```json
   {
     "storeChain": "string",
     "purchaseDate": "string|null",
     "total": "number|null",
     "lines": [
       {
         "rawText": "string",
         "confidence": "number 0-1",
         "item": {
           "name": "string",
           "normalizedName": "string",
           "category": "string (app taxonomy enum)",
           "quantity": "number|null",
           "unit": "string|null",
           "netAmount": "number|null",
           "netUnit": "ml|g|null"
         }
       }
     ]
   }
   ```

6. Cache pass (see below): override hits, write back qualifying misses.
7. Duplicate detection: `receipt_signature =
   hash(storeChain, purchaseDate, total, sorted normalized names)` —
   fits the existing partial unique index on
   `(household_id, receipt_signature)`. On conflict, mark scan as duplicate
   (`duplicate_of`) and return the duplicate verdict to the client.
8. Update scan row: `completed` + `item_count`/`review_count`
   (review = lines with confidence < 0.8), `processed_at`, or `failed` +
   `error_message`.
9. Respond with normalized lines for the existing confirm UI.

### 3. Cache table `receipt_line_cache` (migration)

```sql
store_chain      text not null
raw_line_text    text not null
name             text not null
normalized_name  text not null
category         text not null
quantity         numeric
unit             text
net_amount       numeric
net_unit         text
confidence       numeric not null
hit_count        integer not null default 0
created_at       timestamptz
last_seen_at     timestamptz
unique (store_chain, raw_line_text)
```

Rules:

- Lookup after the model call; a hit replaces the model's item for that line
  (deterministic normalization), increments `hit_count`, refreshes
  `last_seen_at`.
- Miss write-back only when line confidence ≥ 0.8.
- Global across households; service-role access only; RLS enabled with no
  client policies.

### 4. Client (`scan.tsx` + `receiptService.ts`)

- Receipt camera mode: `takePictureAsync` → compress → upload → create scan
  row → invoke `normalize-receipt` → map response lines into the existing
  `ReceiptConfirmItem` shape → existing confirm flow and
  `receipt_review_items` for low-confidence lines.
- Errors surface in the scan UI with retry; scan row shows `failed`.
- Mock template path retained only when Supabase env config is missing.

### 5. Spec

`PRODUCT_SPEC.md` gains "Receipt Normalization Pipeline" and "Receipt
Normalization Cache" sections (done alongside this design).

## Error handling

- Storage download failure / model error / JSON parse failure → scan
  `failed` with `error_message`, 500 to client, visible retry.
- Duplicate signature → existing duplicate UX (no inventory writes).
- Concurrent scans: scan row status transitions guard double-processing.

## Testing

- Pure cache-merge logic (model lines + cache rows → final lines + writes)
  extracted into a Deno-free module under the function directory; unit tested
  with vitest.
- Client mapping (response → `ReceiptConfirmItem[]`) unit tested in
  `receiptService.test.ts`.
- Manual e2e: scan a real receipt locally → items in confirm UI + cache rows
  present; rescan same receipt → duplicate path; scan similar receipt →
  cache hits override (check `hit_count`).
