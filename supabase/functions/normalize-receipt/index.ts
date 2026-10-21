import OpenAI from "npm:openai@^4.77.0";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@^2.46.1";

import { mergeWithCache, NormalizedLine, ReceiptLineCacheRow, UNKNOWN_STORE } from "./cache-merge.ts";

type NormalizeReceiptRequest = {
  householdId?: string;
  imagePath?: string;
};

type ReceiptExtraction = {
  storeChain: string;
  purchaseDate: string | null;
  total: number | null;
  lines: NormalizedLine[];
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

const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    storeChain: { type: "string" },
    purchaseDate: nullable("string"),
    total: nullable("number"),
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
              price: nullable("number"),
              priceApproximate: { type: "boolean" },
            },
            required: [
              "name",
              "normalizedName",
              "category",
              "quantity",
              "unit",
              "netAmount",
              "netUnit",
              "price",
              "priceApproximate",
            ],
            additionalProperties: false,
          },
        },
        required: ["rawText", "confidence", "item"],
        additionalProperties: false,
      },
    },
  },
  required: ["storeChain", "purchaseDate", "total", "lines"],
  additionalProperties: false,
};

// Upper bound on the receipt AI call. Typical scans finish in a few seconds;
// 30s covers a long receipt while failing a hung call fast.
const RECEIPT_AI_TIMEOUT_MS = 30_000;

const PROMPT = [
  "Read this grocery receipt (a photo or a PDF e-receipt) and normalize every purchased food line item.",
  "If this is NOT a grocery receipt (e.g. an ID, a bank statement, a menu, or any other document), return storeChain \"unknown\" and an empty `lines` array. Never invent items.",
  "Receipts may be in any language; keep `name` close to what a shopper would call the product in the receipt's language, but `normalizedName` must be a lowercase canonical English food name (e.g. \"milk\", \"chicken breast\").",
  "`normalizedName` MUST keep any qualifier that changes how the food is used or eaten: \"chocolate croissant\" not \"croissant\", \"chocolate milk\" not \"milk\", \"greek yogurt\" not \"yogurt\", \"smoked salmon\" not \"salmon\". Brand names (Milka, Coco, Nutella, etc.) signal the product type even when the base word looks plain — a \"kroasan coco milka\" is a chocolate-filled croissant snack, normalizedName \"chocolate croissant\".",
  "`rawText` must be the receipt line exactly as printed, including abbreviations.",
  "Pick `category` from the provided enum. Use `other` only when nothing else fits.",
  "Sweet/confectionery products — chocolate, candy, biscuits, wafers, chips, chocolate-filled or sweet pastries (e.g. \"kroasan coco milka\") — are `snacks`, not `bakery`. Sweet drinks, juice, and soda are `drinks`. Reserve `bakery` for plain bread and savory baked goods.",
  "`quantity`/`unit` reflect purchased count and unit when printed (e.g. 2 x). `netAmount`/`netUnit` only when a metric size is printed on the line (1L -> 1000 ml, 400g -> 400 g); otherwise null.",
  "`price` is the printed line total for that item as a number in the receipt's currency (no currency symbol), or null. Never invent a printed price.",
  "When a line has no printed price, estimate a typical retail price for that item and quantity and set `priceApproximate` true. When you read the printed price, set `priceApproximate` false. Always set `price` to a positive number when you can — only use null if you can neither read nor reasonably estimate it.",
  "Skip non-food lines: totals, deposits/pant, bags, discounts, loyalty points, payment rows.",
  "Only return edible food and drink. Exclude every non-food / household product even when purchased on its own line (e.g. cleaning supplies, toiletries, cosmetics, paper goods, pet supplies, batteries, household goods, tobacco, medicine). Account for abbreviated non-food names in the receipt's language. If a line is not clearly food, do not return it.",
  "Correct obvious misspellings or OCR errors to the real food name, and set `name` to the corrected human-readable product.",
  "`confidence` (0-1) is your certainty that `name`/`normalizedName` is the correct real food. Set confidence below 0.5 whenever the source text is NOT a clearly recognizable food word — garbled OCR, codes, or an abbreviation you cannot confidently expand. In that case do NOT invent a plausible food: keep `name` close to the printed text and let the low confidence flag it for the user. Only use confidence above 0.75 when the product name is an unambiguous, real food word you are sure of. A name that still looks like a code or contains digits is never high confidence.",
  "`normalizedName` MUST be a real, standard food or drink that a native English speaker would recognize. If the best you can produce still contains a foreign, brand, store, or made-up token that is NOT itself an English food word (e.g. \"cdamer cheese\", \"fresca\", \"pijaca\"), that means you could NOT confidently identify the product — set confidence below 0.5 instead of guessing. Example: \"Sir Cdamer Biser\" is OCR-garbled Serbian; \"Cdamer\" is likely \"Edamer\" (edam) but you cannot be sure, so confidence stays below 0.5 and `normalizedName` is your best guess like \"edam cheese\". Store/market names that leak onto the line (e.g. \"Maxi pijaca\") are NOT part of the food — ignore them; if removing them leaves no clear food word, confidence is low.",
  "`storeChain` is a lowercase slug of the retail chain (e.g. \"rema-1000\", \"lidl\"); use \"unknown\" if unreadable.",
  "`purchaseDate` is the printed purchase date as YYYY-MM-DD, or null. `total` is the printed grand total as a number, or null.",
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

  const input = await req.json().catch(() => ({})) as NormalizeReceiptRequest;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "missing_authorization" }, { status: 401 });
  }
  if (!input.householdId || !input.imagePath) {
    return Response.json({ error: "missing_required_fields" }, { status: 400 });
  }
  // Image must live in the requesting household's folder.
  if (!input.imagePath.startsWith(`${input.householdId}/`) || input.imagePath.includes("..")) {
    return Response.json({ error: "invalid_image_path" }, { status: 400 });
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

  // These three reads are independent (keyed on userId/householdId), so run
  // them concurrently. Auth is already validated above; the gate checks below
  // still run in the same order and reject before any write/AI call.
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
    const { error } = await supabase.storage.from("receipt-images").remove([input.imagePath!]);
    if (error) console.error("[normalize-receipt] upload cleanup failed", error);
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
      image_path: input.imagePath,
    })
    .select("id")
    .single();
  if (scanError || !scan) {
    console.error("[normalize-receipt] scan insert failed", scanError);
    await discardUploads();
    return Response.json({ error: "scan_create_failed" }, { status: 500 });
  }

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from("receipt-images")
      .download(input.imagePath);
    if (downloadError || !file) {
      throw new Error(`image_download_failed: ${downloadError?.message ?? "empty"}`);
    }
    const fileBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    // We don't retain receipt files: delete as soon as it's decoded so a wrong
    // upload (an ID, a random PDF) never lingers in storage. Runs before the AI
    // call, so success, empty, and failure paths all leave nothing behind.
    // Cleanup failure is non-fatal — the scan continues.
    const { error: removeError } = await supabase.storage
      .from("receipt-images")
      .remove([input.imagePath]);
    if (removeError) {
      console.error("[normalize-receipt] receipt file cleanup failed", removeError);
    }
    const isPdf = input.imagePath.toLowerCase().endsWith(".pdf");
    // Digital e-receipts come as PDFs; OpenAI reads them via a `file` content
    // part. Camera scans stay on the `image_url` (vision) path.
    const receiptContent = isPdf
      ? {
        type: "file",
        file: { filename: "receipt.pdf", file_data: `data:application/pdf;base64,${fileBase64}` },
      }
      : { type: "image_url", image_url: { url: `data:image/jpeg;base64,${fileBase64}` } };

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 6000,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          receiptContent,
        ] as OpenAI.Chat.Completions.ChatCompletionContentPart[],
      }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "receipt", strict: true, schema: RECEIPT_SCHEMA },
      },
    }, {
      // Bound the (paid) AI call so a hung request can't keep the user waiting
      // forever; on timeout it throws and the catch below fails the scan cleanly.
      // maxRetries 0 — fail fast instead of silently retrying past the timeout.
      timeout: RECEIPT_AI_TIMEOUT_MS,
      maxRetries: 0,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const extraction = JSON.parse(text) as ReceiptExtraction;

    console.info("[normalize-receipt] token usage", {
      scanId: scan.id,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    });

    // Not a usable receipt (empty or non-receipt): retain nothing about it.
    // Keep the row for rate-limit accounting but strip every receipt-derived
    // field, and never touch the line cache.
    if (extraction.lines.length === 0) {
      await supabase
        .from("receipt_scans")
        .update({
          status: "failed",
          image_path: null,
          receipt_signature: null,
          error_message: "no_receipt_items",
          prompt_tokens: response.usage?.prompt_tokens ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", scan.id);
      return Response.json({
        scanId: scan.id,
        storeChain: "unknown",
        receiptSignature: null,
        duplicate: null,
        lines: [],
      });
    }

    const merged = await applyCache(supabase, extraction);
    const signature = await buildSignature(extraction, merged.lines);
    const duplicate = await findDuplicate(supabase, input.householdId, scan.id, signature);

    await supabase
      .from("receipt_scans")
      .update({
        receipt_signature: signature,
        prompt_tokens: response.usage?.prompt_tokens ?? null,
      })
      .eq("id", scan.id);

    // The free taste is consumed only by a successful scan (items found);
    // failed and empty scans stay free so a bad photo never burns it.
    await supabase
      .from("profiles")
      .update({ free_receipt_scan_used_at: new Date().toISOString() })
      .eq("id", userId)
      .is("free_receipt_scan_used_at", null);

    console.info("[normalize-receipt] normalized", {
      scanId: scan.id,
      storeChain: extraction.storeChain,
      lines: merged.lines.length,
      cacheHits: merged.hits.length,
      cacheWrites: merged.writes.length,
      duplicate: duplicate?.id ?? null,
    });

    return Response.json({
      scanId: scan.id,
      storeChain: extraction.storeChain,
      receiptSignature: signature,
      duplicate,
      lines: merged.lines,
    });
  } catch (error) {
    // Real error stays in operational logs only; the DB row keeps a generic
    // code (never model output) and no receipt-derived fields.
    console.error("[normalize-receipt] normalization failed", error);
    await supabase
      .from("receipt_scans")
      .update({
        status: "failed",
        image_path: null,
        receipt_signature: null,
        error_message: "normalization_failed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", scan.id);
    // A download failure throws before the in-try cleanup; make sure nothing stays.
    await discardUploads();
    return Response.json({ error: "normalization_failed" }, { status: 500 });
  }
});

async function applyCache(supabase: SupabaseClient, extraction: ReceiptExtraction) {
  if (extraction.storeChain === UNKNOWN_STORE) {
    return mergeWithCache(extraction.storeChain, extraction.lines, []);
  }
  const rawLines = extraction.lines.map((line) => line.rawText);
  const { data: cacheRows } = await supabase
    .from("receipt_line_cache")
    .select(
      "store_chain, raw_line_text, name, normalized_name, category, quantity, unit, net_amount, net_unit, confidence",
    )
    .eq("store_chain", extraction.storeChain)
    .in("raw_line_text", rawLines);

  const merged = mergeWithCache(
    extraction.storeChain,
    extraction.lines,
    (cacheRows ?? []) as ReceiptLineCacheRow[],
  );

  if (merged.writes.length > 0) {
    await supabase
      .from("receipt_line_cache")
      .upsert(merged.writes, { onConflict: "store_chain,raw_line_text", ignoreDuplicates: true });
  }
  if (merged.hits.length > 0) {
    await supabase.rpc("bump_receipt_line_cache_hits", {
      p_store_chain: extraction.storeChain,
      p_raw_lines: merged.hits,
    });
  }

  return merged;
}

async function findDuplicate(
  supabase: SupabaseClient,
  householdId: string,
  scanId: string,
  signature: string,
) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("receipt_scans")
    .select("id, created_at")
    .eq("household_id", householdId)
    .eq("receipt_signature", signature)
    .eq("status", "completed")
    .is("duplicate_of", null)
    .neq("id", scanId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function buildSignature(extraction: ReceiptExtraction, lines: NormalizedLine[]) {
  const stable = JSON.stringify({
    store: extraction.storeChain,
    date: extraction.purchaseDate,
    total: extraction.total,
    items: lines.map((line) => line.item.normalizedName).sort(),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}
