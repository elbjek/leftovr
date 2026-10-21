import OpenAI from "npm:openai@^4.77.0";
import { createClient } from "npm:@supabase/supabase-js@^2.46.1";

type NormalizePantryRequest = {
  householdId?: string;
  imagePaths?: string[];
};

type PantryLine = {
  rawText: string;
  confidence: number;
  item: {
    name: string;
    normalizedName: string;
    category: string;
    quantity: number | null;
    unit: string | null;
    netAmount: number | null;
    netUnit: "ml" | "g" | null;
  };
};

type PantryExtraction = {
  lines: PantryLine[];
};

const INVENTORY_CATEGORIES = [
  "dairy_eggs",
  "meat",
  "fish",
  "vegetables",
  "fruit",
  "bakery",
  "pantry",
  "frozen",
  "drinks",
  "snacks",
  "other",
];

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });

const PANTRY_SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rawText: { type: "string" },
          confidence: { type: "number" },
          item: {
            type: "object",
            properties: {
              name: { type: "string" },
              normalizedName: { type: "string" },
              category: { type: "string", enum: INVENTORY_CATEGORIES },
              quantity: nullable("number"),
              unit: nullable("string"),
              netAmount: nullable("number"),
              netUnit: { anyOf: [{ type: "string", enum: ["ml", "g"] }, { type: "null" }] },
            },
            required: [
              "name",
              "normalizedName",
              "category",
              "quantity",
              "unit",
              "netAmount",
              "netUnit",
            ],
            additionalProperties: false,
          },
        },
        required: ["rawText", "confidence", "item"],
        additionalProperties: false,
      },
    },
  },
  required: ["lines"],
  additionalProperties: false,
};

// One scan can carry up to 3 photos, each capped client-side; bound the paid
// call and the storage read so an abusive request can't fan out.
const MAX_PANTRY_PHOTOS = 3;
// A full pantry (~40+ items across 3 photos) takes longer than a receipt;
// still fail a hung call instead of keeping the user waiting forever.
// 30s: with detail:"low" thumbnails a normal extraction finishes well under
// this; anything longer is a hung request or unusable photos — fail fast.
const PANTRY_AI_TIMEOUT_MS = 30_000;

const PROMPT = [
  "These are photos of the inside of someone's kitchen: pantry shelves, fridge, cupboards, or countertops. Identify every distinct edible food and drink item you can see.",
  "If the photos are NOT of food storage (e.g. a person, a document, a random room), return an empty `lines` array. Never invent items.",
  "The photos may overlap: the same shelf can appear in more than one photo. Return each distinct product ONCE across all photos — merge duplicates and count the total visible packages in `quantity`.",
  "`name` is what a shopper would call the product, including the brand when the label is clearly readable (e.g. \"Barilla spaghetti\", \"Heinz baked beans\"). `normalizedName` must be a lowercase canonical English food name without the brand (e.g. \"spaghetti\", \"baked beans\", \"oat milk\").",
  "`normalizedName` MUST keep any qualifier that changes how the food is used or eaten: \"oat milk\" not \"milk\", \"greek yogurt\" not \"yogurt\", \"smoked salmon\" not \"salmon\".",
  "`rawText` is a short description of the item as it appears on the shelf — the readable label text when there is one, otherwise what you see (e.g. \"blue Barilla box, n.5\", \"jar of red sauce\").",
  "Pick `category` from the provided enum. Use `other` only when nothing else fits.",
  "`quantity` is how many packages/pieces of that product are visible in total, or null when you cannot tell. `unit` is the natural counting unit (usually null or a count unit like \"item\"); do NOT guess weights.",
  "`netAmount`/`netUnit` only when a metric size is readable on the packaging (1L -> 1000 ml, 400g -> 400 g); otherwise null.",
  "Only return edible food and drink. Exclude non-food items on the same shelves (cleaning supplies, toiletries, paper goods, pet food, utensils, appliances, containers you cannot see into).",
  "`confidence` (0-1) is your certainty that `name`/`normalizedName` is the correct real food. Partially hidden items, unreadable labels, or shape-only guesses stay below 0.5. Only use confidence above 0.75 when the product is unmistakable — a clearly readable label or an unambiguous fresh item (bananas, eggs).",
  "`normalizedName` MUST be a real, standard food or drink an English speaker would recognize. If you cannot confidently identify the product, keep `name` descriptive, set confidence below 0.5, and give your best real-food guess as `normalizedName` — never a made-up word.",
].join("\n");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "missing_server_config" }, { status: 500 });
  }

  const input = await req.json().catch(() => ({})) as NormalizePantryRequest;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "missing_authorization" }, { status: 401 });
  }
  const imagePaths = Array.isArray(input.imagePaths) ? input.imagePaths : [];
  if (!input.householdId || imagePaths.length === 0 || imagePaths.length > MAX_PANTRY_PHOTOS) {
    return Response.json({ error: "missing_required_fields" }, { status: 400 });
  }
  // Every image must live in the requesting household's folder.
  for (const path of imagePaths) {
    if (typeof path !== "string" || !path.startsWith(`${input.householdId}/`) || path.includes("..")) {
      return Response.json({ error: "invalid_image_path" }, { status: 400 });
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: userResult, error: userError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  const userId = userResult.user?.id;
  if (userError || !userId) {
    return Response.json({ error: "invalid_authorization" }, { status: 401 });
  }

  // Same gates as normalize-receipt: pantry and receipt scans share the one
  // free taste, the daily rate limit, and the premium monthly cap (the counts
  // below span both scan types because both live in receipt_scans).
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [profileResult, householdResult, dailyCountResult, monthlyCountResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, tier, active_household_id, free_receipt_scan_used_at")
      .eq("id", userId)
      .single(),
    supabase
      .from("households")
      .select("plan_tier")
      .eq("id", input.householdId)
      .maybeSingle(),
    supabase
      .from("receipt_scans")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .gte("created_at", dayAgo),
    supabase
      .from("receipt_scans")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .gte("created_at", monthStart),
  ]);
  const profile = profileResult.data;
  const household = householdResult.data;
  const dailyCount = dailyCountResult.count;
  const monthlyCount = monthlyCountResult.count;

  if (!profile) {
    return Response.json({ error: "profile_not_found" }, { status: 403 });
  }
  if (profile.active_household_id !== input.householdId) {
    return Response.json({ error: "household_mismatch" }, { status: 403 });
  }

  // Past this point the caller is a verified member of the household whose
  // folder the path(s) are in, so a rejected scan may delete the upload. We
  // never retain these files — not on gate rejections (402/429) or early
  // failures either. Clients can't delete (no storage DELETE policy), so this
  // has to happen here. Non-fatal; removing an already-removed path is a no-op.
  const discardUploads = async () => {
    const { error } = await supabase.storage.from("receipt-images").remove(imagePaths);
    if (error) console.error("[normalize-pantry] upload cleanup failed", error);
  };
  const premium =
    profile.tier === "premium" ||
    profile.tier === "household_premium" ||
    household?.plan_tier === "household_premium";
  if (!premium && profile.free_receipt_scan_used_at) {
    await discardUploads();
    return Response.json({ error: "receipt_scan_quota_exceeded" }, { status: 402 });
  }

  if ((dailyCount ?? 0) >= 30) {
    await discardUploads();
    return Response.json({ error: "receipt_scan_rate_limited" }, { status: 429 });
  }

  const SCAN_MONTHLY_CAP = 100;
  if (premium && (monthlyCount ?? 0) >= SCAN_MONTHLY_CAP) {
    await discardUploads();
    return Response.json({ error: "receipt_scan_monthly_limit" }, { status: 429 });
  }

  // The scan row is the attempt record: created when the (paid) AI call is
  // about to happen. The free-taste trigger fires here, not at confirm time.
  const { data: scan, error: scanError } = await supabase
    .from("receipt_scans")
    .insert({
      household_id: input.householdId,
      created_by: userId,
      status: "processing",
      scan_type: "pantry",
      image_path: imagePaths.join(","),
    })
    .select("id")
    .single();
  if (scanError || !scan) {
    console.error("[normalize-pantry] scan insert failed", scanError);
    await discardUploads();
    return Response.json({ error: "scan_create_failed" }, { status: 500 });
  }

  try {
    // Independent downloads — fetch and encode all photos concurrently; map
    // preserves order so the model sees them in capture order.
    const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = await Promise.all(
      imagePaths.map(async (path) => {
        const { data: file, error: downloadError } = await supabase.storage
          .from("receipt-images")
          .download(path);
        if (downloadError || !file) {
          throw new Error(`image_download_failed: ${downloadError?.message ?? "empty"}`);
        }
        return {
          type: "image_url",
          // detail:"low" = one 512px thumbnail per photo (~2.8k tokens vs ~25k
          // tiled). Pantry scans identify objects, not fine print, so the
          // downscale is acceptable; receipts must stay on high detail.
          image_url: {
            url: `data:image/jpeg;base64,${bytesToBase64(new Uint8Array(await file.arrayBuffer()))}`,
            detail: "low",
          },
        } satisfies OpenAI.Chat.Completions.ChatCompletionContentPart;
      }),
    );
    // We don't retain pantry photos: delete as soon as they're decoded so
    // nothing lingers in storage on any path. Cleanup failure is non-fatal.
    const { error: removeError } = await supabase.storage
      .from("receipt-images")
      .remove(imagePaths);
    if (removeError) {
      console.error("[normalize-pantry] photo cleanup failed", removeError);
    }

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      // 4000 comfortably fits a large 3-photo pantry (~40 tokens/item) while
      // keeping worst-case generation time inside the 30s timeout.
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [{ type: "text", text: PROMPT }, ...imageParts],
      }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "pantry", strict: true, schema: PANTRY_SCHEMA },
      },
    }, {
      // Bound the (paid) AI call so a hung request can't keep the user waiting
      // forever; on timeout it throws and the catch below fails the scan cleanly.
      timeout: PANTRY_AI_TIMEOUT_MS,
      maxRetries: 0,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const extraction = JSON.parse(text) as PantryExtraction;

    console.info("[normalize-pantry] token usage", {
      scanId: scan.id,
      photos: imagePaths.length,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    });

    // Nothing recognizable (dark photos, not a pantry): keep the row for
    // rate-limit accounting but retain nothing derived from the photos.
    if (extraction.lines.length === 0) {
      await supabase
        .from("receipt_scans")
        .update({
          status: "failed",
          image_path: null,
          error_message: "no_pantry_items",
          prompt_tokens: response.usage?.prompt_tokens ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", scan.id);
      return Response.json({ scanId: scan.id, lines: [] });
    }

    await supabase
      .from("receipt_scans")
      .update({
        prompt_tokens: response.usage?.prompt_tokens ?? null,
        // Photos are already deleted and image_path is a single-path column;
        // don't leave a comma-joined value pointing at removed objects.
        image_path: null,
      })
      .eq("id", scan.id);

    // The free taste is consumed only by a successful scan (items found);
    // failed and empty scans stay free so a bad photo never burns it.
    await supabase
      .from("profiles")
      .update({ free_receipt_scan_used_at: new Date().toISOString() })
      .eq("id", userId)
      .is("free_receipt_scan_used_at", null);

    console.info("[normalize-pantry] normalized", {
      scanId: scan.id,
      photos: imagePaths.length,
      lines: extraction.lines.length,
    });

    return Response.json({ scanId: scan.id, lines: extraction.lines });
  } catch (error) {
    // Real error stays in operational logs only; the DB row keeps a generic
    // code (never model output) and no photo-derived fields.
    console.error("[normalize-pantry] normalization failed", error);
    await supabase
      .from("receipt_scans")
      .update({
        status: "failed",
        image_path: null,
        error_message: "normalization_failed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", scan.id);
    // A download failure throws before the in-try cleanup; make sure nothing stays.
    await discardUploads();
    return Response.json({ error: "normalization_failed" }, { status: 500 });
  }
});

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}
