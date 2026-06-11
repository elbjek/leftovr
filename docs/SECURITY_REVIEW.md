# Chomp — Security Review

> Scope: RLS policies + migrations, auth flow (OTP/PKCE), API key handling, entitlement
> enforcement, edge functions, client storage, third-party calls.
> Snapshot: branch `feat/add-items`, 2026-06-11.
> Context: app is a prototype — some findings are intentional prototype shortcuts, but they
> are listed because each one is a launch blocker if it survives into production.

---

## 🔴 Critical

### S1. Any user can grant themselves Premium (privilege escalation)
`profiles_update_self` (`supabase/migrations/20260529124500:599`) has no column restrictions — a user can `UPDATE profiles SET tier = 'household_premium'` on their own row. Same for `households_update_member` (`:615`): **any member** can set `plan_tier = 'household_premium'` on the household. The server-side gate `is_premium()` (`20260602130000`) reads exactly these two columns, so every server-side premium enforcement — receipt-scan RLS gate, barcode RLS gate, invite gate — is bypassable with a single self-update. The client's `setPreviewTier` (`src/repositories/profileRepository.ts:137`) is intentionally built on this hole.

**Fix (pre-launch blocker):**
- Revoke column-level UPDATE: `revoke update on table public.profiles from authenticated; grant update (display_name, language, default_servings, ...) on public.profiles to authenticated;` — everything except `tier`. Same treatment for `households.plan_tier`.
- Tier changes go only through a service-role path (payment webhook — RevenueCat/Stripe → edge function with service key).
- Delete `setPreviewTier` or gate it behind `__DEV__`.

### S2. Joining a household can move other members' inventory
`accept_household_invite(code, move_existing_items := true)` (`20260529124500:471`) moves **all** active `inventory_items` of the user's current household into the new one — not just items the user added. A member of household A can accept an invite to household B and drain A's entire shared fridge into B. SECURITY DEFINER, so RLS doesn't stop it.

**Fix:** scope the move to `added_by = auth.uid()`, or only allow the move when the user is the household's sole active member.

---

## 🟠 High

### S3. Invite codes are brute-forceable (24-bit entropy + open lookup RPC)
`generate_invite_code()` produces `CHOMP-` + 6 hex chars = 16.7M combinations (`20260529124500:358`). `lookup_household_invite` is a SECURITY DEFINER RPC executable by **any authenticated user** with no rate limiting, returning household id, name, and member count for valid codes. An attacker with one account can enumerate codes, then `accept_household_invite` into a stranger's household — full read/write on their inventory, recipes, profiles (display names, avoidances).

**Fix:** ≥ 64 bits of entropy (e.g. 13+ base32 chars), per-user attempt throttling (counter table or pg_net edge throttle), and consider single-use codes by default (`max_uses` default is 2).

### S4. Intra-household authorization is all-or-nothing
The `for all using (is_household_member(...))` pattern means any member can:
- **DELETE** any household row: other members' recipes, cooked events, receipt scans, entire inventory (`recipes_all_member`, `cooked_events_all_member`, `receipt_scans_all_member`, `inventory_items_all_member`).
- **Hijack recipe ownership:** UPDATE on another member's recipe passes `USING` (member) and passes `WITH CHECK (generated_by = auth.uid())` if the attacker overwrites `generated_by` with their own id.
- **Rename, archive, or mark first-fill on the household** via `households_update_member` (status/archival should be owner-only).

A trusted-household model is a legitimate design choice for fridge items — but recipe ownership rewriting and member-level household archival are not.

**Fix:** split policies: deletes of `recipes`/`receipt_scans`/`cooked_events` require `generated_by/created_by/cooked_by = auth.uid()` or owner role; forbid changing `generated_by` (trigger or separate UPDATE with check pinning it to `old.generated_by`); restrict `households.status` changes to owner.

### S5. Auth tokens stored in plaintext AsyncStorage
`src/lib/supabase.ts:20` — session (refresh + access JWT) persists in unencrypted AsyncStorage. Readable on rooted/jailbroken devices and in some backup extractions. Refresh tokens are long-lived credentials.

**Fix:** use `expo-secure-store`-backed storage adapter (Supabase docs ship an `aes-js` + SecureStore "large secret" adapter for RN). One-file change.

---

## 🟡 Medium

### S6. `GRANT ALL ON ALL TABLES TO authenticated` is too broad
`20260529124500:707`. `ALL` includes `TRUNCATE` and `REFERENCES` — and **RLS does not apply to TRUNCATE**. PostgREST doesn't expose TRUNCATE today, so it's not directly reachable, but the grant is a standing footgun for any future SQL surface (RPC, pooled connections).

**Fix:** `grant select, insert, update, delete on all tables in schema public to authenticated;` and set matching default privileges.

### S7. Edge function stubs answer without doing anything auth-aware
`supabase/functions/generate-recipes`, `daily-suggestion`, `normalize-receipt` are mock stubs. Verify `verify_jwt` is ON for each before they gain real logic — `generate-recipes` will eventually hold an Anthropic key and echo back whatever inventory payload it receives. Today it reflects unvalidated request JSON back to the caller (harmless now, a template for SSRF/prompt-injection sloppiness later).

**Fix:** keep `verify_jwt = true`, validate body shape, never echo raw input, read inventory server-side from the DB (RLS-scoped) instead of trusting the client-supplied fridge snapshot.

### S8. Free receipt-scan limit fetched but never enforced
`processMockReceiptScan` calls `getReceiptScanLimitStatus(...)` and ignores the result (`src/repositories/receiptRepository.ts:97` — unused variable). The only real gate is the RLS restrictive policy, which rests on `is_premium()` — bypassable per S1. Net effect in production: unlimited free scans.

**Fix:** enforce the limit in the restrictive RLS policy itself (count scans this week server-side), not in client code.

### S9. Auth errors logged raw in production builds
`console.error("[auth] ...", error)` (`src/features/auth/AuthProvider.tsx:123,168,183`) — Supabase auth errors can embed emails and request details; RN release builds still emit console output to device logs (readable by other processes on older Android).

**Fix:** wrap in `if (__DEV__)` or a logger that strips in release.

### S10. No production auth rate-limit / OTP hardening configured
`supabase/config.toml` carries only local-dev auth settings (`enable_confirmations = true` ✓). Nothing in repo documents production OTP expiry, OTP length, or rate limits; email OTP endpoints are the app's only auth and are abusable for email-bombing without limits.

**Fix:** before launch, set in dashboard (and document): OTP expiry ≤ 10 min, rate limits on `/otp` + `/verify`, leaked-password protection for the password path (`signUpWithEmail` exists too).

---

## 🟢 Low / informational

- **S11. Avoidances are sensitive data shared household-wide.** `profiles.avoidances` (visible to all co-members via `profiles_select_household_members`) can encode health/religious info (halal, allergies). Working as designed for combined-avoidance cooking — but call it out in the privacy policy and onboarding consent. GDPR special-category adjacent.
- **S12. Food search text goes to OpenFoodFacts.** `searchOpenFoodFactsProducts` and barcode lookups send user-typed strings/barcodes to a third party over HTTPS (`src/services/barcodeService.ts`). No PII, but disclose in privacy policy. The hardcoded UA contact `local-dev@chomp.app` should become a real contact before release (OFF API policy).
- **S13. `handle_new_user` trusts `raw_user_meta_data.display_name`.** Display-only use — fine (never used for authorization ✓). It lands in the household name (`X's fridge`) — sanitized only by trim; harmless as text, just don't ever render it as HTML in a future web client.

---

## ✅ What's already right

- No `service_role` key anywhere in the repo; client uses anon key only; `.env` / `.env.local` are gitignored.
- Only `EXPO_PUBLIC_*` vars exposed, and they're the two that are meant to be public.
- PKCE flow enabled on the client (`flowType: "pkce"`), `detectSessionInUrl` off (correct for RN).
- RLS enabled on **every** table; no table left open.
- SECURITY DEFINER functions all pin `search_path = public` (prevents search-path hijack).
- `recipe_favorites` policies are exactly right (self-scoped select/insert/delete + membership check on insert).
- `household_members` has no INSERT policy — joining is only possible through the invite RPC. Correct.
- Premium gates exist **server-side** (restrictive RLS policies), not just in client code — right architecture, just undermined by S1.
- Email confirmations on; no secrets in `seed.sql`.

---

## Status (2026-06-11)

| Finding | Status |
|---|---|
| S1 | ✅ Fixed — `20260611131441`: `tier`/`plan_tier` removed from column grants; preview flows through `set_preview_tier` SECURITY DEFINER RPC (single launch kill-switch); client `setPreviewTier` rewired. Smoke: direct tier UPDATE denied, allowed columns still writable, RPC still flips tier. |
| S2 | ✅ Fixed — `accept_household_invite` moves only `added_by = auth.uid()` items. Smoke: only the joiner's item moved, housemate's stayed. |
| S3 | ✅ Fixed — invite codes 24→64 bits (`gen_random_bytes(8)`); `lookup_household_invite` throttled to 10/hour via `invite_lookup_attempts` (RLS-locked, cron-pruned). Smoke: 64-bit length, 11th lookup rejected. UI placeholders updated. |
| S4 | ✅ Fixed — recipes/recipe_sessions/receipt_scans/cooked_events split into select(member) + insert/update/delete(owner). Smoke: cross-member hijack + delete blocked, reads intact. `inventory_items` stays member-writable by design (shared fridge). |
| S5 | ✅ Fixed — `LargeSecureStore` (AES-256 key in expo-secure-store, ciphertext in AsyncStorage) per Supabase's official adapter; wired into `getSupabaseClient`. Native rebuild required to exercise on-device. |
| S6 | ✅ Fixed — DATABASE_REVIEW D14 (`20260611101241`): grants narrowed to DML. |
| S7 | ✅ Fixed (stub) — `generate-recipes` no longer echoes raw request; `verify_jwt` default (true) retained (no per-function override in config.toml). Real validation lands with the Anthropic implementation. |
| S8 | ✅ Resolved — final pricing (migration `20260611194432`): **receipt scans are premium-only with no free onboarding scan** (per-scan AI cost); **barcode and manual adds are free** (barcode gate dropped — OpenFoodFacts is free). Client limit plumbing removed earlier; `receipt_scans_insert_premium` restrictive policy is the sole enforcement, SQL smoke-tested (free blocked even mid-onboarding, barcode/manual allowed, premium allowed). |
| S9 | ✅ Fixed — auth `console.error` calls gated behind `__DEV__`. |
| S10 | ✅ Fixed (local) — `config.toml` sets `otp_expiry = 600`, `max_frequency = "1m0s"`; ⚠️ must be mirrored in the hosted dashboard before launch (config.toml only configures local). |
| S11, S12, S13 | ⏳ Informational — privacy-policy / consent items; no code fix. S12: replace the `local-dev@chomp.app` OpenFoodFacts UA contact with a real address before release. |

## Pre-launch checklist (condensed)

1. **S1** — lock `tier` / `plan_tier` columns; tier writes via payment webhook only; remove `setPreviewTier`.
2. **S2** — scope `move_existing_items` to own items.
3. **S3** — long invite codes + throttled lookup.
4. **S5** — SecureStore session storage.
5. **S4** — ownership-scoped delete/update policies; owner-only household archival.
6. **S6, S8, S9, S10** — grants, server-side scan limit, log stripping, auth rate limits.
7. Re-run `supabase db advisors` (or MCP `get_advisors`) after the policy changes.
