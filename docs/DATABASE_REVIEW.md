# Chomp — Database Review (Performance & Security)

> Scope: Postgres schema, indexes, RLS policy performance, functions, client query patterns.
> Source: `supabase db advisors --local` (17 findings) + manual migration/query audit.
> Snapshot: branch `feat/add-items`, 2026-06-11. Access-control vulnerabilities live in
> [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) (S1–S13); this file is the DB-layer view and does not repeat them.

---

## 🔴 High impact — RLS performance

### D1. `auth.uid()` re-evaluated per row in 14 policies (advisor: `auth_rls_initplan`, 14× WARN)
Every policy that calls `auth.uid()` bare runs it for **every row scanned**. Supabase's linter flagged all 14:

`profiles_select_household_members`, `profiles_update_self`, `households_insert_self`,
`household_invites_insert_member`, `receipt_scans_all_member`, `recipes_all_member`,
`recipe_sessions_all_member`, `cooked_events_all_member`,
`notification_preferences_{select,insert,update}_self`,
`recipe_favorites_{select,insert,delete}_self`.

**Fix:** wrap in a scalar subquery so it's evaluated once per statement (initplan):

```sql
-- before
using (user_id = auth.uid())
-- after
using (user_id = (select auth.uid()))
```

5–100× faster on large tables. One mechanical migration touching all 14 policies.

### D2. `is_household_member()` called per row in every household policy
Same class of problem the linter can't see: `using (public.is_household_member(household_id))` executes the SECURITY DEFINER function (its own `household_members` lookup) **per row**. On a fridge query returning 200 lots, that's 200 subqueries.

**Fix:** wrap the call — `using ((select public.is_household_member(household_id)))` — and inside the function use `(select auth.uid())` too. For hot single-household tables an even faster form is:

```sql
using (
  household_id in (
    select hm.household_id from public.household_members hm
    where hm.user_id = (select auth.uid()) and hm.status = 'active'
  )
)
```

which the planner can hash once per statement.

### D3. `profiles_select_household_members` does a per-row self-join
The policy embeds `household_members self JOIN household_members other` correlated per profile row. Combined with D1 this is the most expensive policy in the schema, and it runs on every `profiles!added_by(display_name)` join in `listActiveHouseholdInventory`.

**Fix:** rewrite via the membership subquery pattern (one hashed set per statement):

```sql
using (
  id = (select auth.uid())
  or id in (
    select other.user_id
    from public.household_members other
    where other.status = 'active'
      and other.household_id in (
        select self.household_id from public.household_members self
        where self.user_id = (select auth.uid()) and self.status = 'active'
      )
  )
)
```

---

## 🟠 Missing indexes (FKs & query paths)

Postgres does **not** auto-index FK columns. Unindexed FKs make joins, RLS subqueries, and `ON DELETE CASCADE` slow (cascade does a full scan of the child table per parent delete).

### D4. Hot-path query has no matching index
`depleteItemQuantity` filters `household_id + normalized_name + removed_at is null` (`src/repositories/inventoryRepository.ts:205`) — runs on **every cooked event, per ingredient**. The existing `inventory_items_household_active_idx (household_id, removed_at, category)` doesn't cover `normalized_name`.

```sql
create index inventory_items_household_norm_active_idx
  on public.inventory_items (household_id, normalized_name)
  where removed_at is null;
```

### D5. Unindexed foreign keys
| Column | Why it matters |
|---|---|
| `inventory_items.added_by` | joined to `profiles` on every fridge load (`profiles!added_by`) |
| `inventory_items.source_scan_id` | cascade-set-null on receipt_scans delete |
| `recipes.session_id` | session→recipes lookups + cascade delete |
| `recipes.generated_by` | "my recipes" filter happens client-side today, server-side tomorrow |
| `cooked_events.recipe_id` | every cooked-count query filters/joins on it |
| `cooked_events.cooked_by` | per-user cooked history (`listCookedRecipes(cookedBy)`) |
| `receipt_review_items.scan_id` | scan→review items lookup + cascade |
| `profiles.active_household_id` | read in `is_premium()` — on **every gated insert** |
| `household_invites.household_id` | member invite listing (only `code` is indexed) |

One migration, nine `create index` statements. Skip any that stay unused (check `pg_stat_user_indexes` later), but `added_by`, `recipe_id`, `active_household_id`, and D4 are immediately hot.

---

## 🟠 Function security/stability (advisor: `function_search_path_mutable`, 3× WARN)

### D6. `set_updated_at`, `make_avatar_initials`, `generate_invite_code` have mutable search_path
Unlike the SECURITY DEFINER helpers (which correctly pin `search_path = public`), these three resolve objects via the caller's search_path. `generate_invite_code` is the riskiest: it references `public.household_invites` and `extensions.gen_random_bytes` and is called from a SECURITY DEFINER function.

**Fix:**
```sql
alter function public.set_updated_at() set search_path = '';
alter function public.make_avatar_initials(text) set search_path = '';
alter function public.generate_invite_code() set search_path = '';
```
(qualify all object references inside them — they already are, except `gen_random_bytes` which is schema-qualified ✓).

---

## 🟡 Schema design

### D7. Derived data stored, never maintained
- **`urgency`** — written once at insert, never updated; the client already recomputes it (and prefers the stale stored copy — bug #1 in CODE_REVIEW.md). Either drop the column or maintain it server-side. A column that's sometimes-truth is worse than no column.
- **`display_quantity`** — client-computed string (`"2 item"`), re-derived in three client code paths, drifts from `quantity`/`unit` whenever a writer forgets. Make it a generated column or compute at render. Storing presentation strings in the DB also bakes English into data (`shelf_life_range` has the same problem: `"5-10 days"` text in a column).
- **`recipes.is_favorite`** — superseded by `recipe_favorites` (migration `20260610130000` says so) but the column still exists and is still written `false` on insert. Drop it.

### D8. `recipe_sessions.fridge_snapshot` stores the full inventory JSON per generation
Whole `InventoryLot[]` (all columns, all lots) per session. Unbounded growth: ~3 sessions/week × N lots × every household, and the client never reads it back. Also duplicates household data outside `inventory_items`' lifecycle (a removed/renamed item lives on in snapshots — relevant for GDPR delete requests).

**Fix:** store a trimmed shape (`normalized_name`, `quantity`, `urgency`) or just the item ids; add a retention job if sessions are kept long-term.

### D9. `receipt_scans.receipt_signature` duplicate-check index is fine — but the check is racy
`findRecentReceiptDuplicate` then insert (`receiptRepository.ts:99-120`) is check-then-act across two statements; two devices scanning the same receipt concurrently both pass. Index `receipt_scans_signature_idx` exists but is non-unique.

**Fix:** rely on a partial unique index for true idempotency, e.g. `unique (household_id, receipt_signature)` where `status = 'completed' and created_at > ...` isn't expressible — simpler: unique on `(household_id, receipt_signature)` partial `where receipt_signature is not null and duplicate_of is null`, and treat the conflict as the duplicate signal.

---

## 🟡 Client query patterns hitting the DB harder than needed

(Cross-referenced from CODE_REVIEW.md, listed here because the fix is partly DB-side.)

- **D10. `cooked_events` read 3× per recipes-screen load** (`listHouseholdRecipes`→`withCookedCounts`, `listCookedRecipes`, `listCookedEventRows`). One query can feed all three consumers; or create a view `recipe_cooked_stats (recipe_id, cooked_count, cooks uuid[])` — remember `security_invoker = true` on the view.
- **D11. `removeInventoryGroup` issues N updates** — `update ... where id in (...)` is one statement (`inventoryRepository.ts:143`).
- **D12. Read-then-write pairs** — `updateInventoryQuantity` and `updateInventoryNetAmount` each do a SELECT then UPDATE (2 round-trips) only to recompute `display_quantity`; goes away entirely with D7 (generated column or render-time formatting).
- **D13. `depleteItemQuantity` applies ops in a sequential await loop** — N round-trips per cook, and the whole cook flow (deplete × ingredients + `cooked_events` insert) is non-transactional: a mid-flight failure leaves inventory half-depleted with no cooked event. Wrap the cook in a single RPC (`security invoker` plpgsql function) — one round trip, atomic, and the lot-locking comment in the code becomes real (`select ... for update`).

---

## 🟢 Low / hygiene

- **D14. `grant all on all tables in schema public to authenticated`** includes TRUNCATE/REFERENCES — RLS does not govern TRUNCATE (SECURITY_REVIEW S6). Tighten to `select, insert, update, delete` + matching `alter default privileges`.
- **D15. No `delete` granted use-case for several tables but DELETE allowed by `for all` policies** — deleting inventory is done via soft-delete (`removed_at`), yet hard DELETE is permitted to any member. Either revoke DELETE on `inventory_items` or add a delete policy stricter than membership; soft-delete-only tables shouldn't accept hard deletes from clients.
- **D16. `household_invites.expires_at` rows never expire in storage** — status stays `active` past `expires_at` (filtered at read time only). Harmless functionally; add a cleanup (pg_cron) or partial index `where status = 'active' and expires_at > now()` is not possible (non-immutable) — so just cron-expire rows so the unique `code` space and `household_invites_code_idx` stay small.
- **D17. `quantity numeric(10,2) check (quantity > 0)`** but `planDepletion` emits `setQuantity` only for `nextQ > 0` ✓ and `updateInventoryQuantity` guards `<= 0` ✓ — constraint and code agree today; keep the check (good), just noting it's load-bearing.

---

## ✅ Already right

- RLS enabled on all 13 tables; membership checks centralized in helper functions.
- SECURITY DEFINER helpers pin `search_path` (the 3 flagged functions are the non-definer stragglers).
- Sensible composite/partial indexes where they were thought about: `household_members (user_id, status)`, `(household_id, status)`, partial `household_invites_code_idx`, `receipt_scans_signature_idx`, `(household_id, created_at desc)` listing indexes.
- `getWeeklySessionCount` uses `head: true` count — no row transfer.
- Single shared Supabase client (no per-call client churn); enums instead of free text for states; `numeric` for quantity (not float); `timestamptz` everywhere; `updated_at` triggers consistent.

---

## Status (2026-06-11)

| Finding | Status |
|---|---|
| D1, D2, D3, D6 | ✅ Fixed — `20260611100815_rls_perf_and_search_path.sql`; advisors 17 → 0; RLS smoke test passed |
| D4, D5 | ✅ Fixed — `20260611100816_fk_and_hotpath_indexes.sql` (11 indexes) |
| D7 | ✅ Fixed — `recipes.is_favorite` (`20260611101241`), `display_quantity` (`20260611101932`), and `urgency` + `urgency_band` enum (`20260611181942`) all dropped. Urgency is computed on read (`resolveUrgency`); the depletion sort now resolves urgency live instead of reading the dropped column. |
| D8 | ✅ Fixed — sessions store trimmed `FridgeSnapshotItem[]` (client) |
| D9 | ✅ Fixed — partial unique signature index + 23505 backstop in `processMockReceiptScan` |
| D10 | ✅ Fixed — one `listCookedEventRows` query feeds counts, summaries, and the cooked tab; `listCookedRecipes`/`withCookedCounts` deleted |
| D11 | ✅ Fixed — `removeInventoryGroup` is one `.in()` update |
| D12 | ✅ Fixed — `display_quantity` dropped; read-then-write pairs in `updateInventoryQuantity`/`updateInventoryNetAmount` gone |
| D13 | ✅ Fixed — `apply_cook` RPC (`20260611101932`): SECURITY INVOKER, applies client-planned depletion ops + cooked event in one transaction; smoke-tested incl. cross-household RLS block |
| D14, D15 | ✅ Fixed — DML-only grants; DELETE revoked on `inventory_items` (smoke-tested) |
| D16 | ✅ Fixed — pg_cron job `expire-household-invites` (03:17 daily) |
| D17 | ✅ No action needed |

## Suggested migration order

1. **One mechanical migration:** D1 + D2 + D3 (wrap auth calls, rewrite profiles policy) + D6 (pin search_path). Pure perf/hardening, zero behavior change — verify with `supabase db advisors --local` going to 0 warnings.
2. **Index migration:** D4 + D5 (hot four first: `inventory_items(household_id, normalized_name)`, `added_by`, `cooked_events.recipe_id`, `profiles.active_household_id`).
3. **Cook-flow RPC:** D13 (atomicity) — pairs naturally with CODE_REVIEW #10/#11 client cleanup (D10/D11).
4. **Schema cleanup:** D7 (drop `is_favorite`, decide `urgency`/`display_quantity`), D8 snapshot trim, D9 unique signature — coordinate with the urgency fix in CODE_REVIEW #1.
