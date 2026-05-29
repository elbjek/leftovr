# Local Development

## App

Install dependencies:

```bash
npm install
```

Run Expo:

```bash
npm start
```

Useful checks:

```bash
npm run typecheck
npm run lint
npx expo install --check
```

## Environment

Copy `.env.example` to `.env` after local Supabase is started and replace the anon key with the value printed by Supabase CLI.

```bash
cp .env.example .env
```

## Supabase

The local Supabase config is scaffolded in `supabase/config.toml`.

Phase 2 adds migrations, RLS policies, helper functions, Edge Function stubs, and seed entry point.

Docker Desktop must be running before starting Supabase.

Expected future workflow:

```bash
supabase start
supabase db reset
```

After `supabase start`, copy the printed local anon key into `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

The app can boot without these values during early scaffolding, but auth/database flows need them.
