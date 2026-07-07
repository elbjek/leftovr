import { getSupabaseClient } from "@/lib/supabase";
import { valueOfAmount } from "@/lib/money";
import {
  insertValueEvent,
  fetchPricedLots,
  categoryAverageUnitPrice,
} from "./valueEventRepository";
import {
  buildReceiptConfirmItemsFromLines,
  buildConfirmedReceiptInventoryRows,
  NormalizedReceiptLine,
  ReceiptConfirmItem,
} from "@/services";

export type ReceiptDuplicate = {
  id: string;
  created_at: string;
};

export type ReceiptScanResult = {
  scanId: string;
  addedCount: number;
};


export type NormalizedReceiptScan = {
  scanId: string;
  items: ReceiptConfirmItem[];
  duplicate: ReceiptDuplicate | null;
};

/**
 * Uploads the captured receipt photo and runs the AI normalization pipeline
 * (Claude vision + line cache) in the normalize-receipt edge function. The
 * edge function creates the scan row (status "processing"); nothing lands in
 * inventory until the user confirms.
 */
export async function normalizeReceiptImage(input: {
  householdId: string;
  imageBase64: string;
}): Promise<NormalizedReceiptScan> {
  const supabase = getSupabaseClient();
  const imagePath = `${input.householdId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("receipt-images")
    .upload(imagePath, base64ToBytes(input.imageBase64).buffer as ArrayBuffer, {
      contentType: "image/jpeg",
    });
  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase.functions.invoke("normalize-receipt", {
    body: { householdId: input.householdId, imagePath },
  });
  if (error) {
    throw error;
  }

  const response = data as {
    scanId: string;
    duplicate: ReceiptDuplicate | null;
    lines: NormalizedReceiptLine[];
  };

  return {
    scanId: response.scanId,
    items: buildReceiptConfirmItemsFromLines(response.lines),
    duplicate: response.duplicate,
  };
}

/**
 * Imports a digital e-receipt PDF: uploads it to the receipt-images bucket and
 * runs the same normalize-receipt pipeline as a photo scan (the edge function
 * branches on the .pdf extension and sends a `file` content part to OpenAI).
 */
export async function normalizeReceiptPdf(input: {
  householdId: string;
  pdfBase64: string;
}): Promise<NormalizedReceiptScan> {
  const supabase = getSupabaseClient();
  const imagePath = `${input.householdId}/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("receipt-images")
    .upload(imagePath, base64ToBytes(input.pdfBase64).buffer as ArrayBuffer, {
      contentType: "application/pdf",
    });
  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase.functions.invoke("normalize-receipt", {
    body: { householdId: input.householdId, imagePath },
  });
  if (error) {
    throw error;
  }

  const response = data as {
    scanId: string;
    duplicate: ReceiptDuplicate | null;
    lines: NormalizedReceiptLine[];
  };

  return {
    scanId: response.scanId,
    items: buildReceiptConfirmItemsFromLines(response.lines),
    duplicate: response.duplicate,
  };
}

/**
 * Completes a scan the edge function already created: marks it completed and
 * inserts the confirmed items into inventory. `duplicateOf` dodges the unique
 * signature index when the user explicitly accepts a duplicate receipt.
 */
export async function confirmNormalizedReceiptScan(input: {
  householdId: string;
  scanId: string;
  items: ReceiptConfirmItem[];
  duplicateOf?: string | null;
}): Promise<ReceiptScanResult> {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }
  const userId = userResult.user?.id;
  if (!userId) {
    throw new Error("No signed-in user.");
  }

  const kept = input.items.filter((item) => item.included);
  const now = new Date().toISOString();

  const { error: scanError } = await supabase
    .from("receipt_scans")
    .update({
      status: "completed",
      item_count: kept.length,
      review_count: kept.filter((item) => item.lowConfidence).length,
      duplicate_of: input.duplicateOf ?? null,
      processed_at: now,
    })
    .eq("id", input.scanId);
  if (scanError) {
    // Unique signature index caught a concurrent scan of the same receipt
    // (cross-device race on an identical receipt).
    if ((scanError as { code?: string }).code === "23505") {
      throw new Error("Duplicate receipt needs confirmation.");
    }
    throw scanError;
  }

  if (kept.length > 0) {
    const inventoryRows = buildConfirmedReceiptInventoryRows(kept, {
      householdId: input.householdId,
      scanId: input.scanId,
      userId,
      addedAt: now,
    });
    const { error: inventoryError } = await supabase
      .from("inventory_items")
      .insert(inventoryRows);
    if (inventoryError) {
      throw inventoryError;
    }

    // Money: emit a spend event per receipt line (these rows bypass
    // addInventoryItem). Unpriced lines approximate from category averages.
    const pricedLots = inventoryRows.some((r) => r.purchase_price == null)
      ? await fetchPricedLots(input.householdId)
      : [];
    for (const row of inventoryRows) {
      const spend = row.purchase_price ??
        valueOfAmount(row.purchase_amount ?? row.quantity, categoryAverageUnitPrice(pricedLots, row.category));
      await insertValueEvent({
        householdId: input.householdId,
        kind: "spend",
        value: spend,
        normalizedName: row.normalized_name,
        category: row.category,
        createdBy: userId,
      });
    }
  }

  return { scanId: input.scanId, addedCount: kept.length };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function setNotificationPermissionPreview(input: {
  enabled: boolean;
  permissionStatus: "granted" | "denied";
}) {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const userId = userResult.user?.id;

  if (!userId) {
    throw new Error("No signed-in user.");
  }

  const { error } = await supabase
    .from("notification_preferences")
    .update({
      permission_status: input.permissionStatus,
      smart_suggestions_enabled: input.enabled,
    })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
