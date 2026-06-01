# Chomp Build Plan

This plan implements `PRODUCT_SPEC.md` as a fully working Expo prototype with real local Supabase auth/persistence, mocked AI, functional household sharing, i18n, and prototype-faithful native UI.

## Build Rules

- Treat `/Users/elbjek/Projects/chomp/docs/Chomp - What's for dinner_` as the visual source of truth.
- Rebuild natively in Expo; do not redesign from scratch.
- Keep all user-facing copy behind i18n keys from the beginning.
- Use English and Serbian translation files in V1.
- Keep Anthropic, payments, and real push delivery behind service boundaries, but do not implement real integrations yet.
- Keep screens from calling Supabase directly. Use hooks/repositories/services so offline sync can be added later.
- Use grouped household-first data from day one.
- Keep V1 approximate, low-effort, and useful. Do not introduce exact expiry dates or heavy inventory forms.

## Phase 0 - Project Scaffolding

Goal: create a clean Expo app foundation that can support the whole prototype.

Tasks:

- Initialize Expo React Native project in the workspace.
- Add Expo Router.
- Add TypeScript.
- Add `react-native-svg`.
- Add `expo-camera`.
- Add Supabase client dependency.
- Add i18n dependencies, likely `i18next` and `react-i18next`.
- Add font loading with Fraunces and Plus Jakarta Sans.
- Add lint/typecheck/test scripts where appropriate.
- Create environment config for local Supabase:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Create initial folder structure:
  - `app/`
  - `src/components/`
  - `src/features/`
  - `src/theme/`
  - `src/i18n/`
  - `src/lib/`
  - `src/services/`
  - `src/repositories/`
  - `src/hooks/`
  - `src/mocks/`
  - `supabase/`

Definition of done:

- App boots in Expo.
- Expo Router renders a placeholder route.
- Fonts load without breaking startup.
- i18n can switch between English and Serbian.

Verification:

- Run app locally.
- Run typecheck/lint if configured.
- Confirm no user-facing placeholder copy is hardcoded outside translation setup except temporary dev-only text.

## Phase 1 - Design System Translation

Goal: port the prototype's visual language into reusable native components.

Tasks:

- Extract design tokens from `tokens.css`:
  - colors
  - typography
  - spacing
  - radii
  - shadows/elevation
  - urgency colors
- Implement `src/theme/tokens.ts`.
- Implement typography primitives:
  - display text
  - heading
  - body
  - label
  - micro label
- Implement reusable primitives:
  - `Screen`
  - `Button`
  - `IconButton`
  - `Card`
  - `BottomSheet`
  - `SegmentedControl`
  - `ChoiceCard`
  - `PageDots`
  - `EmptyState`
- Implement native SVG illustration components:
  - `FoodGlyph`
  - receipt icon/illustrations
  - fridge/success illustration
  - scanner corners/overlay helpers
- Implement feature UI components:
  - `FoodCard`
  - `ShelfRow`
  - `EatFirstShelf`
  - `PremiumSheet`
  - `RecipeCard`
  - `InventoryReviewCard`
  - `RetentionCard`

Definition of done:

- Shared components cover the repeated patterns from the prototype.
- Screens can be built mostly by composing components rather than repeating large inline style blocks.
- Components visually match the prototype's palette, typography, rounded shapes, and spacing.

Verification:

- Compare major component previews against the prototype files.
- Check small and large mobile viewport behavior.

## Phase 2 - Supabase Local Foundation

Goal: create local Supabase schema, RLS, seed data, and service boundaries.

Tasks:

- Add `supabase/config.toml`.
- Create migrations for:
  - `profiles`
  - `households`
  - `household_members`
  - `household_invites`
  - `inventory_items`
  - `receipt_scans`
  - `receipt_review_items`
  - `recipe_sessions`
  - `recipes`
  - `cooked_events`
  - `notification_preferences`
  - `household_notification_settings`
- Add enum/check constraints for:
  - household role
  - household status
  - invite status
  - inventory category
  - inventory source
  - partial state
  - receipt scan status
  - recipe cooking mode
  - tier/plan preview state
- Add updated timestamps where useful.
- Add RLS policies:
  - users can read/update their profile
  - users can access households where they are active members
  - users can access inventory, scans, recipes, settings, and cooked events for active member households
  - invite code lookup is narrowly supported without exposing private household data
- Add functions/triggers if useful:
  - create profile/household after signup, or handle from app service
  - generate invite code helper if implemented database-side
- Add seed/demo data where helpful for local development.
- Scaffold Edge Function stubs:
  - `normalize-receipt`
  - `generate-recipes`
  - `daily-suggestion`
- Add local development docs/scripts.

Definition of done:

- `supabase start` and migrations produce a working local database.
- A newly signed-up user can have a profile and household.
- Household-scoped RLS works for inventory and recipes.
- Edge Function stubs exist but the app still uses local mocks by default.

Verification:

- Reset local DB.
- Create two test users.
- Confirm each has isolated household data.
- Confirm shared household policies work after membership is added.

## Phase 3 - Auth And App Session

Goal: implement real email/password auth and route gating.

Tasks:

- Implement Supabase client.
- Implement auth provider/session hook.
- Implement route protection:
  - logged out -> hook/auth flow
  - logged in but personalization incomplete -> onboarding
  - logged in but household first-fill incomplete -> first-fill flow
  - complete -> tabs
- Implement signup:
  - display name
  - email
  - password
- Implement login:
  - email
  - password
- Show Apple/Google buttons as UI-only placeholders.
- Do not block on email verification.
- Create profile and solo household on signup.
- Store active household state.
- Add sign out.

Definition of done:

- A user can register, sign in, sign out, and return.
- Signup creates a profile and household of one.
- No email verification wall appears.
- Apple/Google buttons are visible but not wired.

Verification:

- Register a new local user.
- Kill/reopen app and confirm session restore.
- Sign out and sign back in.

## Phase 4 - i18n Baseline

Goal: make localization a real constraint before screens multiply.

Tasks:

- Create translation files:
  - `en`
  - `sr`
- Add language detection:
  - device locale if supported
  - fallback to English
- Add Settings language switcher placeholder early if Settings is not fully built yet.
- Convert auth, onboarding, tabs, and shared components to translation keys.
- Create naming conventions for keys:
  - `auth.*`
  - `onboarding.*`
  - `fridge.*`
  - `scan.*`
  - `recipes.*`
  - `settings.*`
  - `premium.*`
  - `retention.*`

Definition of done:

- App can switch English/Serbian.
- No major user-facing V1 screen copy is hardcoded.
- Missing translations are obvious during development.

Verification:

- Switch language and inspect auth/onboarding/tab labels.
- Search code for hardcoded long UI strings before finalizing each feature.

## Phase 5 - Mandatory Onboarding

Goal: implement the full first-run funnel with prototype fidelity.

Tasks:

- Implement one-time hook carousel:
  - 5 swipeable screens
  - no skip
  - local `hasSeenHook` persistence
- Implement auth transition.
- Implement personalization screens:
  - cooking for
  - shopping style
  - primary goal
  - avoidances
- Store profile personalization.
- Seed household default servings from Q1.
- Store user-level onboarding completion.
- Add invite-code entry path for invited users.
- Keep invited users' personalization mandatory.

Definition of done:

- Fresh install shows hook carousel.
- Returning logged-out user who has seen carousel goes to auth.
- New user must complete personalization.
- Profile and household settings reflect answers.

Verification:

- Clear local storage and test fresh path.
- Register and complete onboarding.
- Confirm database values.
- Switch language and confirm onboarding remains usable.

## Phase 6 - Inventory Engine

Goal: implement the rule-based food model used by scan, manual add, home, recipes, and cooked events.

Tasks:

- Define fixed categories:
  - Dairy & eggs
  - Meat
  - Fish
  - Vegetables
  - Fruit
  - Bakery
  - Pantry
  - Frozen
  - Drinks
  - Snacks
  - Other
- Create local catalog with common demo foods.
- Add item-specific shelf-life overrides for common foods.
- Add category default shelf-life ranges.
- Add urgency computation:
  - Safe
  - Use soon
  - Urgent
- Ensure ranges are approximate only.
- Implement grouped lot display logic:
  - merge same item/category/urgency band
  - show separate lots when urgency differs
- Implement inventory repository:
  - list active household inventory
  - add items
  - remove item/lot
  - update rough quantity
  - mark partial state
- Implement `I Cooked This` depletion logic:
  - countable decrement
  - partial-use full -> some used -> low -> removed
  - undo support if practical

Definition of done:

- Inventory can be added, grouped, displayed, and removed.
- Shelf-life logic never uses exact dates in UI.
- Cooked-event depletion works with rough quantity philosophy.

Verification:

- Add multiple lots of same item at different ages/urgencies.
- Confirm UI grouping behavior.
- Confirm depletion rules for eggs and yogurt-like partial-use items.

## Phase 7 - First Fill And Scan Flows

Goal: implement the product's core magic moment.

Tasks:

- Build "Let's fill your fridge" screen:
  - receipt highlighted/recommended
  - barcode/manual secondary
- Build receipt camera screen with Expo Camera.
- Add first-time coach marks.
- Add mock processing state.
- Add mock receipt templates:
  - weekly family shop
  - quick top-up
  - vegetarian shop
  - snack-heavy shop
  - low-confidence receipt
- Implement mock receipt normalization service.
- Implement successful receipt scan persistence:
  - `receipt_scans`
  - high-confidence `inventory_items`
  - low-confidence `receipt_review_items`
- Implement monthly free receipt scan limit:
  - 3 successful receipt scans per calendar month
  - count successful additions only
- Implement duplicate detection:
  - mock `receipt_signature`
  - same household recent match
  - Add anyway / Cancel
- Implement "Your fridge is alive" success screen.
- Implement notification permission prompt screen after success.
- Ensure user never lands on empty Home after first launch.

Definition of done:

- User can complete first fill through receipt scan.
- Mock items are saved to Supabase.
- Success screen appears after processing.
- Low-confidence items are queued, not blocking.
- Receipt limits and duplicates behave correctly.

Verification:

- Complete first scan from a new account.
- Scan same mock receipt again and confirm duplicate prompt.
- Use a free account to exceed monthly scan limit.

## Phase 8 - Barcode And Manual Add

Goal: make secondary add paths functional.

Tasks:

- Build barcode camera scanner using Expo Camera.
- Add local mock barcode lookup.
- Add known barcode products.
- Add unknown barcode fallback to manual search/add.
- Build manual entry screen:
  - search
  - autocomplete
  - tap-to-add
  - `Add "{typed item}"` path
  - category chip selection for custom items
- Persist added items to active household inventory.
- Ensure barcode/manual are unlimited and free.

Definition of done:

- Barcode scan can add known mock products.
- Unknown barcode flows into manual add.
- Manual custom item requires name + category only.

Verification:

- Add known barcode item.
- Try unknown barcode.
- Add custom item and confirm category/shelf-life default.

## Phase 9 - Home / Fridge

Goal: implement the main fridge screen as the daily hub.

Tasks:

- Build Home screen based on prototype Home V2.
- Show:
  - greeting/header
  - inventory summary
  - Eat First area
  - shelves by category
  - review queue card
  - retention cards
  - scan/add affordance where appropriate
- Implement Free limited Eat First preview.
- Implement Premium full Eat First shelf.
- Add item cards with subtle urgency indicators.
- Add swipe-to-remove.
- Add lightweight item detail sheet:
  - name
  - category
  - approximate age/range
  - added by
  - rough quantity state
  - mark used
  - adjust rough quantity
  - remove
- Add review queue screen/card:
  - Yes
  - No
  - Edit
- Add primary-goal-aware recap copy where relevant.

Definition of done:

- Home never feels empty after first fill.
- Inventory shelves match the prototype's visual rhythm.
- Free and Premium states are distinct.
- Review queue can be cleared.

Verification:

- Test Home with free tier.
- Toggle Premium and confirm full Eat First shelf.
- Clear low-confidence review items.
- Swipe/remove and use item detail actions.

## Phase 10 - Recipes

Goal: implement curated mock recipe generation, history, favorites, and cooked flow.

Tasks:

- Create curated recipe library with tags:
  - required/ideal ingredients
  - avoidances
  - categories
  - time
  - complexity
  - serving baseline
  - countable/partial-use ingredient mapping
- Implement recipe matcher:
  - uses active household fridge
  - filters hard by avoidances
  - shared household default uses union of member avoidances
  - Premium prioritizes urgent/use-soon items
- Implement free recipe limit:
  - 3 sessions per calendar week
  - fourth request triggers Premium sheet
- Implement recipe sessions:
  - auto-save to Supabase
  - household-shared
  - generated_by metadata
  - cooking mode
  - fridge snapshot
- Build Recipes tab:
  - latest suggestions
  - history/recent sessions
  - favorites
  - start state when no sessions exist
- Build recipe detail:
  - ingredients
  - used-from-fridge labels
  - steps
  - time/complexity
  - serving controls where relevant
  - `I Cooked This`
- Add optional favorite.
- Add shared-household cooking mode control only for households with 2+ members:
  - Household
  - Just me

Definition of done:

- User can generate mock recipes from fridge contents.
- Avoidances are respected as hard exclusions.
- Recipe sessions are auto-saved and visible later.
- `I Cooked This` removes/depletes inventory and records cooked event.

Verification:

- Set dairy avoidance and confirm dairy recipes are hidden.
- Generate recipes as free user until weekly limit.
- Toggle Premium and confirm unlimited generation.
- Cook a recipe and confirm inventory changes.

## Phase 11 - Premium And Prototype Controls - done last

Goal: implement monetization references without payment.

Tasks:

- Implement contextual Premium sheet.
- General sheet:
  - Individual Premium
  - `$4.99/month`
  - `$29.99/year`
  - `Preview Premium`
  - `Maybe later`
- Household sheet:
  - Household Premium
  - `$7.99/month`
  - `$49.99/year`
  - up to 3 members
  - `Preview Household Premium`
- Gate:
  - receipt scan limit
  - fourth recipe session
  - full Insights
  - full Eat First
  - household invite/create
- Implement Settings `Prototype controls`:
  - Free/Premium toggle
  - prototype day/time travel
  - optional reset/demo helper

Definition of done:

- No real checkout exists.
- Upgrade CTAs switch preview tier.
- Gated actions show correct contextual sheet.

Verification:

- Trigger every gate.
- Confirm no paywall appears during session-one first magic moment.
- Confirm Settings toggle changes tier state.

## Phase 12 - Household Sharing - done

Goal: make real invite-code sharing work between two local users.

Tasks:

- Build Settings Household section:
  - current household info
  - member list
  - create invite code
  - enter invite code
- Implement invite code generation.
- Implement invite validation.
- Enforce household member limit where relevant.
- Implement join flow:
  - empty solo fridge -> archive old household and join
  - non-empty solo fridge -> move items / join without moving / cancel
- Preserve `added_by` attribution.
- Show attribution in item detail and relevant scan/recipe contexts.
- Add shared household recipe behavior:
  - combined avoidances
  - Household / Just me control
- Ensure one active household per user in V1.

Definition of done:

- Two registered local users can join one household via code.
- Shared inventory is visible to both.
- Items show who added them.
- Recipe filtering considers shared household avoidances.

Verification:

- Register user A and scan receipt.
- Register user B and join A's household.
- Confirm B sees A's inventory.
- Add item as B and confirm A sees attribution.
- Test join flow when B has existing items.

## Phase 13 - Notifications Architecture And Retention - done

Goal: implement notification UX, settings, and first-week retention simulation without real push delivery.

Tasks:

- Build notification permission prompt after first magic moment.
- Store user/device-level notification preferences.
- Store household-level daily suggestion settings:
  - enabled
  - send window
  - last suggestion metadata
- Implement notification service interface:
  - `registerDevice`
  - `updatePreferences`
  - `previewDailySuggestion`
  - future `scheduleSmartSuggestion`
- Build Settings notification preferences.
- Implement prototype day/time travel states:
  - Day 1 smart dinner Home card
  - Day 3 `I Cooked This` coach mark
  - Day 5 top-up nudge
  - Day 7 recap card
- Day 1 suggestion must reference actual fridge items.
- Day 5 checks fewer than 2 successful receipt scans.
- Day 3 appears first time recipe detail opens on or after Day 3.

Definition of done:

- Preferences are persisted.
- Retention states can be tested instantly from Settings.
- No real FCM delivery is required.

Verification:

- Complete first magic moment and respond to notification prompt.
- Toggle notification settings.
- Use prototype day controls to inspect Day 1/3/5/7 behavior.

## Phase 14 - Insights - done 

Goal: implement gated Premium insights with lightweight real stats.

Tasks:

- Build Insights tab.
- Free state:
  - preview card
  - premium sheet on full access
- Premium state:
  - weekly summary
  - monthly recap
  - positive framing
- Calculate easy real stats:
  - scans
  - items added
  - cooked events
  - removed/depleted items
  - estimated items saved
  - estimated money saved
  - most-used category
- Use polished fallback where data is sparse.
- Adapt summary framing to primary goal.
- Avoid calories, nutrition, warnings, or clinical positioning.

Definition of done:

- Insights reflect app activity where possible.
- Free/Premium gating works.
- Copy changes based on primary goal.

Verification:

- Add items, cook recipes, remove items.
- Confirm insights update.
- Test each primary goal framing.

## Phase 15 - Settings Completion - done

Goal: centralize account, household, preferences, language, and dev controls.

Tasks:

- Build Settings screen matching prototype style.
- Add editable:
  - display name
  - language
  - avoidances
  - primary goal
  - shopping style
  - household default servings
  - notification preferences
- Add household section from Phase 12.
- Add prototype controls from Phase 11/13.
- Add sign out.

Definition of done:

- Important personalization preferences are editable.
- Language switching persists.
- Household and prototype controls are reachable.

Verification:

- Change each setting and confirm persistence.
- Switch language and restart app.
- Sign out/in and confirm settings remain.

## Phase 16 - QA, Polish, And Hardening

Goal: make the prototype feel coherent end to end.

Tasks:

- Full fresh-user test:
  - carousel
  - signup
  - personalization
  - first fill
  - notification prompt
  - Home
  - recipe generation
  - cooked flow
- Full returning-user test.
- Full shared-household test with two users.
- Free/Premium gating test.
- Serbian language pass.
- Empty/sparse data states.
- Loading/error states for local Supabase unavailable.
- Camera permission states.
- Scan limit and recipe limit edge cases.
- Duplicate receipt edge cases.
- Low-confidence review queue edge cases.
- Confirm no exact expiry dates appear.
- Confirm no guilt/warning language appears.
- Confirm no calorie/nutrition features appear.
- Search for hardcoded user-facing strings.
- Compare key screens against the prototype.

Definition of done:

- A reviewer can install/run locally, create accounts, complete onboarding, scan mock receipt, use fridge, generate/cook recipes, test household sharing, switch language, and preview Premium without external paid services.

Verification:

- Run typecheck/lint.
- Run app on mobile simulator/device if available.
- Capture screenshots for key screens:
  - hook carousel
  - signup
  - personalization
  - fill fridge
  - scanner
  - success
  - Home Free
  - Home Premium
  - Recipes
  - Recipe detail
  - Settings
  - Household invite
  - Insights
  - Serbian examples

## Suggested Implementation Order

1. Scaffold Expo project.
2. Port design tokens/components.
3. Set up Supabase local schema.
4. Implement auth/session routing.
5. Add i18n baseline.
6. Implement onboarding.
7. Implement inventory engine.
8. Implement first-fill receipt mock flow.
9. Implement Home.
10. Implement manual/barcode flows.
11. Implement recipes and cooked flow.
12. Implement premium/prototype controls.
13. Implement household sharing.
14. Implement notifications architecture and retention simulation.
15. Implement insights.
16. Complete settings.
17. QA/polish.

## Data Access Architecture

Use a layered approach:

- Screens call hooks.
- Hooks call services/repositories.
- Repositories call Supabase.
- Services hold product rules.
- Mock providers implement AI-like behavior locally.

Suggested layers:

- `repositories/profileRepository`
- `repositories/householdRepository`
- `repositories/inventoryRepository`
- `repositories/scanRepository`
- `repositories/recipeRepository`
- `repositories/notificationRepository`
- `services/authService`
- `services/onboardingService`
- `services/inventoryRules`
- `services/shelfLifeService`
- `services/receiptService`
- `services/barcodeService`
- `services/manualEntryService`
- `services/recipeService`
- `services/premiumService`
- `services/householdInviteService`
- `services/notificationService`
- `services/insightsService`

This keeps future offline/local cache work contained. Screens should not be rewritten when offline sync is added.

## V1 Acceptance Criteria

- User can register with email/password and use the app immediately.
- User always belongs to a household of one after signup.
- User must complete onboarding.
- User can first-fill fridge through a mock receipt scan.
- User sees "Your fridge is alive" before entering populated Home.
- User can add inventory through receipt, barcode, and manual entry.
- User can review low-confidence receipt items.
- User can generate curated mock recipes from fridge contents.
- Avoidances are hard recipe exclusions.
- User can tap `I Cooked This` and inventory updates approximately.
- Free limits work without a visible credit system.
- Premium preview works without payment.
- Two local registered users can share a household through real invite codes.
- Settings can switch language between English and Serbian.
- Notifications preferences and retention simulations work without real push delivery.
- Insights show real lightweight stats where possible.
- No exact expiry dates, calorie tracking, nutrition app features, or heavy manual inventory flows exist.

## Backlog To Carry Forward

Keep these TODOs visible during and after V1:

- Real payment implementation.
- Production Apple OAuth.
- Production Google OAuth.
- Email verification enforcement or gentle blocker.
- Scan history screen/page from Claude design.
- Multiple active households per user.
- Richer settings extensibility for avoidances and preferences.
- Hosted Supabase migration guide/config.
- Offline/local cache with sync.
- Conflict handling for offline shared household edits.
- Richer recipe personalization beyond Household / Just me.
- More polished saved/favorite recipe library features.
- Real OCR/AI receipt normalization.
- OCR-level duplicate detection.
- Real Anthropic recipe generation via Supabase Edge Functions.
- Real backend daily suggestions.
- AI cost tracking and safeguards.
- Premium fair-use protections if needed.
- Real Firebase Cloud Messaging / Expo push delivery.
- APNs/FCM credentials and production token registration.
- Backend scheduled job for daily household suggestions.
- One smart notification per household, not per person.
- Smarter notification fallback when no good match exists.
- Improved estimated item-saved and money-saved models.
- Monthly recap trends.
- Lightweight diet pattern notes without nutrition/calorie positioning.
- Duplicate inventory reconciliation beyond mock signatures.
- Expanded Serbian translations.
- Additional languages.
- Translation tone review for every supported language.
- Continued alignment with new Claude design pages as they are added.


--todo dice roll, what should i cook with options, tiktok recipes, rate meals, meal rating, custom recipe addition with an option to create "my cook book" and make it shareable on instagram with a watermark or something, make recipes shareable,

i make a recipe, i share it with a friend, open up app store to download app and make user register, and allow them to see the recipe someone shared.
make a shared recipes list. 

1. dice roll
2. rate meals
share recipes on instagram
3. share recipes with friends
4. custom recipe adding with cookbook
5. make the cookbook shareable on isntagram via watermark