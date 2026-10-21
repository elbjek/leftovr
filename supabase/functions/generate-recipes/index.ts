import OpenAI from "npm:openai@^4.77.0";
import { createClient } from "npm:@supabase/supabase-js@^2.46.1";
import { mentionsAvoidance } from "../_shared/avoidances.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2.46.1";

type GenerateRecipesRequest = {
  inventory?: Array<{
    id?: string;
    name?: string;
    normalized_name?: string;
    category?: string;
    urgency?: string;
    quantity?: number | null;
    unit?: string | null;
    net_amount?: number | null;
    net_unit?: string | null;
    partial_state?: string | null;
  }>;
  householdId?: string;
  idempotencyKey?: string;
  requestHash?: string;
  avoidances?: string[];
  isPremium?: boolean;
  cookingMode?: "household" | "just_me";
  servings?: number;
  // BCP-47 language code from the user's device locale (e.g. "sr", "es").
  language?: string;
  filters?: {
    mealType?: "breakfast" | "lunch" | "dinner" | "snack";
    maxMinutes?: number;
    minMinutes?: number;
    vibe?: string;
    cuisine?:
      | "any" | "italian" | "mexican" | "american" | "greek" | "mediterranean"
      | "french" | "indian" | "middle_eastern" | "asian" | "japanese" | "thai"
      | "chinese" | "korean" | "british" | "spanish" | "eastern_european";
    basePreference?: "anything" | "protein" | "potatoes" | "pasta" | "vegetables";
  };
  // Two-phase generation. Absent ("full") keeps the legacy behavior so app
  // builds already in the field keep working. "cards" returns lightweight cards
  // (no steps/amounts); "expand" fills one selected card into a full recipe.
  mode?: "full" | "cards" | "expand";
  // Required when mode === "expand": the card the user tapped.
  expandCard?: {
    title: string;
    description?: string;
    usedIngredientNames?: string[];
    mealType?: "breakfast" | "lunch" | "dinner" | "snack";
    category?: string;
    timeMinutes?: number;
    tags?: string[];
  };
};

// Lightweight card returned by mode === "cards".
type AiRecipeCardLite = {
  title: string;
  description: string;
  usedIngredientIds: string[];
  tags: string[];
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  category: string;
  timeMinutes: number;
};

// Human-readable name for the prompt; falls back to English for anything unmapped.
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  sr: "Serbian",
  es: "Spanish",
  de: "German",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  hr: "Croatian",
  bs: "Bosnian",
  sl: "Slovenian",
  mk: "Macedonian",
};

function languageName(code: string | undefined): string {
  if (!code) return "English";
  return LANGUAGE_NAMES[code.split("-")[0].toLowerCase()] ?? "English";
}

type AiRecipeCard = {
  title: string;
  description: string;
  timeMinutes: number;
  complexity: "simple" | "medium" | "involved";
  servings: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  category: string;
  tags: string[];
  avoidanceTags: string[];
  // matchKey: household item's canonical (untranslated) name; set by expand only.
  ingredients: { name: string; amount: string; required: boolean; countable: boolean; matchKey?: string | null }[];
  steps: string[];
};

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          timeMinutes: { type: "integer" },
          complexity: { type: "string", enum: ["simple", "medium", "involved"] },
          servings: { type: "integer" },
          mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          avoidanceTags: { type: "array", items: { type: "string" } },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                amount: { type: "string" },
                required: { type: "boolean" },
                countable: { type: "boolean" },
              },
              required: ["name", "amount", "required", "countable"],
              additionalProperties: false,
            },
          },
          steps: { type: "array", items: { type: "string" } },
        },
        required: [
          "title",
          "description",
          "timeMinutes",
          "complexity",
          "servings",
          "mealType",
          "category",
          "tags",
          "avoidanceTags",
          "ingredients",
          "steps",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["recipes"],
  additionalProperties: false,
};

// Slim schema for mode === "cards": no steps, no ingredient amounts. Cards stay
// cheap to generate so the discovery screen appears fast; full detail is
// deferred to mode === "expand" on tap.
const CARD_SCHEMA = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          usedIngredientIds: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          category: { type: "string" },
          timeMinutes: { type: "integer" },
        },
        required: [
          "title",
          "description",
          "usedIngredientIds",
          "tags",
          "mealType",
          "category",
          "timeMinutes",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["recipes"],
  additionalProperties: false,
};

// Schema for mode === "expand": only the heavy fields the card omitted. Title,
// description and metadata already live on the card the client passes back.
const EXPAND_SCHEMA = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "string" },
          required: { type: "boolean" },
          matchKey: { type: ["string", "null"] },
        },
        required: ["name", "amount", "required", "matchKey"],
        additionalProperties: false,
      },
    },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["ingredients", "steps"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "missing_openai_api_key" }, { status: 500 });
  }

  const raw = await req.text();
  let input: GenerateRecipesRequest = {};
  try {
    input = JSON.parse(raw);
  } catch {
    // Invalid JSON: fall through with an empty request, as before.
  }
  const authHeader = req.headers.get("Authorization");

  // Expand happens after a card is tapped: it does NOT consume a generation
  // credit (the card phase already did) and has no idempotency lock. It has its
  // own per-user daily cap (handleExpand) and a body size cap, since the whole
  // body ends up in the prompt.
  if (input.mode === "expand") {
    // ponytail: one whole-body cap instead of per-field limits.
    if (raw.length > EXPAND_MAX_BODY_CHARS) {
      return Response.json({ error: "expand_request_too_large" }, { status: 413 });
    }
    return await handleExpand(input, authHeader, apiKey);
  }

  const gate = await acquireGenerationAttempt(input, authHeader);
  if (gate.response) return gate.response;

  const client = new OpenAI({ apiKey });

  // Recipe generation is stateless, so a fridge dominated by a couple of items
  // (turkey, yogurt) keeps yielding the same obvious dishes across sessions.
  // Feed the household's recent titles in as a soft avoid-list so each fresh
  // generation tries something new before falling back to a repeat.
  // householdId is validated non-null by acquireGenerationAttempt above.
  const recentTitles = await fetchRecentRecipeTitles(gate.supabase, input.householdId!);

  // Phase 1: lightweight cards (no steps/amounts) for fast discovery.
  if (input.mode === "cards") {
    return await handleCards(input, gate, client, recentTitles);
  }

  // One model call per recipe.
  // gpt-5-mini is ~10x cheaper input / 5x cheaper output than gpt-4o yet makes
  // the culinary-coherence judgment gpt-4o kept ignoring. Reasoning "low" gates
  // out junk combos while keeping latency usable — "medium" roughly tripled
  // reasoning tokens and pushed generation past 40s. Reasoning-series takes no
  // custom temperature; max_completion_tokens leaves headroom for reasoning
  // tokens on top of the recipe JSON.
  const runVariant = (
    variant: "confident" | "alternative",
    exclude?: { title: string; ingredients: string[] },
  ) =>
    client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 6000,
      reasoning_effort: "low",
      messages: buildMessages(input, variant, exclude, recentTitles),
      response_format: {
        type: "json_schema",
        json_schema: { name: "recipes", strict: true, schema: RECIPE_SCHEMA },
      },
    });

  try {
    // Sequential, not parallel: the alternative is told exactly which dish the
    // confident call chose so the two never collapse into the same recipe under
    // different names. ~2x wall-clock vs parallel, but premium reliably gets two
    // distinct recipes instead of paying for a near-duplicate that gets dropped.
    const confident = await runVariant("confident");
    const responses = [confident];

    if (gate.premium === true) {
      const firstText = confident.choices[0]?.message?.content ?? "";
      const firstRecipe =
        (JSON.parse(firstText) as { recipes: AiRecipeCard[] }).recipes[0];
      const exclude = firstRecipe
        ? { title: firstRecipe.title, ingredients: firstRecipe.ingredients.map((i) => i.name) }
        : undefined;
      try {
        responses.push(await runVariant("alternative", exclude));
      } catch (altError) {
        // One variant failing shouldn't sink the whole generation for premium.
        console.error("[generate-recipes] alternative variant failed", altError);
      }
    }

    const allRecipes = responses.flatMap((response) => {
      const text = response.choices[0]?.message?.content ?? "";
      return (JSON.parse(text) as { recipes: AiRecipeCard[] }).recipes;
    });

    const avoidances = input.avoidances ?? [];
    // Dedupe by ingredient set, not title: the premium variants often share the
    // same ingredients under different names (e.g. "...sourdough toast" vs
    // "...toast"), which is a duplicate, not a real alternative.
    const keptSignatures: Set<string>[] = [];
    const dropReasons: string[] = [];
    const recipes = allRecipes.filter((recipe) => {
      if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
        dropReasons.push(`"${recipe.title}": empty ingredients/steps`);
        return false;
      }
      if (violatesAvoidances(recipe, avoidances)) {
        dropReasons.push(`"${recipe.title}": violates avoidances`);
        return false;
      }
      if (isIncoherent(recipe)) {
        dropReasons.push(`"${recipe.title}": incoherent combination`);
        return false;
      }
      if (isReadyToEatOnly(recipe, input.inventory ?? [])) {
        dropReasons.push(`"${recipe.title}": ready-to-eat items only`);
        return false;
      }
      // Near-duplicate, not just exact: the variants often differ by a single
      // swapped ingredient (e.g. "greek yogurt" vs "galbani cheese" in the same
      // salad), so an exact set match misses them. Drop a recipe that overlaps
      // an already-kept one by >=60% of its ingredient names (Jaccard).
      const signature = ingredientNameSet(recipe.ingredients);
      const duplicate = keptSignatures.find((kept) => jaccard(signature, kept) >= 0.6);
      if (duplicate) {
        dropReasons.push(`"${recipe.title}": near-duplicate ingredients`);
        return false;
      }
      keptSignatures.push(signature);
      return true;
    });

    // Guardrail: tidy each surviving title (the prompt sets the rules; this
    // catches the misses — quotes, filler adjectives, runaway length).
    for (const recipe of recipes) {
      recipe.title = cleanTitle(recipe.title);
    }

    const promptTokens = responses.reduce(
      (sum, response) => sum + (response.usage?.prompt_tokens ?? 0),
      0,
    );
    const completionTokens = responses.reduce(
      (sum, response) => sum + (response.usage?.completion_tokens ?? 0),
      0,
    );

    console.info("[generate-recipes] token usage", {
      calls: responses.length,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    });
    console.info("[generate-recipes] returning recipes", {
      calls: responses.length,
      raw: allRecipes.length,
      kept: recipes.length,
      titles: recipes.map((recipe) => recipe.title),
    });

    const payload = { source: "ai", recipes };
    if (gate.attemptId) {
      // Never cache an empty result as completed: the idempotency key is the
      // fridge hash, so a one-off model miss would replay forever for the same
      // inventory. Mark failed instead so the next identical request re-runs.
      await gate.supabase
        ?.from("recipe_generation_attempts")
        .update({
          status: recipes.length === 0 ? "failed" : "completed",
          // On empty, store diagnostics (not served — only completed rows are
          // replayed) so we can see whether the model under-generated or the
          // filters dropped everything.
          response_json: recipes.length === 0
            ? {
                source: "empty_diagnostic",
                raw: allRecipes.length,
                rawTitles: allRecipes.map((r) => r.title),
                dropReasons,
              }
            : payload,
          error_message: recipes.length === 0 ? "no_recipes_generated" : null,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          completed_at: new Date().toISOString(),
        })
        .eq("id", gate.attemptId);
    }

    if (recipes.length > 0 && !(await claimFreeGeneration(gate))) {
      return Response.json({ error: "recipe_generation_quota_exceeded" }, { status: 402 });
    }
    return Response.json(payload);
  } catch (error) {
    console.error("[generate-recipes] generation failed", error);
    if (gate.attemptId) {
      await gate.supabase
        ?.from("recipe_generation_attempts")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "generation_failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", gate.attemptId);
    }
    return Response.json({ error: "generation_failed" }, { status: 500 });
  }
});

// Free users' one lifetime generation is stamped here, server-side, only once
// a generation succeeds — not by the client saving a session (it could skip
// that). The conditional update is atomic: when parallel requests both pass the
// gate, only the first to finish claims it; the rest get 402 and no recipes.
// Premium always passes. (The recipe_sessions trigger still stamps too; it is a
// no-op once this has run.)
async function claimFreeGeneration(
  gate: { supabase?: SupabaseClient; premium?: boolean; userId?: string },
): Promise<boolean> {
  if (gate.premium || !gate.supabase || !gate.userId) return true;
  const { data, error } = await gate.supabase
    .from("profiles")
    .update({ free_recipe_generation_used_at: new Date().toISOString() })
    .eq("id", gate.userId)
    .is("free_recipe_generation_used_at", null)
    .select("id");
  if (error) {
    // Don't withhold a paid-for result over a bookkeeping error; the session
    // trigger is the fallback stamp.
    console.error("[generate-recipes] free generation stamp failed", error);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

async function acquireGenerationAttempt(input: GenerateRecipesRequest, authHeader: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return { response: Response.json({ error: "missing_supabase_service_config" }, { status: 500 }) };
  }
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: Response.json({ error: "missing_authorization" }, { status: 401 }) };
  }
  if (!input.householdId || !input.idempotencyKey || !input.requestHash) {
    return { response: Response.json({ error: "missing_generation_lock_fields" }, { status: 400 }) };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const jwt = authHeader.replace("Bearer ", "");
  const { data: userResult, error: userError } = await supabase.auth.getUser(jwt);
  const userId = userResult.user?.id;
  if (userError || !userId) {
    return { response: Response.json({ error: "invalid_authorization" }, { status: 401 }) };
  }

  // These reads are independent (keyed on userId/householdId/key), so run
  // them concurrently. Auth is already validated above; the gate checks below
  // still run in order and reject before any attempt write.
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [profileResult, householdResult, dailyResult, monthlyCountResult, existingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, tier, active_household_id, free_recipe_generation_used_at")
      .eq("id", userId)
      .single(),
    supabase
      .from("households")
      .select("plan_tier")
      .eq("id", input.householdId)
      .maybeSingle(),
    supabase
      .from("recipe_generation_attempts")
      .select("status, attempt_count")
      .eq("user_id", userId)
      .gte("created_at", dayAgo),
    supabase
      .from("recipe_generation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart),
    supabase
      .from("recipe_generation_attempts")
      .select("id, status, response_json, attempt_count, created_at")
      .eq("user_id", userId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle(),
  ]);
  const profile = profileResult.data;
  const profileError = profileResult.error;
  const household = householdResult.data;
  const dailyRows = (dailyResult.data ?? []) as { status: string; attempt_count: number | null }[];
  const monthlyCount = monthlyCountResult.count;
  const existing = existingResult.data as
    | { id: string; status: string; response_json: unknown; attempt_count: number | null; created_at: string }
    | null;

  if (profileError || !profile) {
    return { response: Response.json({ error: "profile_not_found" }, { status: 403 }) };
  }
  if (profile.active_household_id !== input.householdId) {
    return { response: Response.json({ error: "household_mismatch" }, { status: 403 }) };
  }
  const premium =
    profile.tier === "premium" ||
    profile.tier === "household_premium" ||
    household?.plan_tier === "household_premium";
  // Replays cost no model call, so they run before every gate: a request that
  // already completed must never be rate-limited — or 402'd, since the server
  // stamps the free generation the moment that run succeeded (A7), and a
  // client that missed the response retries with the same key.
  if (existing?.status === "completed" && existing.response_json) {
    return { response: Response.json(existing.response_json) };
  }

  if (!premium && profile.free_recipe_generation_used_at) {
    return { response: Response.json({ error: "recipe_generation_quota_exceeded" }, { status: 402 }) };
  }
  // A "processing" row older than any real generation (past the edge
  // function's wall-clock limit) is a crashed attempt: retry it instead of
  // answering 202 forever (B15). created_at is refreshed on each retry below.
  const STALE_PROCESSING_MS = 7 * 60_000;
  if (
    existing?.status === "processing" &&
    now.getTime() - Date.parse(existing.created_at) < STALE_PROCESSING_MS
  ) {
    return { response: Response.json({ source: "processing" }, { status: 202 }) };
  }

  // Caps count model calls: attempt_count is bumped each time a failed attempt
  // is retried under the same key, so retries can't run unbounded.
  // Free: one lifetime generation is gated above; here a FAILED try must not
  // lock them out (only a completed one does), but failures are still capped.
  const dailyAttempts = dailyRows.reduce((sum, row) => sum + (row.attempt_count ?? 1), 0);
  const dailyCompleted = dailyRows.filter((row) => row.status === "completed").length;
  const FREE_DAILY_ATTEMPT_CAP = 5;
  const rateLimited = premium
    ? dailyAttempts >= 50
    : dailyCompleted >= 1 || dailyAttempts >= FREE_DAILY_ATTEMPT_CAP;
  if (rateLimited) {
    return { response: Response.json({ error: "recipe_generation_rate_limited" }, { status: 429 }) };
  }

  const RECIPE_MONTHLY_CAP = 150;
  if (premium && (monthlyCount ?? 0) >= RECIPE_MONTHLY_CAP) {
    return { response: Response.json({ error: "recipe_generation_monthly_limit" }, { status: 429 }) };
  }

  // Retry of a failed (or stale processing) attempt: reuse its row (unique per
  // user + key).
  if (existing?.id) {
    await supabase
      .from("recipe_generation_attempts")
      .update({
        status: "processing",
        error_message: null,
        completed_at: null,
        attempt_count: (existing.attempt_count ?? 1) + 1,
        created_at: now.toISOString(),
      })
      .eq("id", existing.id);
    return { attemptId: existing.id, supabase, premium, userId };
  }

  const insert = await supabase
    .from("recipe_generation_attempts")
    .insert({
      user_id: userId,
      household_id: input.householdId,
      idempotency_key: input.idempotencyKey,
      request_hash: input.requestHash,
      status: "processing",
    })
    .select("id")
    .single();

  if (!insert.error) {
    return { attemptId: insert.data.id as string, supabase, premium, userId };
  }
  // A parallel request with the same key won the insert: it is in flight.
  if (insert.error.code === "23505") {
    return { response: Response.json({ source: "processing" }, { status: 202 }) };
  }
  return { response: Response.json({ error: "generation_lock_failed" }, { status: 500 }) };
}

// Stable rules — identical across requests, so it stays in the `system` message
// and benefits from prompt caching. Request-specific data goes in `user`.
const SYSTEM_PROMPT = [
  "You generate practical Leftovr recipe ideas from food a household currently has.",
  "Tone: low-effort, approximate, useful, opportunity-framed. Avoid guilt, exact expiry dates, calories, and nutrition tracking.",
  "Culinary judgment: create normal, appetizing meals grounded in real cooking traditions, not novelty mashups. Only combine ingredients when there is a recognizable culinary reason (classic pairing, shared cuisine, sauce/dressing that bridges them, or common breakfast/lunch/dinner pattern). Do not force unrelated household items into the same recipe just because they are available; it is better to use fewer well-matched items.",
  "Subset rule: you do NOT have to use every item. Pick the largest subset that forms ONE coherent, real dish, and ignore the rest. A simple dish from 2-3 items that belong together always beats a mashup that uses more items. Never bend an item's role to fit (do not make sweet fruit savory, do not push a savory vegetable into a dessert) — if an item only fits a different kind of dish, leave it out of this one.",
  "Sweet fruit can be used when it belongs naturally (yogurt, oats, smoothies, salads, desserts, some cheese boards), but never put sweet fruit (banana, apple, berries) into an egg/savory base like a frittata, omelette, scramble, or stir-fry. Avoid awkward sweet-savory combinations unless they are a familiar named dish. If a combination sounds like a dare, joke, TikTok stunt, or pregnancy craving, do not return it — fall back to the safest coherent dish from a smaller subset instead.",
  "Ready-to-eat rule: items with category `snacks` or `drinks`, and any sweet/confectionery/chocolate/candy/pastry product (e.g. a chocolate-filled croissant, a candy bar, soda), are finished products, NOT savory cooking ingredients. Never cook or combine them into savory dishes (e.g. never make an egg-and-chocolate-croissant dish). Use them only on their own or inside a fitting sweet/dessert context, and only when it reads as a real treat — otherwise ignore them and build the recipe from the actual cooking ingredients.",
  "TITLE — name the dish the way a home cook or a friend would say it, in the requested language:",
  "- Lead with the dish. 2–5 words. Reflect the main protein/vegetable plus its form or technique.",
  "- If it is a recognised dish, use its real name (e.g. Shakshuka, Carbonara, Tortilla de patatas). Otherwise describe it plainly.",
  "- Sentence case: capitalise only the first word and proper nouns. No trailing punctuation, no emoji, no ALL CAPS, no quotation marks.",
  "- BANNED words and patterns: filler adjectives (delicious, tasty, easy, quick, simple, amazing, ultimate, perfect, hearty, healthy, homemade, classic), 'with a twist', listing every ingredient, restaurant/menu-speak, invented brand names.",
  "- Do not just concatenate ingredients ('Chicken, Rice and Peas'); name the actual dish ('Lemon chicken rice').",
  "Title examples — bad -> good:",
  "  'Delicious Easy Chicken Dinner' -> 'Garlic butter chicken'",
  "  'Eggs, Spinach, Feta and Tomato Scramble' -> 'Spinach feta scramble'",
  "  'Hearty Wholesome Vegetable Medley Bowl' -> 'Roasted vegetable bowl'",
  "  'Pasta with Tomatoes and Garlic and Basil' -> 'Tomato basil pasta'",
  "Keep the description to one short sentence. Use at most 3 tags.",
  "Write steps for a beginner cook: cooking steps (stove/oven) name the heat level, pan or pot size where relevant, a time estimate, and a visual or sensory doneness cue (e.g. \"until translucent\", \"until shimmering\"). Prep and assembly steps (chopping, mixing, plating) do NOT involve a stove — never write \"no heat\", \"off heat\", or a heat level for them; just state the action.",
  "Include prep detail inside steps (dice size, drain or pat dry) instead of assuming knowledge.",
  "One action per step. Use as many steps as the recipe needs; do not compress multiple actions into one step, and do not pad simple recipes.",
  "Expiring-first is a strong PREFERENCE, not a hard gate: the inventory is sorted most-urgent first, so prefer building each dish around the soonest-expiring items and include at least one whenever it fits a coherent dish. But never return empty or skip a good recipe just because the urgent items are awkward together — if they don't fit, cook a coherent dish from the rest of the inventory. A coherent dish that ignores the urgent items beats no dish at all.",
  "Do NOT force multiple expiring items into one dish. Combine two or more expiring items only when they genuinely belong together in the same dish; if they don't make sense together, build a coherent dish around just one and leave the rest for another suggestion. Coherence always wins over cramming — one expiring item used well beats several jammed into a dish that no one would actually cook.",
  "Missing-ingredient cap: beyond common pantry staples (oil, salt, pepper, common dried spices, basic condiments), a dish may rely on AT MOST 3 key ingredients the household does NOT have. If a dish would need more than 3 missing key ingredients, do not propose it — choose something the household can mostly make from what it has.",
  "Ingredient names must match household item names where used; mark required=true only for ingredients taken from what the household has. Pantry staples (oil, salt, garlic, spices) are required=false.",
  "Ingredient amounts: for whole produce and naturally-countable items, use counts and set countable=true — e.g. '1 large onion', '2 tomatoes', '3 eggs', '1 bell pepper', '2 slices bread'. For ingredients genuinely sold and measured by weight or volume, use g/ml/kg/L and set countable=false — e.g. '400g minced meat', '200g rice', '150g cheddar', '100ml milk'. Never express a whole vegetable or fruit in grams, and never express meat, grains, or liquids as a bare count.",
  "Never include avoided ingredients; list any avoidance categories a recipe touches in avoidanceTags.",
  "Respect the prompt filters: matching mealType, timeMinutes within max time, and include the vibe/tag in tags when one is set.",
  "Empty result: return an empty recipes array whenever the inventory has no real COOKING ingredients to build a coherent dish from — this INCLUDES a fridge that holds only ready-to-eat / snack / confectionery / drink products (e.g. only popcorn, chips, a chocolate croissant, a candy bar, soda). In that case do NOT invent a dish; return empty. Also return empty when the only items simply do not belong in any single real dish. If — and only if — there ARE real cooking ingredients that form a coherent, appetizing dish, you MUST return at least one; do not return empty just because the expiring items don't fit together or the best dish ignores some items. Never invent food the household doesn't have. When the honest choice is between a nonsense recipe and no recipe, ALWAYS return no recipe.",
  "INTERNAL CONSISTENCY (hard rule): within a single recipe the title, description, ingredients, and steps must all describe the SAME dish made from the SAME household foods. Never output a recipe whose title names a food that is not in its own ingredients/steps, or whose steps are about a different food than the title (e.g. title 'Chocolate croissant' with popcorn ingredients and steps). If you cannot produce an internally consistent recipe from the available food, omit it rather than forcing one.",
].join("\n");

// Most-recent distinct recipe titles for a household — used to steer fresh
// generations away from dishes already suggested. Best-effort: on any error it
// returns [] so generation still proceeds.
async function fetchRecentRecipeTitles(
  supabase: SupabaseClient,
  householdId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("recipes")
    .select("title")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(15);
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const row of data ?? []) {
    const title = (row.title as string | null)?.trim();
    if (title && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase());
      titles.push(title);
    }
  }
  return titles;
}

function buildMessages(
  input: GenerateRecipesRequest,
  variant: "confident" | "alternative",
  exclude?: { title: string; ingredients: string[] },
  recentTitles: string[] = [],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const lang = languageName(input.language);
  const user = [
    recentTitles.length
      ? `Recently suggested to this household — avoid repeating these or close variants unless nothing else coherent is possible: ${recentTitles.join("; ")}.`
      : "",
    `Language: write the ENTIRE recipe in ${lang} — title, description, every step, all tags, AND all ingredient names. Do NOT mix languages within a recipe. If an item name is in another language, translate it into ${lang} (keep it the natural name a ${lang} cook would use). The only exception is proper brand names, which stay as-is.`,
    `Cooking mode: ${input.cookingMode ?? "household"}.`,
    `Servings: ${input.servings ?? 2}.`,
    `Premium optimized: ${input.isPremium ? "yes" : "no"}.`,
    `Hard serving constraint: recipe servings MUST equal ${input.servings ?? 2}.`,
    `Hard dietary constraints: ${
      input.avoidances?.length
        ? `avoid ${input.avoidances.join(", ")}. Do not include these in ingredients, steps, substitutions, or optional toppings.`
        : "none"
    }`,
    "What the household has:",
    ...formatInventory(input.inventory ?? []),
    "Prompt filters:",
    `- meal type: ${input.filters?.mealType ?? "any"}`,
    `- max time: ${input.filters?.maxMinutes != null ? `${input.filters.maxMinutes} minutes` : "any"}`,
    `- min time: ${input.filters?.minMinutes != null ? `${input.filters.minMinutes} minutes` : "any"}`,
    `- vibe/tag: ${input.filters?.vibe ?? "any"}`,
    input.filters?.cuisine && input.filters.cuisine !== "any"
      ? `- cuisine: ${input.filters.cuisine.replace(/_/g, " ")} — strongly prefer this cuisine, but if the inventory cannot make a coherent ${input.filters.cuisine.replace(/_/g, " ")} dish, fall back to the best coherent dish. Never sacrifice coherence for the cuisine.`
      : "- cuisine: any",
    input.filters?.basePreference && input.filters.basePreference !== "anything"
      ? `- build around: ${input.filters.basePreference} — a guide, not a hard constraint. If this base cannot form a coherent dish from the available inventory, fall back to the best coherent recipe. Never sacrifice quality or coherence to satisfy the base.`
      : "- build around: anything",
    variant === "alternative"
      ? `Return 1 recipe card: a genuinely different dish from the one already chosen for this household.${
        exclude
          ? ` Do NOT make "${exclude.title}" or any close variant of it, and do not build around the same core ingredients (${exclude.ingredients.join(", ")}). Choose a different main technique or cuisine.`
          : " Pick a different main technique or cuisine than the predictable first choice."
      } If no coherent second dish exists, return an empty recipes array instead of forcing one.`
      : "Return 1 recipe card: your single most confident pick for what this household has. If the household cannot make any coherent real dish, return an empty recipes array instead of inventing one.",
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

// Last-line defence on the model's title: kill quotes/trailing punctuation, a
// leading filler adjective, and runaway length so a slip never reaches the UI.
function cleanTitle(raw: string): string {
  let t = (raw ?? "").trim().replace(/\s+/g, " ");
  t = t.replace(/^["'“”]+|["'“”]+$/g, "").replace(/[.!]+$/g, "");
  t = t.replace(
    /^(delicious|tasty|easy|quick|simple|amazing|ultimate|perfect|hearty|healthy|homemade|classic|wholesome|yummy)\s+/i,
    "",
  );
  if (t.length > 48) {
    const cut = t.slice(0, 48);
    // Prefer a clean phrase boundary so we don't strand "...and roasted".
    const boundary = Math.max(cut.lastIndexOf(" with "), cut.lastIndexOf(" and "), cut.lastIndexOf(", "));
    t = (boundary > 20 ? cut.slice(0, boundary) : cut.replace(/\s+\S*$/, "")).trim();
    // Drop a trailing connector left dangling by a word-boundary cut.
    t = t.replace(/[\s,]+(and|with|in|on|of|the|a|&)$/i, "").trim();
  }
  return t || raw.trim();
}

// Sorted, normalized ingredient-name set — identifies recipes that are the
// same dish under a different title.
function ingredientNameSet(ingredients: { name: string }[]) {
  return new Set(
    ingredients
      .map((ingredient) => ingredient.name.toLowerCase().trim().replace(/\s+/g, " "))
      .filter(Boolean),
  );
}

// Jaccard overlap of two name sets: |intersection| / |union|. 1 = identical.
function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const name of a) if (b.has(name)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// Deliberately narrow, model-independent backstop for the one violation the
// model still slips through despite the prompt: a clearly-dessert fruit cooked
// into a savory egg/fry base (e.g. banana frittata, blueberry stir-fry). Kept
// tight on purpose — fruit + cheese is a real pairing (cheese board), so it is
// NOT caught here; that taste call is left to the model.
const DESSERT_ONLY_FRUIT = [
  "banana", "strawberr", "blueberr", "raspberr", "blackberr", "watermelon", "fig",
];
const SAVORY_COOK_SIGNAL = [
  "frittata", "omelet", "scramble", "stir-fry", "stir fry", "stirfry", "quiche",
];

function isIncoherent(recipe: AiRecipeCard): boolean {
  const dish = [recipe.title, ...recipe.steps].join(" ").toLowerCase();
  if (!SAVORY_COOK_SIGNAL.some((signal) => dish.includes(signal))) return false;
  return recipe.ingredients
    .filter((ingredient) => ingredient.required)
    .some((ingredient) =>
      DESSERT_ONLY_FRUIT.some((fruit) => ingredient.name.toLowerCase().includes(fruit)),
    );
}

// Ready-to-eat / snack / confectionery products that are not real cooking
// ingredients. Category from the household item (snacks/drinks) or a keyword
// on the ingredient name catches products the model dressed up as a recipe.
const READY_TO_EAT_CATEGORIES = new Set(["snacks", "drinks"]);
const READY_TO_EAT_KEYWORDS = [
  "popcorn", "chips", "crisps", "candy", "chocolate", "croissant", "soda", "cola",
  "cookie", "biscuit", "wafer", "pastry", "donut", "doughnut", "gummy", "marshmallow",
  "pretzel", "nachos", "ice cream", "lollipop", "energy drink", "candy bar", "chocolate bar",
];

type InventoryItem = { name?: string; normalized_name?: string; category?: string };

function isReadyToEatIngredient(name: string, inventory: InventoryItem[]): boolean {
  const n = name.toLowerCase();
  if (READY_TO_EAT_KEYWORDS.some((keyword) => n.includes(keyword))) return true;
  const match = inventory.find((item) => {
    const itemName = (item.normalized_name ?? item.name ?? "").toLowerCase();
    return itemName.length > 0 && (n.includes(itemName) || itemName.includes(n));
  });
  return match ? READY_TO_EAT_CATEGORIES.has((match.category ?? "").toLowerCase()) : false;
}

// Safety net for the "only snacks in the fridge" case: if every required
// ingredient is a ready-to-eat product, there is no real dish here — drop it so
// the pipeline returns empty and the app shows "nothing to cook".
function isReadyToEatOnly(recipe: AiRecipeCard, inventory: InventoryItem[]): boolean {
  const required = recipe.ingredients.filter((ingredient) => ingredient.required);
  if (required.length === 0) return false;
  return required.every((ingredient) => isReadyToEatIngredient(ingredient.name, inventory));
}

function violatesAvoidances(recipe: AiRecipeCard, avoidances: string[]) {
  if (avoidances.length === 0) return false;
  const searchable = [
    ...recipe.avoidanceTags,
    ...recipe.ingredients.map((ingredient) => ingredient.name),
    ...recipe.steps,
  ];

  return avoidances.some((avoidance) =>
    searchable.some((value) => mentionsAvoidance(value, avoidance)),
  );
}

const URGENCY_RANK: Record<string, number> = { urgent: 0, use_soon: 1 };

function formatInventory(inventory: NonNullable<GenerateRecipesRequest["inventory"]>) {
  if (inventory.length === 0) return ["- empty or unknown"];

  // Sort most-urgent first so the model reads expiring items at the top and
  // builds around them (reinforced by the expiring-first rule in SYSTEM_PROMPT).
  const sorted = [...inventory].sort(
    (a, b) => (URGENCY_RANK[a.urgency ?? ""] ?? 2) - (URGENCY_RANK[b.urgency ?? ""] ?? 2),
  );

  return sorted.map((item) => {
    const name = item.name ?? item.normalized_name ?? "unknown item";
    const normalized = item.normalized_name ?? name.toLowerCase();
    const amount =
      item.net_amount != null && item.net_unit
        ? `${item.net_amount}${item.net_unit}`
        : item.quantity != null
          ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
          : "unknown amount";
    // `id=` lets card mode reference items by id in usedIngredientIds.
    const idPart = item.id ? `id=${item.id}; ` : "";
    return `- ${idPart}${name} (${normalized}); category=${item.category ?? "unknown"}; urgency=${item.urgency ?? "unknown"}; amount=${amount}; partial=${item.partial_state ?? "unknown"}`;
  });
}

// ---------------------------------------------------------------------------
// Phase 1: cards
// ---------------------------------------------------------------------------

type InventoryItem = NonNullable<GenerateRecipesRequest["inventory"]>[number];

async function handleCards(
  input: GenerateRecipesRequest,
  gate: { attemptId?: string; supabase?: ReturnType<typeof createClient>; premium?: boolean; userId?: string },
  client: OpenAI,
  recentTitles: string[],
): Promise<Response> {
  const wantCount = gate.premium === true ? 2 : 1;
  const inventory = input.inventory ?? [];
  const itemsById = new Map<string, InventoryItem>(
    inventory.filter((item) => item.id).map((item) => [item.id as string, item]),
  );

  const runCards = () =>
    client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1500,
      reasoning_effort: "low",
      messages: buildCardMessages(input, recentTitles, wantCount),
      response_format: {
        type: "json_schema",
        json_schema: { name: "recipe_cards", strict: true, schema: CARD_SCHEMA },
      },
    });

  let promptTokens = 0;
  let completionTokens = 0;
  let raw: AiRecipeCardLite[] = [];
  let cards: AiRecipeCardLite[] = [];
  const dropReasons: string[] = [];

  try {
    // Bounded retry: one extra attempt if every card failed validation.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await runCards();
      promptTokens += response.usage?.prompt_tokens ?? 0;
      completionTokens += response.usage?.completion_tokens ?? 0;
      const text = response.choices[0]?.message?.content ?? "";
      raw = (JSON.parse(text) as { recipes: AiRecipeCardLite[] }).recipes ?? [];
      cards = validateCards(raw, input.avoidances ?? [], itemsById, dropReasons);
      if (cards.length > 0) break;
    }

    for (const card of cards) card.title = cleanTitle(card.title);

    console.info("[generate-recipes] cards", {
      want: wantCount, raw: raw.length, kept: cards.length,
      titles: cards.map((c) => c.title), promptTokens, completionTokens, dropReasons,
    });

    const payload = { source: "ai", recipes: cards };
    if (gate.attemptId) {
      await gate.supabase
        ?.from("recipe_generation_attempts")
        .update({
          status: cards.length === 0 ? "failed" : "completed",
          response_json: cards.length === 0
            ? { source: "empty_diagnostic", raw: raw.length, dropReasons }
            : payload,
          error_message: cards.length === 0 ? "no_recipes_generated" : null,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          completed_at: new Date().toISOString(),
        })
        .eq("id", gate.attemptId);
    }
    if (cards.length > 0 && !(await claimFreeGeneration(gate))) {
      return Response.json({ error: "recipe_generation_quota_exceeded" }, { status: 402 });
    }
    return Response.json(payload);
  } catch (error) {
    console.error("[generate-recipes] cards failed", error);
    if (gate.attemptId) {
      await gate.supabase
        ?.from("recipe_generation_attempts")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "cards_failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", gate.attemptId);
    }
    return Response.json({ error: "generation_failed" }, { status: 500 });
  }
}

// Deterministic safety layer on top of reasoning — drops cards the model should
// not have produced. Returns only the cards that pass.
function validateCards(
  raw: AiRecipeCardLite[],
  avoidances: string[],
  itemsById: Map<string, InventoryItem>,
  dropReasons: string[],
): AiRecipeCardLite[] {
  const keptSignatures: Set<string>[] = [];
  const kept: AiRecipeCardLite[] = [];

  for (const card of raw) {
    const ids = (card.usedIngredientIds ?? []).filter((id) => itemsById.has(id));
    if (ids.length === 0) {
      dropReasons.push(`"${card.title}": no inventory items`);
      continue;
    }
    const usedItems = ids.map((id) => itemsById.get(id)!);
    const usedNames = usedItems.map((i) => (i.name ?? i.normalized_name ?? "").toLowerCase());
    const titleLc = card.title.toLowerCase();
    const savory = SAVORY_COOK_SIGNAL.some((signal) => titleLc.includes(signal));

    if (savory && usedNames.some((n) => DESSERT_ONLY_FRUIT.some((f) => n.includes(f)))) {
      dropReasons.push(`"${card.title}": incoherent (dessert fruit in savory dish)`);
      continue;
    }
    if (usedItems.some((i) => i.category === "drinks")) {
      dropReasons.push(`"${card.title}": uses a drink as an ingredient`);
      continue;
    }
    if (savory && usedItems.some((i) => i.category === "snacks")) {
      dropReasons.push(`"${card.title}": cooks a snack into a savory dish`);
      continue;
    }
    if (
      avoidances.some((a) =>
        mentionsAvoidance(card.title, a) || usedNames.some((n) => mentionsAvoidance(n, a)),
      )
    ) {
      dropReasons.push(`"${card.title}": touches an avoidance`);
      continue;
    }
    const signature = new Set(ids);
    if (keptSignatures.some((kept) => jaccard(signature, kept) >= 0.6)) {
      dropReasons.push(`"${card.title}": near-duplicate`);
      continue;
    }
    keptSignatures.push(signature);
    kept.push({ ...card, usedIngredientIds: ids });
  }
  return kept;
}

function buildCardMessages(
  input: GenerateRecipesRequest,
  recentTitles: string[],
  wantCount: number,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const lang = languageName(input.language);
  const user = [
    recentTitles.length
      ? `Recently suggested to this household — avoid repeating these or close variants unless nothing else coherent is possible: ${recentTitles.join("; ")}.`
      : "",
    `Language: write title, description and tags in ${lang}.`,
    `Cooking mode: ${input.cookingMode ?? "household"}.`,
    `Hard dietary constraints: ${
      input.avoidances?.length ? `avoid ${input.avoidances.join(", ")}.` : "none"
    }`,
    "What the household has (use the id values in usedIngredientIds):",
    ...formatInventory(input.inventory ?? []),
    "Prompt filters:",
    `- meal type: ${input.filters?.mealType ?? "any"}`,
    `- max time: ${input.filters?.maxMinutes != null ? `${input.filters.maxMinutes} minutes` : "any"}`,
    `- vibe/tag: ${input.filters?.vibe ?? "any"}`,
    input.filters?.cuisine && input.filters.cuisine !== "any"
      ? `- cuisine: ${input.filters.cuisine.replace(/_/g, " ")} — strongly prefer this cuisine, but if the inventory cannot make a coherent ${input.filters.cuisine.replace(/_/g, " ")} dish, fall back to the best coherent dish. Never sacrifice coherence for the cuisine.`
      : "- cuisine: any",
    input.filters?.basePreference && input.filters.basePreference !== "anything"
      ? `- build around: ${input.filters.basePreference} — a guide, not a hard constraint. Fall back to the best coherent recipe if the base does not fit. Never sacrifice coherence for the base.`
      : "- build around: anything",
    wantCount === 2
      ? "Return EXACTLY 2 recipe cards that are genuinely different dishes (different main technique or cuisine; neither a variant of the other). If only one coherent dish exists, return 1. If none, return an empty array."
      : "Return EXACTLY 1 recipe card: your most confident coherent pick. If none is coherent, return an empty array.",
    "These are lightweight cards: title, one-sentence description, usedIngredientIds, tags (max 3), mealType, category (course type e.g. main/salad/breakfast), and timeMinutes. Do NOT write steps or ingredient amounts.",
    "usedIngredientIds MUST be ids copied verbatim from the inventory list above, only for items the dish actually uses.",
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

// ---------------------------------------------------------------------------
// Phase 2: expand
// ---------------------------------------------------------------------------

async function handleExpand(
  input: GenerateRecipesRequest,
  authHeader: string | null,
  apiKey: string,
): Promise<Response> {
  const card = input.expandCard;
  if (!card?.title) {
    return Response.json({ error: "missing_expand_card" }, { status: 400 });
  }
  const auth = await authenticate(authHeader);
  if (auth.response) return auth.response;
  const limited = await consumeExpandQuota(auth.supabase, auth.userId);
  if (limited) return limited;

  const client = new OpenAI({ apiKey });
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2000,
      // The dish is already chosen and validated at the card stage, so expansion
      // is elaboration, not a coherence decision — "minimal" reasoning keeps it
      // fast. (Selection quality lives in the card phase, which runs "low".)
      reasoning_effort: "minimal",
      messages: buildExpandMessages(input, card),
      response_format: {
        type: "json_schema",
        json_schema: { name: "recipe_detail", strict: true, schema: EXPAND_SCHEMA },
      },
    });
    const text = response.choices[0]?.message?.content ?? "";
    const detail = JSON.parse(text) as {
      ingredients: { name: string; amount: string; required: boolean; matchKey: string | null }[];
      steps: string[];
    };

    const servings = input.servings ?? 2;
    // Drop keys the model invented; the client then falls back to name matching.
    const householdKeys = new Set(
      (input.inventory ?? []).map((item) => item.normalized_name ?? item.name?.toLowerCase()),
    );
    const ingredients = detail.ingredients.map((ing) => ({
      ...ing,
      matchKey: ing.matchKey && householdKeys.has(ing.matchKey) ? ing.matchKey : null,
      countable: deriveCountable(ing.amount),
    }));
    const recipe: AiRecipeCard = {
      title: cleanTitle(card.title),
      description: card.description ?? "",
      timeMinutes: card.timeMinutes ?? estimateTime(detail.steps.length),
      complexity: deriveComplexity(detail.steps.length, card.timeMinutes ?? 0),
      servings,
      mealType: card.mealType ?? "dinner",
      category: card.category ?? "",
      tags: card.tags ?? [],
      avoidanceTags: deriveAvoidanceTags(ingredients, input.avoidances ?? []),
      ingredients,
      steps: detail.steps,
    };

    console.info("[generate-recipes] expand", {
      title: recipe.title,
      ingredients: ingredients.length,
      steps: detail.steps.length,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    });
    return Response.json({ source: "ai", recipe });
  } catch (error) {
    console.error("[generate-recipes] expand failed", error);
    return Response.json({ error: "expand_failed" }, { status: 500 });
  }
}

// Lean system prompt for expansion — only step/ingredient rules. The heavy
// selection/coherence rules in SYSTEM_PROMPT are irrelevant once the dish is
// chosen, and including them costs reasoning + latency for no benefit.
const EXPAND_SYSTEM_PROMPT = [
  "You write the full ingredient list and steps for a dish that has ALREADY been chosen. Keep the dish as given; do not change it.",
  "Ingredient names should match household item names where used. required=true only for items taken from the fridge; required=false for pantry staples (oil, salt, garlic, spices).",
  "matchKey: for an ingredient taken from the household, copy that item's canonical name EXACTLY as written in parentheses in the household list (never translated or reworded); null for anything not from the household list.",
  "Ingredient amounts: counts for whole/countable produce (e.g. '2 tomatoes', '3 eggs'); weight or volume otherwise (e.g. '400g rice', '100ml milk').",
  "Write steps for a beginner cook: cooking steps (stove/oven) name the heat level, pan or pot size where relevant, a time estimate, and a doneness cue. Prep and assembly steps just state the action — never write \"no heat\" or a heat level for them.",
  "One action per step. At most 8 steps and at most 12 ingredients. Do not pad.",
  "Never include avoided ingredients.",
].join("\n");

function buildExpandMessages(
  input: GenerateRecipesRequest,
  card: NonNullable<GenerateRecipesRequest["expandCard"]>,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const lang = languageName(input.language);
  const servings = input.servings ?? 2;
  const inventory = input.inventory ?? [];
  const usedNames = card.usedIngredientNames ?? [];

  const user = [
    `Expand this chosen dish into a full recipe: "${card.title}"${card.description ? ` — ${card.description}` : ""}.`,
    `Write everything in ${lang}. Servings MUST equal ${servings}.`,
    usedNames.length ? `Build it around these household items: ${usedNames.join(", ")}.` : "",
    `Hard dietary constraints: ${
      input.avoidances?.length
        ? `avoid ${input.avoidances.join(", ")}; do not include them anywhere.`
        : "none"
    }`,
    "What the household has:",
    ...formatInventory(inventory),
    "Return ONLY ingredients and steps for THIS dish.",
  ].join("\n");

  return [
    { role: "system", content: EXPAND_SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

// A full pantry (~200 lots) serializes to ~50k chars; anything far past that is
// not a real request.
const EXPAND_MAX_BODY_CHARS = 100_000;
// Premium makes up to 50 generations/day × 2 cards, each prefetch-expanded,
// plus detail opens. Free gets one lifetime generation, so 20 covers reopening
// saved recipes.
const EXPAND_DAILY_LIMIT_PREMIUM = 200;
const EXPAND_DAILY_LIMIT_FREE = 20;

// Per-user rolling 24h cap on expand calls; records this call when allowed.
// ponytail: count-then-insert, so parallel calls can overshoot by a few; use an
// RPC with a row lock if that ever matters.
async function consumeExpandQuota(
  supabase: SupabaseClient,
  userId: string,
): Promise<Response | null> {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [profileResult, countResult] = await Promise.all([
    supabase.from("profiles").select("tier, active_household_id").eq("id", userId).single(),
    supabase
      .from("recipe_expand_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayAgo),
  ]);
  const profile = profileResult.data as { tier: string; active_household_id: string | null } | null;
  if (profileResult.error || !profile) {
    return Response.json({ error: "profile_not_found" }, { status: 403 });
  }
  if (countResult.error) {
    return Response.json({ error: "expand_quota_failed" }, { status: 500 });
  }

  let premium = profile.tier === "premium" || profile.tier === "household_premium";
  if (!premium && profile.active_household_id) {
    const { data: household } = await supabase
      .from("households")
      .select("plan_tier")
      .eq("id", profile.active_household_id)
      .maybeSingle();
    premium = (household as { plan_tier: string } | null)?.plan_tier === "household_premium";
  }

  const limit = premium ? EXPAND_DAILY_LIMIT_PREMIUM : EXPAND_DAILY_LIMIT_FREE;
  if ((countResult.count ?? 0) >= limit) {
    return Response.json({ error: "recipe_expand_rate_limited" }, { status: 429 });
  }

  const { error } = await supabase.from("recipe_expand_events").insert({ user_id: userId });
  if (error) {
    return Response.json({ error: "expand_quota_failed" }, { status: 500 });
  }
  return null;
}

// Lightweight auth for expand: validates the bearer token only. Mirrors the
// head of acquireGenerationAttempt; the quota lives in consumeExpandQuota.
async function authenticate(authHeader: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { response: Response.json({ error: "missing_supabase_service_config" }, { status: 500 }) };
  }
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: Response.json({ error: "missing_authorization" }, { status: 401 }) };
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const jwt = authHeader.replace("Bearer ", "");
  const { data: userResult, error: userError } = await supabase.auth.getUser(jwt);
  const userId = userResult.user?.id;
  if (userError || !userId) {
    return { response: Response.json({ error: "invalid_authorization" }, { status: 401 }) };
  }
  return { supabase, userId };
}

// ---- Fields derived in code instead of generated (saves output tokens) ----

// Weight/volume amount → measured (not countable); bare counts → countable.
function deriveCountable(amount: string): boolean {
  return !/\d\s*(g|kg|ml|l|cl|dl)\b/i.test(amount);
}

function deriveComplexity(stepCount: number, timeMinutes: number): AiRecipeCard["complexity"] {
  if (stepCount <= 4 && (timeMinutes === 0 || timeMinutes <= 20)) return "simple";
  if (stepCount >= 8 || timeMinutes >= 45) return "involved";
  return "medium";
}

function deriveAvoidanceTags(ingredients: { name: string }[], avoidances: string[]): string[] {
  if (avoidances.length === 0) return [];
  return avoidances.filter((a) => ingredients.some((i) => mentionsAvoidance(i.name, a)));
}

function estimateTime(stepCount: number): number {
  return Math.max(10, stepCount * 5);
}
