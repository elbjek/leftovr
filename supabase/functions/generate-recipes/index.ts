import Anthropic from "npm:@anthropic-ai/sdk@^0.24.0";
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
  filters?: {
    mealType?: "breakfast" | "lunch" | "dinner" | "snack";
    maxMinutes?: number;
    minMinutes?: number;
    vibe?: string;
  };
};

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

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "missing_anthropic_api_key" }, { status: 500 });
  }

  const input = await req.json().catch(() => ({})) as GenerateRecipesRequest;
  const authHeader = req.headers.get("Authorization");
  const gate = await acquireGenerationAttempt(input, authHeader);
  if (gate.response) return gate.response;

  // Each call generates a single recipe: premium runs two variants in
  // parallel, so wall-clock latency is one recipe instead of two. Input
  // tokens are paid per call but are a rounding error next to output.
  const prompts = gate.premium === true
    ? [buildPrompt(input, "confident"), buildPrompt(input, "alternative")]
    : [buildPrompt(input, "confident")];

  try {
    const client = new Anthropic({ apiKey });
    const settled = await Promise.allSettled(
      prompts.map((prompt) =>
        client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 6000,
          messages: [{ role: "user", content: prompt }],
          output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
        })
      ),
    );

    const responses = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => (result as PromiseFulfilledResult<Anthropic.Message>).value);
    // One variant failing shouldn't sink the whole generation for premium.
    if (responses.length === 0) {
      throw (settled[0] as PromiseRejectedResult).reason;
    }

    const allRecipes = responses.flatMap((response) => {
      const text = response.content.find((block) => block.type === "text")?.text ?? "";
      return (JSON.parse(text) as { recipes: AiRecipeCard[] }).recipes;
    });

    const avoidances = input.avoidances ?? [];
    const seenTitles = new Set<string>();
    const recipes = allRecipes.filter((recipe) => {
      const titleKey = recipe.title.toLowerCase().trim();
      if (seenTitles.has(titleKey)) return false;
      seenTitles.add(titleKey);
      return (
        recipe.ingredients.length > 0 &&
        recipe.steps.length > 0 &&
        !violatesAvoidances(recipe, avoidances)
      );
    });

    console.info("[generate-recipes] returning recipes", {
      calls: responses.length,
      raw: allRecipes.length,
      kept: recipes.length,
      titles: recipes.map((recipe) => recipe.title),
    });

    const payload = { source: "ai", recipes };
    if (gate.attemptId) {
      await gate.supabase
        ?.from("recipe_generation_attempts")
        .update({
          status: "completed",
          response_json: payload,
          prompt_tokens: responses.reduce(
            (sum, response) => sum + (response.usage?.input_tokens ?? 0),
            0,
          ),
          completion_tokens: responses.reduce(
            (sum, response) => sum + (response.usage?.output_tokens ?? 0),
            0,
          ),
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, tier, active_household_id, free_recipe_generation_used_at")
    .eq("id", userId)
    .single();
  if (profileError || !profile) {
    return { response: Response.json({ error: "profile_not_found" }, { status: 403 }) };
  }
  if (profile.active_household_id !== input.householdId) {
    return { response: Response.json({ error: "household_mismatch" }, { status: 403 }) };
  }

  const { data: household } = await supabase
    .from("households")
    .select("plan_tier")
    .eq("id", input.householdId)
    .maybeSingle();
  const premium =
    profile.tier === "premium" ||
    profile.tier === "household_premium" ||
    household?.plan_tier === "household_premium";
  if (!premium && profile.free_recipe_generation_used_at) {
    return { response: Response.json({ error: "recipe_generation_quota_exceeded" }, { status: 402 }) };
  }

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { count: dailyCount } = await supabase
    .from("recipe_generation_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", dayAgo);
  const dailyLimit = premium ? 50 : 5;
  if ((dailyCount ?? 0) >= dailyLimit) {
    return { response: Response.json({ error: "recipe_generation_rate_limited" }, { status: 429 }) };
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

function buildPrompt(input: GenerateRecipesRequest, variant: "confident" | "alternative") {
  return [
    "Generate practical Leftovr recipe ideas from household fridge contents.",
    "Tone: low-effort, approximate, useful, opportunity-framed. Avoid guilt, exact expiry dates, calories, and nutrition tracking.",
    `Cooking mode: ${input.cookingMode ?? "household"}.`,
    `Servings: ${input.servings ?? 2}.`,
    `Premium optimized: ${input.isPremium ? "yes" : "no"}.`,
    `Hard serving constraint: recipe servings MUST equal ${input.servings ?? 2}.`,
    `Hard dietary constraints: ${
      input.avoidances?.length
        ? `avoid ${input.avoidances.join(", ")}. Do not include these in ingredients, steps, substitutions, or optional toppings.`
        : "none"
    }`,
    "Culinary judgment: create normal, appetizing meals grounded in real cooking traditions, not novelty mashups. Only combine ingredients when there is a recognizable culinary reason (classic pairing, shared cuisine, sauce/dressing that bridges them, or common breakfast/lunch/dinner pattern). Do not force unrelated fridge items into the same recipe just because they are available; it is better to use fewer well-matched fridge items. Sweet fruit can be used when it belongs naturally (yogurt, oats, smoothies, salads, desserts, some cheese boards), but avoid awkward sweet-savory combinations unless they are a familiar dish. If a combination sounds like a dare, joke, TikTok stunt, or pregnancy craving, do not return it.",
    "Fridge contents:",
    ...formatInventory(input.inventory ?? []),
    "Prompt filters:",
    `- meal type: ${input.filters?.mealType ?? "any"}`,
    `- max time: ${input.filters?.maxMinutes != null ? `${input.filters.maxMinutes} minutes` : "any"}`,
    `- min time: ${input.filters?.minMinutes != null ? `${input.filters.minMinutes} minutes` : "any"}`,
    `- vibe/tag: ${input.filters?.vibe ?? "any"}`,
    variant === "alternative"
      ? "Return exactly 1 recipe card: a clearly different alternative to the most obvious dish for this fridge — pick a different main technique or cuisine than the predictable first choice."
      : "Return exactly 1 recipe card: your single most confident pick for this fridge.",
    "Keep the description to one short sentence. Use at most 3 tags.",
    "Write steps for a beginner cook: each step names the heat level, pan or pot size where relevant, a time estimate, and a visual or sensory doneness cue (e.g. \"until translucent\", \"until shimmering\").",
    "Include prep detail inside steps (dice size, drain or pat dry) instead of assuming knowledge.",
    "One action per step. Use as many steps as the recipe needs; do not compress multiple actions into one step, and do not pad simple recipes.",
    "Every recipe must use at least one fridge item, and prefer items with higher urgency.",
    "Ingredient names must match the fridge item names where used; mark required=true only for ingredients taken from the fridge. Pantry staples (oil, salt, garlic, spices) are required=false.",
    "Never include avoided ingredients; list any avoidance categories a recipe touches in avoidanceTags.",
    "Respect the prompt filters: matching mealType, timeMinutes within max time, and include the vibe/tag in tags when one is set.",
  ].join("\n");
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
