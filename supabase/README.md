# Chomp Supabase Foundation

This folder contains the local Supabase foundation for Chomp.

## What Exists Now

- `config.toml`: local Supabase service configuration.
- `migrations/20260529124500_initial_household_foundation.sql`: household-first schema, helpers, triggers, and RLS.
- `functions/normalize-receipt`: future receipt normalization boundary.
- `functions/generate-recipes`: future recipe generation boundary.
- `functions/daily-suggestion`: future smart notification boundary.
- `seed.sql`: placeholder seed entry point.

## Schema Shape

Core tables:

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

The schema is household-first. A solo user is represented as a household with one member.

## Auth Trigger

`public.handle_new_user()` runs after a Supabase Auth user is created.

It creates:

- profile
- solo household
- owner membership
- active household pointer
- notification preference row
- household notification settings row

The app should pass `display_name` in Supabase signup metadata.

## Invite Helpers

The migration includes database helpers for later app flows:

- `create_household_invite(target_household_id uuid)`
- `lookup_household_invite(invite_code text)`
- `accept_household_invite(invite_code text, move_existing_items boolean default false)`

## Local Validation

Docker Desktop must be running.

```bash
supabase start
supabase db reset
```

Chomp uses non-default local ports so it can run beside another Supabase project:

- API: `55321`
- DB: `55322`
- Studio: `55323`
- Inbucket: `55324`
- Edge inspector: `55325`
- Analytics: `55327`
- Pooler, if enabled later: `55329`

After `supabase start`, copy the local anon key into `.env.local`.
