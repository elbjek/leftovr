import Anthropic from "npm:@anthropic-ai/sdk@^0.24.0";

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
  const prompt = buildPrompt(input);
  console.info("[generate-recipes] prompt\n" + prompt);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
    });

    const text = response.content.find((block) => block.type === "text")?.text ?? "";
    console.info("[generate-recipes] response text length", text.length);
    const parsed = JSON.parse(text) as { recipes: AiRecipeCard[] };

    const avoidances = input.avoidances ?? [];
    const recipes = parsed.recipes.filter(
      (recipe) =>
        recipe.ingredients.length > 0 &&
        recipe.steps.length > 0 &&
        !violatesAvoidances(recipe, avoidances),
    );

    console.info("[generate-recipes] returning recipes", {
      raw: parsed.recipes.length,
      kept: recipes.length,
      titles: recipes.map((recipe) => recipe.title),
    });

    return Response.json({ source: "ai", recipes });
  } catch (error) {
    console.error("[generate-recipes] generation failed", error);
    return Response.json({ error: "generation_failed" }, { status: 500 });
  }
});

function buildPrompt(input: GenerateRecipesRequest) {
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
    "Return 3 to 5 recipe cards.",
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
