import OpenAI from "npm:openai@^4.77.0";
import { createClient } from "npm:@supabase/supabase-js@^2.46.1";

type GenerateRecipesRequest = {
  inventory?: Array<{
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
  };
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
  ingredients: { name: string; amount: string; required: boolean; countable: boolean }[];
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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "missing_openai_api_key" }, { status: 500 });
  }

  const input = await req.json().catch(() => ({})) as GenerateRecipesRequest;
  const authHeader = req.headers.get("Authorization");
  const gate = await acquireGenerationAttempt(input, authHeader);
  if (gate.response) return gate.response;

  // Each call generates a single recipe: premium runs two variants in
  // parallel, so wall-clock latency is one recipe instead of two. Input
  // tokens are paid per call but are a rounding error next to output.
  // The confident pick runs cool for sensible, predictable dishes/titles; the
  // alternative runs hot so it diverges from the obvious choice.
  const variants: Array<"confident" | "alternative"> = gate.premium === true
    ? ["confident", "alternative"]
    : ["confident"];

  try {
    const client = new OpenAI({ apiKey });
    const settled = await Promise.allSettled(
      variants.map((variant) =>
        client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 6000,
          temperature: variant === "alternative" ? 0.7 : 0.5,
          messages: buildMessages(input, variant),
          response_format: {
            type: "json_schema",
            json_schema: { name: "recipes", strict: true, schema: RECIPE_SCHEMA },
          },
        })
      ),
    );

    const responses = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) =>
        (result as PromiseFulfilledResult<OpenAI.Chat.Completions.ChatCompletion>).value
      );
    // One variant failing shouldn't sink the whole generation for premium.
    if (responses.length === 0) {
      throw (settled[0] as PromiseRejectedResult).reason;
    }

    const allRecipes = responses.flatMap((response) => {
      const text = response.choices[0]?.message?.content ?? "";
      return (JSON.parse(text) as { recipes: AiRecipeCard[] }).recipes;
    });

    const avoidances = input.avoidances ?? [];
    // Dedupe by ingredient set, not title: the premium variants often share the
    // same ingredients under different names (e.g. "...sourdough toast" vs
    // "...toast"), which is a duplicate, not a real alternative.
    const seenSignatures = new Set<string>();
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
      const signature = ingredientSignature(recipe.ingredients);
      if (seenSignatures.has(signature)) {
        dropReasons.push(`"${recipe.title}": duplicate signature`);
        return false;
      }
      seenSignatures.add(signature);
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

  // These three reads are independent (keyed on userId/householdId), so run
  // them concurrently. Auth is already validated above; the gate checks below
  // still run in the same order and reject before the attempt insert.
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [profileResult, householdResult, dailyCountResult, monthlyCountResult] = await Promise.all([
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
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayAgo),
    supabase
      .from("recipe_generation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart),
  ]);
  const profile = profileResult.data;
  const profileError = profileResult.error;
  const household = householdResult.data;
  const dailyCount = dailyCountResult.count;
  const monthlyCount = monthlyCountResult.count;

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
  if (!premium && profile.free_recipe_generation_used_at) {
    return { response: Response.json({ error: "recipe_generation_quota_exceeded" }, { status: 402 }) };
  }

  const dailyLimit = premium ? 50 : 5;
  if ((dailyCount ?? 0) >= dailyLimit) {
    return { response: Response.json({ error: "recipe_generation_rate_limited" }, { status: 429 }) };
  }

  const RECIPE_MONTHLY_CAP = 150;
  if (premium && (monthlyCount ?? 0) >= RECIPE_MONTHLY_CAP) {
    return { response: Response.json({ error: "recipe_generation_monthly_limit" }, { status: 429 }) };
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
    return { attemptId: insert.data.id as string, supabase, premium };
  }
  if (insert.error.code !== "23505") {
    return { response: Response.json({ error: "generation_lock_failed" }, { status: 500 }) };
  }

  const { data: existing } = await supabase
    .from("recipe_generation_attempts")
    .select("id, status, response_json, created_at")
    .eq("user_id", userId)
    .eq("idempotency_key", input.idempotencyKey)
    .single();

  if (existing?.status === "completed" && existing.response_json) {
    return { response: Response.json(existing.response_json) };
  }
  if (existing?.status === "processing") {
    return { response: Response.json({ source: "processing" }, { status: 202 }) };
  }

  if (existing?.id) {
    await supabase
      .from("recipe_generation_attempts")
      .update({ status: "processing", error_message: null, completed_at: null })
      .eq("id", existing.id);
    return { attemptId: existing.id as string, supabase, premium };
  }

  return { response: Response.json({ error: "generation_lock_conflict" }, { status: 409 }) };
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
  "Write steps for a beginner cook: each step names the heat level, pan or pot size where relevant, a time estimate, and a visual or sensory doneness cue (e.g. \"until translucent\", \"until shimmering\").",
  "Include prep detail inside steps (dice size, drain or pat dry) instead of assuming knowledge.",
  "One action per step. Use as many steps as the recipe needs; do not compress multiple actions into one step, and do not pad simple recipes.",
  "Every recipe must use at least one item the household has, and prefer items with higher urgency.",
  "Ingredient names must match household item names where used; mark required=true only for ingredients taken from what the household has. Pantry staples (oil, salt, garlic, spices) are required=false.",
  "Ingredient amounts: for whole produce and naturally-countable items, use counts and set countable=true — e.g. '1 large onion', '2 tomatoes', '3 eggs', '1 bell pepper', '2 slices bread'. For ingredients genuinely sold and measured by weight or volume, use g/ml/kg/L and set countable=false — e.g. '400g minced meat', '200g rice', '150g cheddar', '100ml milk'. Never express a whole vegetable or fruit in grams, and never express meat, grains, or liquids as a bare count.",
  "Never include avoided ingredients; list any avoidance categories a recipe touches in avoidanceTags.",
  "Respect the prompt filters: matching mealType, timeMinutes within max time, and include the vibe/tag in tags when one is set.",
  "Empty result is allowed and correct: if the household has too little food, or nothing in it forms a single coherent, appetizing real dish (even from a small subset), return an empty recipes array. Returning nothing beats inventing a forced or nonsensical dish — never pad an empty fridge into a recipe just to have an answer.",
].join("\n");

function buildMessages(
  input: GenerateRecipesRequest,
  variant: "confident" | "alternative",
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const lang = languageName(input.language);
  const user = [
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
    variant === "alternative"
      ? "Return 1 recipe card: a clearly different alternative to the most obvious dish for these items — pick a different main technique or cuisine than the predictable first choice. If no coherent second dish exists, return an empty recipes array instead of forcing one."
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
  if (t.length > 48) t = t.slice(0, 48).replace(/\s+\S*$/, "").trim();
  return t || raw.trim();
}

// Sorted, normalized ingredient-name set — identifies recipes that are the
// same dish under a different title.
function ingredientSignature(ingredients: { name: string }[]) {
  return ingredients
    .map((ingredient) => ingredient.name.toLowerCase().trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort()
    .join("|");
}

function violatesAvoidances(recipe: AiRecipeCard, avoidances: string[]) {
  if (avoidances.length === 0) return false;
  const normalizedAvoidances = avoidances.map((avoidance) => avoidance.toLowerCase().trim());
  const searchable = [
    ...recipe.avoidanceTags,
    ...recipe.ingredients.map((ingredient) => ingredient.name),
    ...recipe.steps,
  ].map((value) => value.toLowerCase());

  return normalizedAvoidances.some((avoidance) =>
    searchable.some((value) => value.includes(avoidance)),
  );
}

function formatInventory(inventory: NonNullable<GenerateRecipesRequest["inventory"]>) {
  if (inventory.length === 0) return ["- empty or unknown"];

  return inventory.map((item) => {
    const name = item.name ?? item.normalized_name ?? "unknown item";
    const normalized = item.normalized_name ?? name.toLowerCase();
    const amount =
      item.net_amount != null && item.net_unit
        ? `${item.net_amount}${item.net_unit}`
        : item.quantity != null
          ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
          : "unknown amount";
    return `- ${name} (${normalized}); category=${item.category ?? "unknown"}; urgency=${item.urgency ?? "unknown"}; amount=${amount}; partial=${item.partial_state ?? "unknown"}`;
  });
}
