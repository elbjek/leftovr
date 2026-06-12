# AI Generation Cost Controls

Goal: prevent repeated Generate or Surprise taps from creating repeated paid AI calls.

Client-side protection improves UX, but server-side protection controls cost. The paid call must be protected before Anthropic is invoked.

## Recommended Layers

### 1. Client Guard

- Disable Generate and Surprise while a generation is already running.
- Ignore repeat taps when a request is in flight.
- Add a short debounce or throttle, such as one click every 2 seconds.

This prevents accidental double taps, but it is not enough by itself.

### 2. Server-Side Quota Before Anthropic

The Edge Function should check entitlement and quota before calling Anthropic.

Examples:

- Free user: one generation total.
- Premium user: limited per hour/day if needed.
- Household quota: optional shared household cap.
- If quota is exceeded, return a 429 or upgrade response.

Quota must live server-side, not only in React Native.

### 3. Idempotency Key

Client sends an `idempotencyKey` derived from stable request inputs:

- user id
- household id
- fridge snapshot
- filters
- servings
- dietary avoidances

Server stores that key. If the same request repeats, return the existing result instead of calling Anthropic again.

### 4. In-Flight Lock

Generation creates a server-side attempt row:

- `status = processing`
- `idempotency_key = ...`
- `user_id = ...`
- `household_id = ...`

If another request arrives with the same key or same active generation, return the existing processing/completed attempt instead of starting another AI call.

This prevents parallel calls from rapid tapping.

### 5. Cost Budget And Rate Limit

Add hard limits around paid calls:

- per user: e.g. 5 generations/hour, 30/day
- per household: e.g. 50/day
- global daily cost cap
- emergency kill switch for AI generation

Log token usage and estimated cost per generation.

### 6. Cache

Cache generated recipes for the same:

- fridge snapshot
- filters
- servings
- avoidances

For a short window, such as 5-30 minutes, repeat requests return cached recipes.

## Chomp-Specific Flow

Current weak spot: paid AI generation can happen before the app creates the recipe session that marks the free generation as used.

Better flow:

1. User taps Generate or Surprise.
2. Client calls Edge Function with filters, servings, avoidances, and fridge snapshot.
3. Edge Function checks quota and creates/locks a generation attempt.
4. Edge Function calls Anthropic only if allowed.
5. Edge Function saves the session/result or returns the existing cached result.
6. Client renders returned recipes.

Cost gate must wrap the paid call.

## Suggested Tables

```sql
create table public.recipe_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  idempotency_key text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  request_hash text not null,
  recipe_session_id uuid references public.recipe_sessions(id) on delete set null,
  error_message text,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost_cents integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);
```

## Practical Rule

Never charge Anthropic until server has:

- authenticated the user
- checked plan/quota
- acquired an idempotency lock
- confirmed no reusable cached result exists
