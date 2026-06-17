import { getSupabaseClient } from "@/lib/supabase";
import {
  getCatalogFood,
  getCatalogNet,
  getNextPartialState,
  getShelfLifeRange,
  inferCategory,
  InventoryCategory,
  InventoryLot,
  InventorySource,
  normalizeFoodName,
  PartialState,
  planDepletion,
  resolveUrgency,
  urgencyRank,
} from "@/services";

export type AddInventoryItemInput = {
  householdId: string;
  name: string;
  category?: InventoryCategory;
  quantity?: number;
  unit?: string;
  brandName?: string | null;
  netAmount?: number | null;
  netUnit?: "ml" | "g" | null;
  expiresAt?: string | null;
  source?: InventorySource;
  addedAt?: string;
};

export async function listActiveHouseholdInventory(householdId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select(
      "id, household_id, name, normalized_name, brand_name, category, quantity, unit, net_amount, net_unit, partial_state, shelf_life_range, expires_at, source, added_at, removed_at, added_by, profiles!added_by(display_name)",
    )
    .eq("household_id", householdId)
    .is("removed_at", null)
    .order("added_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    normalized_name: row.normalized_name,
    brand_name: row.brand_name ?? null,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    net_amount: row.net_amount ?? null,
    net_unit: row.net_unit ?? null,
    partial_state: row.partial_state,
    shelf_life_range: row.shelf_life_range,
    expires_at: row.expires_at ?? null,
    source: row.source,
    added_at: row.added_at,
    removed_at: row.removed_at,
    added_by: row.added_by,
    added_by_name: row.profiles?.display_name ?? null,
  })) as InventoryLot[];
}

export async function addInventoryItem(input: AddInventoryItemInput) {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const userId = userResult.user?.id;

  if (!userId) {
    throw new Error("No signed-in user.");
  }

  const name = input.name.trim();
  const category = input.category ?? inferCategory(name);
  const catalogItem = getCatalogFood(name);
  const addedAt = input.addedAt ?? new Date().toISOString();
  const quantity = input.quantity ?? 1;
  const unit = input.unit ?? catalogItem?.unit ?? "item";
  const catalogNet = getCatalogNet(name);
  const inputNetAmount = input.netAmount ?? null;
  const inputNetUnit = input.netUnit ?? null;
  const netUnit = inputNetUnit ?? catalogNet?.netUnit ?? null;
  const netAmount = inputNetAmount ?? (catalogNet ? catalogNet.netAmount * quantity : null);

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      household_id: input.householdId,
      name,
      normalized_name: normalizeFoodName(name),
      brand_name: input.brandName?.trim() || null,
      category,
      quantity,
      unit,
      net_amount: netAmount,
      net_unit: netUnit,
      partial_state: "full" satisfies PartialState,
      shelf_life_range: getShelfLifeRange(name, category),
      expires_at: input.expiresAt ?? null,
      source: input.source ?? "manual",
      added_by: userId,
      added_at: addedAt,
    })
    .select(
      "id, household_id, name, normalized_name, brand_name, category, quantity, unit, net_amount, net_unit, partial_state, shelf_life_range, expires_at, source, added_at, removed_at",
    )
    .single<InventoryLot>();

  if (error) {
    throw error;
  }

  return data;
}

export async function removeInventoryLot(itemId: string, reason = "removed") {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("inventory_items")
    .update({ removed_at: new Date().toISOString(), removal_reason: reason })
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}

export async function removeInventoryGroup(lotIds: string[], reason = "removed") {
  if (lotIds.length === 0) return;
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("inventory_items")
    .update({ removed_at: new Date().toISOString(), removal_reason: reason })
    .in("id", lotIds);

  if (error) {
    throw error;
  }
}

export async function updateInventoryQuantity(itemId: string, quantity: number) {
  const supabase = getSupabaseClient();

  if (quantity <= 0) {
    await removeInventoryLot(itemId, "quantity_depleted");
    return;
  }

  const { error } = await supabase
    .from("inventory_items")
    .update({ quantity })
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}

export async function markInventoryPartialState(itemId: string, partialState: PartialState) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("inventory_items")
    .update({ partial_state: partialState })
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}

// Fetches the active lots for one food and plans which ops deplete it.
// Ops are applied atomically by the apply_cook RPC.
async function computeDepletionOps(
  householdId: string,
  normalizedName: string,
  amount: number,
  unit: string,
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, category, quantity, partial_state, unit, expires_at, added_at, net_amount, net_unit")
    .eq("household_id", householdId)
    .eq("normalized_name", normalizedName)
    .is("removed_at", null);

  if (error) throw error;

  const lots = (data ?? []) as {
    id: string;
    name: string;
    category: InventoryCategory;
    quantity: number;
    partial_state: PartialState;
    unit: string;
    expires_at: string | null;
    added_at: string;
    net_amount: number | null;
    net_unit: "ml" | "g" | null;
  }[];

  // Most-urgent first (urgency computed live, not from the dropped column),
  // then soonest-added — so depletion spills out the at-risk lots first.
  lots.sort((a, b) => {
    const rank = urgencyRank(resolveUrgency(b)) - urgencyRank(resolveUrgency(a));
    if (rank !== 0) return rank;
    return a.added_at.localeCompare(b.added_at);
  });

  return planDepletion(lots, { amount, unit });
}

export async function depleteItemQuantity(
  householdId: string,
  normalizedName: string,
  amount = 1,
  unit = "item",
) {
  const supabase = getSupabaseClient();
  const ops = await computeDepletionOps(householdId, normalizedName, amount, unit);
  if (ops.length === 0) return;

  const { error } = await supabase.rpc("apply_cook", {
    p_household_id: householdId,
    p_ops: ops,
  });

  if (error) throw error;
}

export async function updateInventoryNetAmount(itemId: string, netAmount: number) {
  if (!(netAmount > 0)) throw new Error("net amount must be positive");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ net_amount: netAmount })
    .eq("id", itemId);
  if (error) throw error;
}

export async function advanceInventoryPartialState(itemId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("partial_state")
    .eq("id", itemId)
    .single<{ partial_state: PartialState }>();

  if (error) {
    throw error;
  }

  await markInventoryPartialState(itemId, getNextPartialState(data.partial_state));
}

export async function recordCookedEventAndDepleteInventory(input: {
  householdId: string;
  recipeId?: string | null;
  servings?: number | null;
  usedItems: { normalizedName: string; amount?: number | null; unit?: string | null }[];
}) {
  const supabase = getSupabaseClient();

  const ops = [];
  for (const item of input.usedItems) {
    ops.push(
      ...(await computeDepletionOps(
        input.householdId,
        item.normalizedName,
        item.amount ?? 1,
        item.unit ?? "item",
      )),
    );
  }

  // Single transaction: all depletion ops + the cooked event land together
  // (cooked_by is auth.uid() inside the RPC).
  const { error } = await supabase.rpc("apply_cook", {
    p_household_id: input.householdId,
    p_ops: ops,
    p_recipe_id: input.recipeId ?? null,
    p_servings: input.servings ?? null,
    p_used_items: input.usedItems,
  });

  if (error) {
    throw error;
  }
}
