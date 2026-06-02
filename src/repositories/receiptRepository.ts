import { getSupabaseClient } from "@/lib/supabase";
import { normalizeMockReceipt } from "@/services";
import {
  computeUrgency,
  getCatalogNet,
  getShelfLifeRange,
  normalizeFoodName,
} from "@/services/inventoryRules";

const FREE_MONTHLY_RECEIPT_LIMIT = 3;

export type ReceiptDuplicate = {
  id: string;
  created_at: string;
};

export type ReceiptLimitStatus = {
  used: number;
  limit: number;
  remaining: number;
};

export type ReceiptScanResult = {
  scanId: string;
  addedCount: number;
  reviewCount: number;
  limit: ReceiptLimitStatus;
};

export async function getReceiptScanLimitStatus(householdId: string): Promise<ReceiptLimitStatus> {
  const supabase = getSupabaseClient();
  const start = startOfCurrentMonth();

  const { count, error } = await supabase
    .from("receipt_scans")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("status", "completed")
    .gte("processed_at", start.toISOString());

  if (error) {
    throw error;
  }

  const used = count ?? 0;
  return {
    used,
    limit: FREE_MONTHLY_RECEIPT_LIMIT,
    remaining: Math.max(0, FREE_MONTHLY_RECEIPT_LIMIT - used),
  };
}

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

export async function processMockReceiptScan(input: {
  householdId: string;
  templateKey: string;
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

  const limit = await getReceiptScanLimitStatus(input.householdId);

  const normalized = normalizeMockReceipt(input.templateKey);
  const duplicate = await findRecentReceiptDuplicate(
    input.householdId,
    normalized.template.receiptSignature,
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
      receipt_signature: normalized.template.receiptSignature,
      template_key: normalized.template.key,
      item_count: normalized.highConfidenceItems.length,
      review_count: normalized.reviewItems.length,
      duplicate_of: duplicate?.id ?? null,
      processed_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (scanError) {
    throw scanError;
  }

  if (normalized.highConfidenceItems.length > 0) {
    const { error: inventoryError } = await supabase.from("inventory_items").insert(
      normalized.highConfidenceItems.map((item) => {
        const catalogNet = getCatalogNet(item.name);
        return {
        household_id: input.householdId,
        name: item.name,
        normalized_name: normalizeFoodName(item.name),
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        net_amount: catalogNet ? catalogNet.netAmount * item.quantity : null,
        net_unit: catalogNet?.netUnit ?? null,
        display_quantity: formatDisplayQuantity(item.quantity, item.unit),
        partial_state: "full",
        urgency: item.urgency ?? computeUrgency({ name: item.name, category: item.category, addedAt: now }),
        shelf_life_range: getShelfLifeRange(item.name, item.category),
        source: "receipt",
        source_scan_id: scan.id,
        confidence: item.confidence,
        added_by: userId,
        added_at: now,
        };
      }),
    );

    if (inventoryError) {
      throw inventoryError;
    }
  }

  if (normalized.reviewItems.length > 0) {
    const { error: reviewError } = await supabase.from("receipt_review_items").insert(
      normalized.reviewItems.map((item) => ({
        household_id: input.householdId,
        scan_id: scan.id,
        proposed_name: item.name,
        normalized_name: normalizeFoodName(item.name),
        proposed_category: item.category,
        confidence: item.confidence,
      })),
    );

    if (reviewError) {
      throw reviewError;
    }
  }

  return {
    scanId: scan.id,
    addedCount: normalized.highConfidenceItems.length,
    reviewCount: normalized.reviewItems.length,
    limit: {
      ...limit,
      used: limit.used + 1,
      remaining: Math.max(0, limit.remaining - 1),
    },
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

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatDisplayQuantity(quantity: number, unit: string) {
  const roughQuantity = Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(1));
  return `${roughQuantity} ${unit}`;
}
