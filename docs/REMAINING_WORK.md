# Remaining Work

> Open items left after the database / security / code-review fix loops.
> Everything in `CODE_REVIEW.md`, `SECURITY_REVIEW.md`, `DATABASE_REVIEW.md`
> is done **except** what's listed here. Snapshot: 2026-06-11.
>
> All code-actionable items are now done. What remains needs a device, the
> hosted dashboard, or a content/legal decision.

---

## Needs you / a device (not code)

### S5 — verify SecureStore on-device
`LargeSecureStore` is wired in (`src/lib/secureStore.ts`), but encrypted session
storage only runs on a native build. Run `expo prebuild` / a dev client and
confirm login → background → relaunch keeps the session.

### S10 — production auth hardening in the hosted dashboard
`config.toml` sets `otp_expiry = 600` and `max_frequency = "1m0s"` for **local
only**. Mirror in the hosted Supabase project: OTP expiry ≤ 10 min, rate limits
on `/otp` + `/verify`, leaked-password protection for the password path.

### S12 — real OpenFoodFacts contact
Replace the User-Agent contact `local-dev@chomp.app` with a real address before
release (`src/services/barcodeService.ts`, two spots). OFF API policy.

### S11 / S13 — privacy / consent wording
- S11: `profiles.avoidances` is shared household-wide and can encode health/
  religious data — disclose in privacy policy + onboarding consent.
- S13: food search text + barcodes are sent to OpenFoodFacts (third party) —
  disclose in privacy policy.

---

## Verification gap (not a finding)

On-device smoke of the **recipe cook flow** after the #14 navigation refactor.
The logic is covered by tests + the `apply_cook` SQL smoke, but the detail screen
UI (open recipe → "I cooked this" → inventory depletes) wasn't run on a device.

---

## Future milestone (not a bug)

Full multilingual food intelligence. The prototype now folds a bounded set of
localized food names to the English catalog (`FOOD_ALIASES`), but **translated
recipe content** and a real multilingual food taxonomy are the eventual
AI / OpenFoodFacts-generation work — out of scope for a fix pass.
