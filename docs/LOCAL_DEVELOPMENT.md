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

Phase 2 will add migrations, RLS policies, seed data, and the real local database setup.

Expected future workflow:

```bash
supabase start
supabase db reset
```

