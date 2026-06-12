import { getSupabaseClient } from "@/lib/supabase";
import {
  buildReceiptConfirmItems,
  buildReceiptConfirmItemsFromLines,
  buildConfirmedReceiptInventoryRows,
  getMockReceiptTemplate,
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

export type ReceiptScanPreparation = {
  items: ReceiptConfirmItem[];
  duplicate: ReceiptDuplicate | null;
};

export async function findRecentReceiptDuplicate(
  householdId: string,
  receiptSignature: string,
): Promise<ReceiptDuplicate | null> {
  const supabase = getSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("receipt_scans")
    .select("id, created_at")
    .eq("household_id", householdId)
    .eq("receipt_signature", receiptSignature)
    .eq("status", "completed")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ReceiptDuplicate>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

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

export async function prepareReceiptScan(input: {
  householdId: string;
  templateKey: string;
}): Promise<ReceiptScanPreparation> {
  const template = getMockReceiptTemplate(input.templateKey);
  const duplicate = await findRecentReceiptDuplicate(
    input.householdId,
    template.receiptSignature,
  );

  return {
    items: buildReceiptConfirmItems(template.key),
    duplicate,
  };
}

export async function confirmReceiptScan(input: {
  householdId: string;
  templateKey: string;
  items: ReceiptConfirmItem[];
  allowDuplicate?: boolean;
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

  const template = getMockReceiptTemplate(input.templateKey);
  const kept = input.items.filter((item) => item.included);
  const duplicate = await findRecentReceiptDuplicate(
    input.householdId,
    template.receiptSignature,
  );

  if (duplicate && !input.allowDuplicate) {
    throw new Error("Duplicate receipt needs confirmation.");
  }

  const now = new Date().toISOString();
  const { data: scan, error: scanError } = await supabase
    .from("receipt_scans")
    .insert({
      household_id: input.householdId,
      created_by: userId,
      status: "completed",
      receipt_signature: template.receiptSignature,
      template_key: template.key,
      item_count: kept.length,
      review_count: 0,
      duplicate_of: duplicate?.id ?? null,
      processed_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (scanError) {
    // Unique signature index caught a concurrent scan of the same receipt
    // (the pre-insert duplicate check is racy across two devices).
    if ((scanError as { code?: string }).code === "23505") {
      throw new Error("Duplicate receipt needs confirmation.");
    }
    throw scanError;
  }

  if (kept.length > 0) {
    const inventoryRows = buildConfirmedReceiptInventoryRows(kept, {
      householdId: input.householdId,
      scanId: scan.id,
      userId,
      addedAt: now,
    });
    const { error: inventoryError } = await supabase.from("inventory_items").insert(
      inventoryRows,
    );

    if (inventoryError) {
      throw inventoryError;
    }
  }

  return {
    scanId: scan.id,
    addedCount: kept.length,
  };
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
