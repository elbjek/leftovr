# Household Premium & Entitlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make premium entitlement honor the "one payer covers the household" model — a member is premium if their own profile is premium OR their active household is `household_premium` — and gate sharing + all scanning behind premium.

**Architecture:** A single pure helper module (`src/features/auth/entitlement.ts`) becomes the one source of truth for "is this user premium" and "can this household invite members". Client screens stop hand-rolling `profile?.tier !== "free"` and call the helper with both `profile` and `activeHousehold`. A DB migration adds a server-side `public.is_premium()` mirror and enforces the share gate inside `create_household_invite`. The V1 preview toggle already writes the tier fields; one small fix keeps the household tier accurate.

**Tech Stack:** Expo / React Native, TypeScript, Supabase (Postgres + RLS), vitest, react-i18next.

**Spec:** `docs/superpowers/specs/2026-06-02-household-premium-entitlement-design.md`

> **Commit policy (user override):** Do **not** create git commits. End each task by **staging** the task's files with `git add`. The user commits manually.

---

## File Structure

- **Create** `src/features/auth/entitlement.ts` — pure functions `isPremium()` and `canShareHousehold()`. One responsibility: tier → entitlement.
- **Create** `src/features/auth/entitlement.test.ts` — vitest unit tests for the helper (covers inheritance + downgrade).
- **Create** `supabase/migrations/20260602130000_premium_entitlement.sql` — `public.is_premium()` + share-gate check in `create_household_invite`.
- **Modify** `src/features/auth/index.ts` — re-export the entitlement helper.
- **Modify** `src/repositories/profileRepository.ts` — `setPreviewTier` writes household `plan_tier` accurately (`household_premium` or `free`, never `premium`).
- **Modify** `src/app/(tabs)/insights.tsx`, `src/app/(tabs)/recipes.tsx`, `src/app/(tabs)/fridge.tsx` — use central `isPremium(profile, activeHousehold)`.
- **Modify** `src/app/(tabs)/settings.tsx` — share gate uses `canShareHousehold(activeHousehold)` instead of `profile.tier === "household_premium"`.
- **Modify** `src/app/(tabs)/scan.tsx` — gate receipt + barcode entry behind premium (free → Premium sheet); remove the now-dead free monthly receipt-limit UI.
- **Modify** `src/repositories/receiptRepository.ts` — drop the monthly-limit throw so premium scanning is unlimited.

---

### Task 1: Entitlement helper (pure, TDD)

**Files:**
- Create: `src/features/auth/entitlement.ts`
- Test: `src/features/auth/entitlement.test.ts`
- Modify: `src/features/auth/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/entitlement.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { canShareHousehold, isPremium } from "./entitlement";

const profile = (tier: "free" | "premium" | "household_premium") => ({ tier });
const household = (plan_tier: "free" | "premium" | "household_premium") => ({ plan_tier });

describe("isPremium", () => {
  it("is false when profile free and household free", () => {
    expect(isPremium(profile("free"), household("free"))).toBe(false);
  });

  it("is true when own profile is individual premium", () => {
    expect(isPremium(profile("premium"), household("free"))).toBe(true);
  });

  it("is true when own profile is household_premium", () => {
    expect(isPremium(profile("household_premium"), household("free"))).toBe(true);
  });

  it("is true for a free member of a household_premium household (inherited)", () => {
    expect(isPremium(profile("free"), household("household_premium"))).toBe(true);
  });

  it("is false when household is only 'premium' (not a sharing tier)", () => {
    expect(isPremium(profile("free"), household("premium"))).toBe(false);
  });

  it("is false for nulls", () => {
    expect(isPremium(null, null)).toBe(false);
  });

  it("downgrade: reverts to free when household drops household_premium -> free", () => {
    // Before: inherited premium. After: both free.
    expect(isPremium(profile("free"), household("household_premium"))).toBe(true);
    expect(isPremium(profile("free"), household("free"))).toBe(false);
  });
});

describe("canShareHousehold", () => {
  it("is true only for household_premium", () => {
    expect(canShareHousehold(household("household_premium"))).toBe(true);
  });

  it("is false for individual premium", () => {
    expect(canShareHousehold(household("premium"))).toBe(false);
  });

  it("is false for free and null", () => {
    expect(canShareHousehold(household("free"))).toBe(false);
    expect(canShareHousehold(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/auth/entitlement.test.ts`
Expected: FAIL — cannot resolve `./entitlement` / `isPremium is not a function`.

- [ ] **Step 3: Write the implementation**

Create `src/features/auth/entitlement.ts`:

```ts
import { Household, Profile } from "./types";

/**
 * A user is premium if their own profile is premium/household_premium,
 * OR their active household is household_premium (one payer covers members).
 */
export function isPremium(
  profile: Pick<Profile, "tier"> | null,
  household: Pick<Household, "plan_tier"> | null,
): boolean {
  if (profile && (profile.tier === "premium" || profile.tier === "household_premium")) {
    return true;
  }
  return household?.plan_tier === "household_premium";
}

/** Only Household Premium unlocks inviting members. */
export function canShareHousehold(
  household: Pick<Household, "plan_tier"> | null,
): boolean {
  return household?.plan_tier === "household_premium";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/auth/entitlement.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Re-export from the auth barrel**

In `src/features/auth/index.ts`, add the export line so the rest of the app imports from `@/features`:

```ts
export * from "./AuthProvider";
export * from "./types";
export * from "./entitlement";
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Stage (no commit)**

```bash
git add src/features/auth/entitlement.ts src/features/auth/entitlement.test.ts src/features/auth/index.ts
```

---

### Task 2: DB migration — `is_premium()` + share gate

**Files:**
- Create: `supabase/migrations/20260602130000_premium_entitlement.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602130000_premium_entitlement.sql`:

```sql
set check_function_bodies = off;

-- Server-side mirror of the client entitlement rule (design §3):
-- premium if own profile is premium/household_premium, OR active household is household_premium.
create or replace function public.is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.tier in ('premium', 'household_premium')
        or exists (
          select 1
          from public.households h
          where h.id = p.active_household_id
            and h.plan_tier = 'household_premium'
        )
      )
  );
$$;

grant execute on function public.is_premium() to authenticated;

-- Share gate (design §4): inviting members requires Household Premium on the target household.
create or replace function public.create_household_invite(target_household_id uuid)
returns public.household_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.household_invites;
begin
  if not public.is_household_member(target_household_id) then
    raise exception 'Not a member of this household';
  end if;

  if not exists (
    select 1
    from public.households h
    where h.id = target_household_id
      and h.plan_tier = 'household_premium'
  ) then
    raise exception 'Household Premium required to invite members';
  end if;

  insert into public.household_invites (household_id, code, created_by)
  values (target_household_id, public.generate_invite_code(), auth.uid())
  returning * into invite;

  return invite;
end;
$$;
```

- [ ] **Step 2: Apply the migration to the local DB**

Run: `npm run supabase:reset`
Expected: reset completes without SQL errors; the new migration file is listed in the applied set.

- [ ] **Step 3: Verify the functions exist and the gate works**

Run (psql against the local DB — host/port/password from `npm run supabase:status`; default local password is `postgres`):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select proname from pg_proc where proname in ('is_premium','create_household_invite');"
```

Expected: both `is_premium` and `create_household_invite` are listed.

Then confirm the gate raises for a free household:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "do \$\$ begin perform public.create_household_invite('00000000-0000-0000-0000-000000000000'); exception when others then raise notice 'raised: %', sqlerrm; end \$\$;"
```

Expected: a `raised: ...` notice (either "Not a member of this household" or, for a real member of a free household, "Household Premium required to invite members"). No invite row is created for a free household.

- [ ] **Step 4: Stage (no commit)**

```bash
git add supabase/migrations/20260602130000_premium_entitlement.sql
```

---

### Task 3: Make `setPreviewTier` write an accurate household tier

The current code writes `households.plan_tier = 'premium'` when previewing Individual Premium, which is not a real household tier and muddies the share gate. Individual preview must leave the household non-shareable.

**Files:**
- Modify: `src/repositories/profileRepository.ts:143-151`

- [ ] **Step 1: Update the household tier mapping**

In `src/repositories/profileRepository.ts`, replace the household-update block inside `setPreviewTier`:

```ts
  if (profile.active_household_id) {
    const householdTier = tier === "household_premium" ? "household_premium" : "free";
    const { error: householdError } = await supabase
      .from("households")
      .update({ plan_tier: householdTier })
      .eq("id", profile.active_household_id);

    if (householdError) throw householdError;
  }
```

(Only the `householdTier` line changes: `tier === "household_premium" ? "household_premium" : tier` → `... : "free"`.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Reasoning check (no app run required): previewing `premium` now sets `profile.tier='premium'` (individual perks via `isPremium`) and `households.plan_tier='free'` (so `canShareHousehold` stays false). Previewing `household_premium` sets both to `household_premium`. Toggling `free` sets both free. This matches design §5/§6.

- [ ] **Step 4: Stage (no commit)**

```bash
git add src/repositories/profileRepository.ts
```

---

### Task 4: Wire central `isPremium` into insights / recipes / fridge

These screens currently use `profile?.tier !== "free"`, which ignores inherited household premium. Route them through the helper.

**Files:**
- Modify: `src/app/(tabs)/insights.tsx:16`
- Modify: `src/app/(tabs)/recipes.tsx:30`
- Modify: `src/app/(tabs)/fridge.tsx:67`

- [ ] **Step 1: insights.tsx**

In `src/app/(tabs)/insights.tsx`, add the import (alias to avoid colliding with the local `isPremium` variable):

```ts
import { isPremium as resolvePremium, useAuth } from "@/features";
```

(If `useAuth` is already imported from `@/features`, just add `isPremium as resolvePremium` to that existing import.)

Then replace line 16:

```ts
  const isPremium = resolvePremium(profile, activeHousehold);
```

- [ ] **Step 2: recipes.tsx**

In `src/app/(tabs)/recipes.tsx`, add `isPremium as resolvePremium` to the existing `@/features` import, then replace line 30:

```ts
  const isPremium = resolvePremium(profile, activeHousehold);
```

- [ ] **Step 3: fridge.tsx**

In `src/app/(tabs)/fridge.tsx`, add `isPremium as resolvePremium` to the existing `@/features` import, then replace line 67:

```ts
  const isPremium = resolvePremium(profile, activeHousehold);
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (`profile` and `activeHousehold` are already destructured from `useAuth()` in all three files.)

- [ ] **Step 5: Stage (no commit)**

```bash
git add src/app/\(tabs\)/insights.tsx src/app/\(tabs\)/recipes.tsx src/app/\(tabs\)/fridge.tsx
```

---

### Task 5: Share gate in settings uses household tier

**Files:**
- Modify: `src/app/(tabs)/settings.tsx:79`

- [ ] **Step 1: Import the helper**

In `src/app/(tabs)/settings.tsx`, add `canShareHousehold` to the existing `@/features` import (the file already imports `useAuth` from `@/features`):

```ts
import { canShareHousehold, useAuth } from "@/features";
```

- [ ] **Step 2: Replace the entitlement derivation**

Replace line 79:

```ts
  const isHouseholdPremium = canShareHousehold(activeHousehold);
```

This keeps the existing `isPremium={isHouseholdPremium}` prop passed to `HouseholdSection` (line 343), so the create-invite button stays gated and free taps still route to `onPremiumGate` → the household Premium sheet.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Stage (no commit)**

```bash
git add src/app/\(tabs\)/settings.tsx
```

---

### Task 6: Gate scan entry (receipt + barcode) behind premium

Free users get manual add only (design §2). Tapping receipt or barcode while not premium opens the Premium sheet instead of the camera.

**Files:**
- Modify: `src/app/(tabs)/scan.tsx`

- [ ] **Step 1: Import the helper and read profile**

In `src/app/(tabs)/scan.tsx`, update the `@/features` import:

```ts
import { isPremium as resolvePremium, useAuth } from "@/features";
```

Replace the `useAuth()` destructure (line 47):

```ts
  const { profile, activeHousehold, refresh } = useAuth();
```

Add a derived flag just below the existing `useState` declarations (e.g. after line 62):

```ts
  const canScan = resolvePremium(profile, activeHousehold);
```

- [ ] **Step 2: Block receipt/barcode for free users in `openSelectedChoice`**

In `openSelectedChoice` (starts line 97), immediately after `setError(null);` and before the `if (nextChoice === "manual")` block, add:

```ts
    if ((nextChoice === "receipt" || nextChoice === "barcode") && !canScan) {
      setChoice(nextChoice);
      setScanPremiumVisible(true);
      return;
    }
```

(Add `canScan` to the `useCallback` dependency array on line 120: `[canScan, choice, permission?.granted, requestPermission, t]`.)

- [ ] **Step 3: Render the Premium sheet on the choice screen**

The Premium sheet currently only renders inside the `limit` mode (removed in Task 7). Add it to the main choice screen return. Just before the final closing `</Screen>` of the default return (after the `Button title={t("scan.startReceipt")}` block, around line 718), add:

```tsx
      <PremiumSheet
        visible={scanPremiumVisible}
        onPreview={async () => {
          await setPreviewTier("premium");
          await refresh();
          setScanPremiumVisible(false);
          void openSelectedChoice(choice);
        }}
        onDismiss={() => setScanPremiumVisible(false)}
      />
```

Add `setPreviewTier` to the `@/repositories` import block at the top of the file (lines 11-20):

```ts
  setNotificationPermissionPreview,
  setPreviewTier,
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification (app)**

Run the app (`npm run start`), set tier to **free** via Settings → Prototype controls, open the Scan tab:
- Tap **Receipt** or **Barcode** → Premium sheet appears (no camera).
- Tap **Preview Premium** → sheet closes, the chosen scanner opens.
- Tap **Manual** as a free user → manual add opens directly, no sheet.

- [ ] **Step 6: Stage (no commit)**

```bash
git add src/app/\(tabs\)/scan.tsx
```

---

### Task 7: Remove the dead free monthly receipt-limit path

With free users blocked from scanning entirely and premium scanning unlimited (design §2), the 3-per-month receipt limit is obsolete and would wrongly cap premium users. Remove its UI and its enforcement.

**Files:**
- Modify: `src/app/(tabs)/scan.tsx`
- Modify: `src/repositories/receiptRepository.ts:97-101`

- [ ] **Step 1: Remove the limit enforcement in the repository**

In `src/repositories/receiptRepository.ts`, delete the guard inside `processMockReceiptScan` (lines 97-101):

```ts
  const limit = await getReceiptScanLimitStatus(input.householdId);

  if (limit.remaining <= 0) {
    throw new Error("Receipt limit reached for this month.");
  }
```

Keep everything else. `getReceiptScanLimitStatus` is still called later in the same function to build the returned `limit` payload, so it remains used — do not delete it.

- [ ] **Step 2: Remove the limit pre-check in `captureReceipt`**

In `src/app/(tabs)/scan.tsx`, inside `captureReceipt` (lines 154-159), delete:

```ts
      const limit = await getReceiptScanLimitStatus(activeHousehold.id);

      if (limit.remaining <= 0) {
        setMode("limit");
        return;
      }
```

- [ ] **Step 3: Remove the limit-status banner on the choice screen**

In `src/app/(tabs)/scan.tsx`:
- Delete the `limitCopy` state declaration (line 55): `const [limitCopy, setLimitCopy] = useState("");`
- Delete the `useEffect` that fetches the limit (lines 82-95, the block calling `getReceiptScanLimitStatus(activeHousehold.id).then(...)`).
- Delete the `limitCopy` JSX in the choice header (lines 680-684):

```tsx
        {limitCopy ? (
          <Text variant="small" muted>
            {limitCopy}
          </Text>
        ) : null}
```

- [ ] **Step 4: Remove the `limit` mode block and type member**

In `src/app/(tabs)/scan.tsx`:
- Delete the entire `if (mode === "limit") { ... }` block (lines 580-605). This is the block that also held the old `PremiumSheet` — its replacement was added in Task 6 Step 3.
- Remove `"limit"` from the `ScanMode` union type (line 38).
- Remove `getReceiptScanLimitStatus` from the `@/repositories` import block (line 15), since it's no longer referenced in this file.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors, and no "unused variable" / "cannot find name `limitCopy`/`getReceiptScanLimitStatus`" errors.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: PASS, including `src/features/auth/entitlement.test.ts`.

- [ ] **Step 7: Manual verification (app)**

As a **premium** user, scan the same receipt template more than 3 times in a month → every scan succeeds (no "Receipt limit reached" screen).

- [ ] **Step 8: Stage (no commit)**

```bash
git add src/app/\(tabs\)/scan.tsx src/repositories/receiptRepository.ts
```

---

## Self-Review

**Spec coverage:**
- §1 pricing — PremiumSheet already renders $4.99/$7.99 etc.; no change needed.
- §2 free = manual only — Tasks 6 (gate receipt+barcode) and 7 (remove free scan limit). ✓
- §3 entitlement rule — Task 1 (`isPremium`) + Task 4 (wire screens) + Task 2 (`is_premium()` server mirror). ✓
- §4 share gate — Task 2 (server `create_household_invite` check) + Task 5 (client `canShareHousehold`). ✓
- §5 downgrade — automatic via Task 1 helper reading live `household.plan_tier`; covered by the downgrade test case. ✓
- §6 preview toggle — already implemented; Task 3 corrects the household tier mapping. ✓
- §7 premium reveal triggers — receipt/barcode trigger added in Task 6; existing recipe-session and insights/eat-first triggers unchanged. ✓
- §8 implementation surface — matches Tasks 1, 2, 6. ✓
- §9 future work (real payments, leave/remove RPCs, proration) — intentionally excluded. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full content.

**Type consistency:** `isPremium(profile, household)` and `canShareHousehold(household)` signatures are identical across Tasks 1, 4, 5, 6. Import alias `resolvePremium` used consistently in screens to avoid shadowing local `isPremium`/`canScan` variables.
