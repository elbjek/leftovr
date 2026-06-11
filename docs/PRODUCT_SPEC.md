# Chomp Product Spec

## One-Line Summary

Chomp is a receipt-powered virtual fridge that tracks what a household has, suggests what to eat first, and recommends meals from food already in the fridge.

## Product Principle

Chomp should feel low-effort, approximate, and useful. It should reduce daily cooking friction without becoming a calorie tracker, nutrition app, or manual inventory management tool.

The tone is always opportunity-framing:

- "Best eaten today"
- "Use your spinach tonight"
- "You saved an estimated $9"
- "You avoided wasting ~6 items"

Avoid guilt, warnings, exact expiration dates, and clinical nutrition language.

## V1 Build Target

Build a fully working mobile-first Expo React Native prototype with real auth, real local Supabase persistence, mocked AI services, functional household sharing, and no real payment implementation.

V1 uses:

- Expo React Native
- Expo Router
- Local Supabase + Docker
- Supabase Auth with email/password
- Supabase database migrations, RLS, and seed/demo data
- Expo Camera for receipt and barcode camera flows
- Mock receipt normalization
- Mock curated recipe suggestions
- Notification architecture and preference storage, but no real push delivery
- Internationalization from the start, with English and Serbian

V1 does not include:

- real payments
- real Anthropic API calls
- real Firebase Cloud Messaging delivery
- real Apple/Google OAuth
- exact expiration dates
- calorie tracking
- nutrition app features
- heavy manual inventory flows

## Design Source Of Truth

The Claude high-fidelity prototype is the visual source of truth, not loose inspiration.

Reference folder:

`/Users/elbjek/Projects/chomp/docs/Chomp - What's for dinner_`

Implementation should closely follow the prototype's:

- layout
- rhythm
- typography
- colors
- illustrations
- tone
- spacing
- card patterns
- success and onboarding moments

Adjust layouts only where React Native/mobile behavior requires it.

Use:

- Fraunces for display typography
- Plus Jakarta Sans for body typography
- the prototype deep green / warm gold / soft cream palette
- reusable native components
- native SVG illustrations via `react-native-svg`
- a custom React Native design system with tokens and shared primitives

Do not rewrite styling everywhere. Screens should compose reusable primitives and feature components.

Suggested component structure:

- `Screen`
- `Text`
- `Button`
- `IconButton`
- `Card`
- `BottomSheet`
- `SegmentedControl`
- `ChoiceCard`
- `FoodCard`
- `ShelfRow`
- `EmptyState`
- `EatFirstShelf`
- `ReceiptScanOverlay`
- `RecipeCard`
- `InventoryReviewCard`
- `PremiumSheet`
- `FoodGlyph`

## Internationalization

Add i18n from the start.

V1 languages:

- English
- Serbian

Requirements:

- all user-facing copy must go through translation keys
- no hardcoded screen copy inside components
- language can be selected in Settings
- app defaults to device locale when supported
- fallback language is English
- translation structure must allow adding more languages later
- opportunity-framing tone applies in every language

Recommended library:

- `i18next`
- `react-i18next`

## Navigation

Use Expo Router.

Main app uses bottom tabs:

- Fridge
- Recipes
- Scan
- Insights
- Settings

Scan is a center tab/action and opens the scan choice flow:

- Scan receipt
- Scan barcode
- Add manually

## Authentication

V1 auth is real email/password Supabase Auth.

Signup fields:

- display name
- email
- password

Login fields:

- email
- password

Apple and Google buttons are visible UI-only placeholders in V1.

Email verification must not block onboarding or app usage in V1. Users proceed immediately after signup.

Future OAuth behavior:

- create the profile from provider metadata display name when available
- if no display name is available, prompt for one before onboarding

## Household-First Model

Every user belongs to a household.

Rules:

- every user starts in a household of one
- every household has at least one member
- V1 supports one active household per user
- schema should not prevent multiple households later
- inventory belongs to a household
- receipt scans belong to a household
- recipe sessions belong to a household
- cooked events belong to a household
- added/generated/cooked attribution references profiles

Core entities:

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

## Household Sharing

Household sharing is functional in V1.

V1 supports real database-backed invite codes.

Flow:

1. Household owner/member opens Settings -> Household.
2. User creates an invite code.
3. Another registered user enters the invite code.
4. The app validates the invite.
5. If the invited household has room, the user joins.
6. Shared fridge becomes visible immediately.

Invite code entry should exist in two places:

- during onboarding/account setup, shown to ALL new users as the final, optional, skippable step ("Joining someone's household?"). Invite links cannot survive App Store install, so the app cannot reliably distinguish invited users from solo users; the field is prefilled when a `chomp://join` link was opened beforehand. Invalid codes show an inline error and the user can correct or skip.
- Settings -> Household for existing users

V1 invite delivery:

- "Share invite" button in Settings -> Household shares a text message with the code and a `chomp://join?code=...` link
- the `chomp://join?code=...` deep link only works if the app is already installed:
  - signed-in, onboarded user: opens Settings with the code prefilled in the join field
  - anyone else (signed out or mid-onboarding): the code is stored locally and prefilled on the onboarding invite step after signup
- the code itself remains primary; recipients without the app type it manually during signup

Deferred deep linking (invite links that survive App Store install) and store links are explicitly out of scope for V1 — revisit once the app has a store listing.

If the joining user's solo fridge is empty:

- join invited household
- archive old solo household

If the joining user's solo fridge has items:

- show a choice screen
- options:
  - move my items into this household
  - join without moving items
  - cancel

V1 active-household rule:

- one active household per user
- old solo household is archived/inactive after joining another household

Household plan references:

- shown only in the household invite flow
- `$7.99/month`
- `$49.99/year`
- up to 3 members
- CTA in prototype mode: `Preview Household Premium`

## Onboarding

Onboarding is mandatory.

Flow:

1. Hook carousel
2. Account creation/login
3. Personalization
4. First magic moment
5. Notification permission prompt
6. Home

### Hook Carousel

Pre-signup, no account required.

Five swipeable screens:

1. "How much food did you throw away last week?"
2. "Your fridge has a memory problem. We fixed it."
3. "Scan your receipt. We do the rest."
4. "Never open your fridge wondering what to cook again."
5. CTA: "Get Started - it's free."

Rules:

- no skip button
- swipeable throughout
- one-time per device
- shown on fresh install/logged-out first run
- returning logged-out users who already completed it on the device go to auth

### Personalization

One question per screen. Large tap targets. No typing.

Q1: "Who are you cooking for?"

- Just me
- Me and a partner
- Family (3-4)
- Bigger household

This seeds household default servings.

Q2: "How do you usually shop?"

- Big weekly shop
- A few times a week
- Whenever I need something

Stored and used lightly in retention/nudge copy in V1.

Q3: "What matters most to you?"

- Reducing food waste
- Saving money
- Quick meal ideas
- All of the above

This changes a few high-impact copy lines in V1.

Q4: "Any ingredients you never eat?"

- meat
- fish
- dairy
- gluten
- nuts

Skippable. These are hard recipe exclusions.

Store personalization on the user profile. Store first-fill completion on the household.

Invited users still complete personalization because avoidances and preferences are user-specific. If they join a household that already has items, they can skip first-fill.

## First Magic Moment

Screen: "Let's fill your fridge."

Choices:

- Scan a receipt, highlighted and recommended
- Scan a barcode
- Add manually

Receipt scanning is the selling point. Barcode and manual are secondary paths.

Receipt flow:

1. Real camera capture UI with Expo Camera.
2. Guided receipt camera overlay with first-time coach marks.
3. Mock processing state.
4. Mock receipt template selected.
5. High-confidence items are added.
6. Low-confidence items go to review queue.
7. Success screen appears.
8. User transitions into Home with populated fridge.

Success screen:

- "Your fridge is alive."
- "23 items added."
- if relevant: "3 need a quick check."

Never show an empty fridge on first launch.

## Receipt Scanning

V1 uses mock receipt templates. No Anthropic API calls.

Include several realistic templates:

- weekly family shop
- quick top-up
- vegetarian shop
- snack-heavy shop
- low-confidence receipt

Receipt scanning is premium-only (each scan carries a real AI processing
cost). There is no free allowance and no free onboarding scan; free users see
the Premium sheet when choosing the receipt path.

### Low-Confidence Review Queue

Low-confidence items do not block the success screen.

Home should show a review card until cleared:

- "3 items need a quick check"
- CTA: "Review"

Review is one item at a time:

- "Is this Greek yogurt?"
- Yes
- No
- Edit

Yes adds the item. No discards it. Edit opens lightweight name/category editing.

### Duplicate Receipt Detection

V1 implements simple duplicate detection.

Rules:

- each mock receipt template has `receipt_signature`
- check the same household for matching signature in a recent window
- if found, show duplicate prompt

Duplicate prompt:

- "Looks like this receipt was already added."
- Add anyway
- Cancel

## Barcode Scanning

V1 uses real camera barcode scanning with Open Food Facts product lookup.
The app should query the free Open Food Facts read API by barcode, map the
product name, brand, category, and package amount into Chomp's approximate
inventory model, and add one household inventory item when a match is found.
Local mock products remain as simulator/offline fallback only.

Unknown barcode behavior:

- show fallback
- offer manual search/add

Barcode scan is free and unlimited.

## Manual Entry

Manual entry is free and unlimited.

V1 includes:

- search field
- Open Food Facts text search suggestions (debounced with loader, online only, a handful of results)
- tapping a suggestion opens the add sheet prefilled (name, brand, category, unit) to confirm quantity and expiry
- empty until the user types; no local preset list

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

## Free And Premium

V1 removes the credit system.

### Free

Free users get:

- 3 recipe sessions per calendar week
- unlimited barcode scans
- unlimited manual adds
- limited Eat First preview
- day 7 recap preview card

Free users do not get:

- receipt scanning (premium only — each scan carries a real AI processing cost)
- unlimited recipe sessions
- full Eat First shelf
- optimized premium recipe filters
- full insights
- household sharing unless previewing household premium
- smart daily notification

### Premium

Premium unlocks:

- unlimited receipt scans
- unlimited recipes
- full Eat First shelf
- optimized recipe suggestions
- time filters
- complexity filters
- serving size controls
- smart daily notification references
- household sharing
- weekly/monthly insights

No real payment in V1.

### Premium Reveal

Never show a paywall in session one.

Premium reveal is contextual through a bottom sheet.

Triggers:

- free user attempts fourth weekly recipe session
- free user attempts a receipt scan
- free user taps full Insights
- free user taps full Eat First
- free user enters household invite/create flow

General Premium sheet:

- Individual Premium only
- `$4.99/month`
- `$29.99/year`
- CTA: `Preview Premium`
- Dismiss: `Maybe later`

Household invite flow:

- Household Premium only
- `$7.99/month`
- `$49.99/year`
- up to 3 members
- CTA: `Preview Household Premium`

### Prototype Controls

Settings includes `Prototype controls`.

Controls:

- Free/Premium toggle
- prototype day/time travel
- optional reset/demo helpers

Upgrade CTAs in prototype mode set the account/household to the relevant preview tier. No checkout.

## Inventory

Inventory uses grouped lots.

Track approximate food, not exact household stock.

Inventory item fields should support:

- household id
- name
- normalized name
- brand name (optional, mainly barcode-sourced)
- category
- quantity
- unit
- display quantity
- net amount (optional, canonical metric)
- net unit (optional: ml | g)
- partial state: full / some_used / low
- added at
- added by
- source: receipt / barcode / manual / moved_from_household
- source scan id when relevant
- receipt confidence when relevant

Do not track exact expiration dates.

Do not allow shelf-life editing in V1.

### Categories

Use a fixed practical category set:

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

### Shelf Life

Shelf life is rule-based, not AI.

Use:

- category defaults
- item-specific overrides for common foods

Always show approximate ranges:

- `~3-7 days`
- `~1-2 weeks`
- `~weeks`

No exact dates.

Urgency bands:

- Safe
- Use soon
- Urgent

Urgency UI should be subtle and supportive, never alarming.

### Grouping In UI

Underlying lots remain separate in the database.

UI grouping rule:

- visually merge same item/category when they share the same urgency band
- show separate lots when urgency differs

Example:

- `Greek yogurt x2 · Best today`
- `Greek yogurt x1 · 1 day old`

### Item Removal

Support:

- swipe-to-remove
- lightweight item detail sheet
- "I Cooked This" depletion flow

Lightweight item detail can include:

- name
- category
- approximate age/range
- who added it
- rough quantity state
- mark as used
- adjust rough quantity
- remove

No expiry editing.

### I Cooked This

Every recipe detail has an `I Cooked This` button.

Flow:

1. User taps `I Cooked This`.
2. Pre-ticked ingredient checklist appears.
3. User unticks anything not used.
4. Confirm.
5. Inventory depletion rules run.
6. Small celebratory micro-animation.
7. Undo is available briefly.

Depletion rules:

- countable items decrement quantity
- measured items with a known metric magnitude (net amount / net unit) subtract the
  recipe amount converted to metric (e.g. 1L milk, cook 200ml -> 800ml left), spilling
  across lots soonest-expiry first
- when no magnitude is known, or the recipe unit cannot be converted, fall back to
  partial-use: full -> some used -> low -> removed
- if item is already low, next confirmed use removes it

Amounts are stored in canonical metric (ml | g). A per-user metric/imperial toggle
controls display only; nothing imperial is persisted.

This writes a cooked event and feeds future recommendations.

## Recipes

V1 uses curated mock recipes selected from fridge contents.

No Anthropic API calls in V1.

Recipe matcher must:

- select from current household inventory
- prioritize urgent/use-soon items for premium
- hard-filter by avoidances
- support household/shared context
- return multiple recipe cards per session

Required-vs-optional rule (mock now, AI later): every REQUIRED ingredient of
a generated recipe must come from the fridge inventory. Ingredients the user
does not have may only appear as optional "nice to have" extras, never as
blockers. Item counts shown in the UI ("You have 2/3") count required
ingredients only, with no hidden staple assumptions.

Free rule:

- 3 recipe sessions per calendar week
- each session returns multiple recipe cards
- fourth session triggers Premium sheet

Premium rule:

- unlimited recipe sessions
- optimized suggestions
- time filters
- complexity filters
- serving controls

### Cook Prompt

Tapping "What should I cook?" opens an optional prompt sheet before generating:

- cooking for: household or just me (only in households with 2+ members;
  drives servings and whose avoidances apply)
- meal type: breakfast, lunch, dinner, or snack
- time available
- vibe/category, using recipe tags

A "Surprise me" action skips choices and generates instantly, preserving the
original one-tap behavior. The prompt is available to all users; the weekly
session limit remains the free/premium gate. Chomp always chooses ingredients
from the fridge inventory itself; users do not manually pick what to use.

### Recipe List Scoping

Recipes and cooked events are stored per household but displayed per user:

- All / Saved / Cooked tabs show only the current user's own recipes
  (`generated_by`) and own cooked events (`cooked_by`)
- favorites are per user (`recipe_favorites` join table, not a flag on the
  recipe); Saved shows the current user's favorites, which may include
  another member's recipe favorited from the Household tab
- a new user always starts with a blank recipe list, including users who
  joined an existing household via invite code
- a Household tab listing every member's recipes appears only once the user
  has generated at least one recipe themselves and the household has 2+
  members

### Avoidances

Avoidances are hard recipe exclusions.

Inventory can still contain avoided items, especially in shared households. Recipe suggestions must not include them.

Shared household default:

- filter by the combined avoidances of all active household members

For shared households with 2+ members, show:

- Cooking for: Household
- Cooking for: Just me

Household mode:

- uses combined household avoidances
- uses household default servings

Just me mode:

- uses current user's avoidances
- uses current user's personal serving preference

Solo households do not show this control.

### Recipe Storage

Recipe sessions are household-shared.

Every generated recipe session is auto-saved.

Recipes support optional favorite.

Store:

- household id
- generated by
- cooking mode: household / just_me
- avoidances used
- fridge snapshot
- recipe cards
- used inventory item ids when known
- favorite state

Recipes tab should show:

- current/latest suggestions
- history/recent sessions
- favorites

## Serving Size

Serving size is household-level by default.

Rules:

- onboarding Q1 seeds household default servings
- household default servings can be changed in Settings
- recipe detail has inline serving controls where relevant
- shared recipe flow can personalize for household vs just me

## Home / Fridge

Home is the Virtual Fridge.

Show:

- greeting/header
- inventory summary
- Eat First area
- grouped shelves by category
- review queue card if needed
- retention cards if active
- bottom CTA/action for recipes when relevant

Free:

- limited Eat First preview
- item cards show age-in-days/range and subtle urgency

Premium:

- full Eat First shelf with 2-3 items
- copy like "Best eaten today: Eggs, Yogurt, Spinach"
- tapping item goes to recipe suggestions

Swipe-to-remove items when used.

## Insights

Insights are Premium in V1.

Free users:

- see Day 7 preview card
- tapping full Insights triggers Premium sheet

Premium users:

- weekly summary
- monthly recap
- positive framing

Use real lightweight stats where easy and polished fallback where not.

Insights are calculated per user by default (your scans via `created_by`,
items you added via `added_by`, meals you cooked via `cooked_by`). In
households with 2+ members a You/Household toggle adds a household-wide view
of the same stats.

Calculate from:

- receipt scans
- items added
- cooked events
- removed items
- estimated items saved
- estimated money saved
- most-used category

Primary goal affects copy:

- reducing food waste: items saved framing
- saving money: dollar savings framing
- quick meal ideas: meals/decision framing
- all of the above: balanced framing

No calorie tracking.

No clinical diet analysis.

## Notifications

V1 builds notification architecture and UX, not real push delivery.

Implement:

- notification permission prompt after first magic moment
- Supabase preference storage
- household-level daily smart suggestion settings
- user/device-level permission state
- future push token shape
- service boundaries for future delivery

Household-level settings:

- daily suggestion enabled
- preferred send window, default 1-2 PM
- last generated/sent suggestion when relevant

User/device-level settings:

- permission state
- desired local preference
- future push token

No Firebase/FCM real delivery in V1.

## First-Week Retention Simulation

Use prototype time travel controls in Settings.

Include:

- Day 1 smart dinner suggestion Home card
- Day 3 coach mark on `I Cooked This`
- Day 5 top-up nudge
- Day 7 recap card

### Day 1

Show smart dinner suggestion as in-app Home card/notification preview.

Must reference actual fridge items.

No generic fallback. If no good match, do not show the card.

### Day 3

Show one-time coach mark on `I Cooked This`.

Rule:

- prototype day >= 3
- user opens recipe detail
- coach mark has not been seen

### Day 5

Show top-up nudge if household has fewer than 2 successful receipt scans.

"Second scan" means second receipt scan, not barcode/manual add.

### Day 7

Show recap card:

- positive framing
- lightweight estimate
- adapted to user's primary goal

Example:

- "This week you avoided wasting an estimated 6 items."
- "This week you saved an estimated $9."

## Future AI Architecture

V1 uses local mocks by default.

Scaffold Supabase Edge Function stubs:

- `normalize-receipt`
- `generate-recipes`
- `daily-suggestion`

Future Anthropic calls must be backend-only through Supabase Edge Functions.

Never expose Anthropic API keys in the Expo client.

Future model:

- `claude-sonnet-4-20250514`

Future backend should enforce:

- tier limits
- scan limits
- recipe limits
- household scope
- logging/cost tracking

## Settings

Settings should include:

- profile/display name
- language selection
- avoidances
- primary goal
- shopping style
- household default servings
- notification preferences
- household create/invite/join
- prototype controls
- sign out

## Supabase Local Development

Project should include local Supabase setup:

- `supabase/config.toml`
- migrations
- seed data
- RLS policies
- Edge Function stubs
- documentation for local startup

Expected local workflow:

- start Supabase with Docker
- reset/apply migrations
- run Expo app
- register with email/password
- complete onboarding
- scan mock receipt
- test shared household with second registered user

## Backlog / TODO

Anything not implemented in V1 should stay tracked here.

### Product / App

- Add real payment implementation.
- Add production Apple OAuth.
- Add production Google OAuth.
- Add email verification enforcement or gentle blocker.
- Add scan history screen/page from Claude design.
- Add multiple active households per user.
- Add richer settings extensibility for avoidances and preferences.
- Add hosted Supabase migration guide/config.
- Add offline/local cache with sync.
- Add conflict handling for offline shared household edits.
- Add richer recipe personalization beyond Household / Just me.
- Add more polished saved/favorite recipe library features.

### AI / Backend

- Replace mock receipt templates with real OCR/AI normalization.
- Add OCR-level duplicate receipt detection using store, purchase timestamp, total, and normalized item hash.
- Replace mock recipe service with Supabase Edge Function calling Anthropic.
- Replace mock daily suggestion with backend-generated suggestions.
- Add AI cost tracking and safeguards.
- Add fair-use protections for premium if needed.

### Notifications

- Add real Firebase Cloud Messaging / Expo push delivery.
- Add APNs/FCM credentials and production token registration.
- Add backend scheduled job for daily household suggestions.
- Ensure one smart notification per household, not per person.
- Add smart fallback: if no good match, send nothing.

### Data / Insights

- Improve estimated item-saved and money-saved models.
- Add monthly recap trends.
- Add lightweight diet pattern notes without nutrition/calorie positioning.
- Add duplicate inventory reconciliation beyond mock receipt signatures.

### Design / Content

- Expand Serbian translations.
- Add additional languages.
- Refine translation tone for opportunity-framing in each language.
- Keep implementation aligned with the prototype as new Claude design pages are added.
