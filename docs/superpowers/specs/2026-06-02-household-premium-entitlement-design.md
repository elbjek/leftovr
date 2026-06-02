# Household Premium & Entitlement Model — Design

**Date:** 2026-06-02
**Scope:** Payment tiers, entitlement resolution, share gate, downgrade behavior, and the V1 preview toggle. No real payment integration (V1). Household management RPCs (leave/remove) are explicitly out of scope.

## Background

The schema already supports multi-person households: every domain table (`inventory_items`, `receipt_scans`, `recipe_sessions`, `recipes`, `cooked_events`, notification settings) is scoped by `household_id`, and RLS gates each table by `is_household_member()`. Tier is stored in two places — `profiles.tier` and `households.plan_tier` — both using the `plan_tier` enum (`free`, `premium`, `household_premium`).

What was undefined: which tier field grants a feature, what unlocks sharing, and what happens on downgrade. This document settles those.

## 1. Pricing model

| Tier | Price | Covers | Sharing |
|---|---|---|---|
| Free | — | solo | no |
| Individual Premium | $4.99/mo · $29.99/yr | one user | **no** |
| Household Premium | $7.99/mo · $49.99/yr | **up to 3 members, one payment** | yes |

One payer buys Household Premium; invitees pay nothing and inherit premium while in the household. The payer pays $3/mo more than solo Individual to cover the whole household (up to 3 members).

## 2. Free plan capabilities

**Overrides PRODUCT_SPEC.md lines 420 and 456.** Free no longer gets 3 receipt scans/month, and barcode scanning is no longer free/unlimited.

Free users get:
- **Manual fridge add only** — the sole intake method
- 3 recipe sessions per calendar week
- limited Eat First preview
- day 7 recap preview card

**Onboarding exemption:** the first-fill (session-one) flow gives every new user one free *simulated* scan regardless of tier — scanning in V1 is fully mocked (fake receipt templates / mock barcodes), so this is a guided taste, not a real premium scan. The gate applies only after `households.first_fill_completed_at` is set. This honors the spec's "never show a paywall in session one" rule (PRODUCT_SPEC.md line 492) without weakening the manual-only model afterward.

Free users do **not** get:
- receipt scanning after onboarding (premium-gated)
- barcode scanning after onboarding (premium-gated)
- unlimited recipe sessions
- full Eat First shelf
- optimized recipe filters (time / complexity / servings)
- full insights
- household sharing
- smart daily notification

## 3. Entitlement rule (core)

A user is **premium** if:

```
profiles.tier IN ('premium','household_premium')
  OR
households.plan_tier = 'household_premium'   -- for the user's active_household_id
```

Resolved server-side via a single security-definer helper `public.is_premium()` that reads `auth.uid()`, the caller's `active_household_id`, and the two tier fields. Every premium gate (scan entry points, recipe-session cap, full Eat First, insights, premium filters) calls this one source of truth. The client mirrors the rule for UI state only; the server is authoritative.

## 4. Share gate

- Opening the invite / create-share flow requires the active household's `plan_tier = 'household_premium'`.
- `create_household_invite` gains a check: raise if the active household is not `household_premium`.
- Individual Premium does **not** unlock invites — the user must upgrade to Household Premium first.

This preserves the two-product ladder: Free → Individual (solo perks) → Household (sharing + perks for up to 3).

## 5. Downgrade behavior

When a household's `plan_tier` flips `household_premium → free` (lapsed subscription, or V1 toggle off) while it still has 2–3 members:

- Members stay in the household; the shared fridge and all data are untouched.
- All members now resolve to free via the entitlement rule (§3).
- Free limits count **per household**, which is already correct because `receipt_scans` and `recipe_sessions` are household-scoped.
- Re-subscribing flips the tier back; premium is restored instantly with no data migration.

No member ejection and no read-only grace period — least destructive path.

## 6. V1 preview toggle (no checkout)

Upgrade CTAs set tier fields directly; there is no checkout in V1.

- **Preview Premium** sheet → sets `profiles.tier = 'premium'`.
- **Preview Household Premium** sheet → sets `households.plan_tier = 'household_premium'` on the active household.
- Toggle off → reverts the relevant field to `free`.

The toggle exercises the exact entitlement (§3) and downgrade (§5) paths that real billing will later drive.

## 7. Premium reveal triggers (revised)

Contextual bottom sheet, never in session one. Triggers:

- free user taps receipt scan **or** barcode scan *after onboarding* (replaces the old "exceeds monthly receipt scan limit" trigger; never fires during first-fill)
- free user attempts fourth weekly recipe session
- free user taps full Insights
- free user taps full Eat First
- free user enters household invite / create-share flow

## 8. Implementation surface

Schema is unchanged — the tier fields already exist. New work is small:

1. `public.is_premium()` helper (security definer).
2. A `household_premium` check inside `create_household_invite`.
3. Gate receipt-scan and barcode-scan entry points behind `is_premium()`; route blocked taps to the Premium sheet.
4. Wire the two preview toggles to write `profiles.tier` / `households.plan_tier`.

## 9. Future work (out of scope)

- Real payment / checkout (Stripe or RevenueCat) writing the same tier fields.
- Leave-household and remove-member RPCs, plus a return-to-personal-fridge flow. Today `accept_household_invite` archives the joiner's old household, leaving no path back and no clean owner-eject.
- Proration when a user upgrades Individual → Household.
