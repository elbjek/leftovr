import { createClient } from "npm:@supabase/supabase-js@^2.46.1";

// Recipe covers: one top-down OpenAI photo per dish and variant, shared across
// households. A recipe gets the cover of its dish (recipes.dish_key, a generic
// English name from the card AI) in one of three variants picked by its id, so
// "tomato pasta" is paid for at most three times and then reused for free.
// The prompt is built from the cleaned dish name only, never the title or
// description, so a shared cover always shows what its key says.

const MODEL = "gpt-image-1-mini";
const VARIANTS = 3;
const BUCKET = "recipe-covers";

// The scene changes per dish and variant so covers don't all look alike.
const SURFACES = [
  "a pale oak wooden table",
  "a white marble counter",
  "a light grey linen tablecloth",
  "a dark slate board",
  "terracotta floor tiles",
  "a sage green linen tablecloth",
  "a warm walnut table",
  "a blue and white checked cloth",
  "a cream glazed tile counter",
  "a weathered rustic wooden board",
];
const TABLEWARE = [
  "a plain white plate or bowl",
  "a speckled stoneware plate or bowl",
  "a pale green ceramic dish",
  "a dark cast-iron pan or a dark ceramic dish",
  "a cream enamel dish",
  "a shallow blue ceramic bowl or plate",
];
const LIGHT = ["soft morning daylight", "bright natural window light", "warm late-afternoon light"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!openAiKey || !supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "missing_config" }, { status: 500 });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "missing_authorization" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userResult } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  const userId = userResult.user?.id;
  if (!userId) return Response.json({ error: "invalid_authorization" }, { status: 401 });

  let recipeId = "";
  try {
    recipeId = String((await req.json())?.recipeId ?? "");
  } catch {
    // Empty or invalid body: rejected below.
  }
  if (!/^[0-9a-f-]{36}$/i.test(recipeId)) return Response.json({ error: "invalid_recipe" }, { status: 400 });

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, household_id, title, dish_key, cover_path")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return Response.json({ error: "recipe_not_found" }, { status: 404 });
  const { data: member } = await supabase
    .from("household_members")
    .select("id")
    .eq("household_id", recipe.household_id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!member) return Response.json({ error: "recipe_not_found" }, { status: 404 });
  if (recipe.cover_path) return Response.json({ path: recipe.cover_path });

  // Recipes from before dish keys fall back to their title.
  const dish = cleanDish(recipe.dish_key ?? recipe.title);
  if (!dish) return Response.json({ error: "no_dish" }, { status: 422 });
  const variant = hash(recipe.id) % VARIANTS;
  const path = `${(await sha256(dish)).slice(0, 24)}-${variant}.jpg`;

  const { data: cached } = await supabase
    .from("recipe_covers")
    .select("path")
    .eq("dish_key", dish)
    .eq("variant", variant)
    .maybeSingle();

  if (!cached) {
    // Claim the slot first: the insert enforces the daily cap, and a second
    // request for the same dish and variant hits the key and reuses the path.
    // ponytail: that second request can see the path a few seconds before the
    // file exists; the app shows its drawn tile until the image loads.
    const { error: claimError } = await supabase
      .from("recipe_covers")
      .insert({ dish_key: dish, variant, path, created_by: userId });
    if (claimError?.message === "usage_cap_reached") {
      return Response.json({ error: "recipe_cover_rate_limited" }, { status: 429 });
    }
    if (claimError && claimError.code !== "23505") {
      console.error("[recipe-cover] claim failed", claimError);
      return Response.json({ error: "cover_failed" }, { status: 500 });
    }
    if (!claimError) {
      try {
        const jpeg = await generateCover(openAiKey, dish, variant);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
        if (uploadError) throw uploadError;
      } catch (error) {
        console.error("[recipe-cover] generation failed", { dish, variant, error: String(error) });
        await supabase.from("recipe_covers").delete().eq("dish_key", dish).eq("variant", variant);
        return Response.json({ error: "cover_failed" }, { status: 502 });
      }
    }
  }

  await supabase.from("recipes").update({ cover_path: path }).eq("id", recipe.id);
  return Response.json({ path });
});

async function generateCover(apiKey: string, dish: string, variant: number): Promise<Uint8Array> {
  const seed = hash(`${dish}:${variant}`);
  const prompt = [
    `Overhead top-down food photo of ${dish}, home-cooked, served in ${pick(TABLEWARE, seed)},`,
    `centered on ${pick(SURFACES, seed >>> 3)}. ${capitalize(pick(LIGHT, seed >>> 7))}, gentle natural shadows,`,
    "realistic and appetizing, a simple composition. The dish fills about 60% of the frame.",
    "No hands, people, cutlery, text, logos or extra props.",
  ].join(" ");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
      output_compression: 80,
      n: 1,
    }),
  });
  if (!response.ok) throw new Error(`openai ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const b64 = (await response.json())?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") throw new Error("openai returned no image");
  return Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
}

/** Lowercase letters, digits and single spaces, at most 6 words / 60 chars. */
function cleanDish(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")
    .slice(0, 60)
    .trim();
}

// FNV-1a: a stable small hash for picking variants and scenes.
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
