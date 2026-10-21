import { getSupabaseClient } from "@/lib/supabase";
import { valueOfAmount, deriveUnitPrice } from "@/lib/money";
import {
  insertValueEvent,
  fetchPricedLots,
  categoryAverageUnitPrice,
} from "./valueEventRepository";
import {
  canonicalFoodName,
  getCatalogFood,
  getCatalogNet,
  getGramsPerItem,
  getNextPartialState,
  getShelfLifeRange,
  inferCategory,
  InventoryCategory,
  InventoryLot,
  InventorySource,
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
  /** Total price paid for this lot, in household currency. Null/undefined = approximate. */
  price?: number | null;
};

export async function listActiveHouseholdInventory(householdId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select(
      "id, household_id, name, normalized_name, brand_name, category, quantity, unit, net_amount, net_unit, partial_state, shelf_life_range, expires_at, source, added_at, removed_at, added_by, purchase_price, purchase_amount, profiles!added_by(display_name)",
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
    purchase_price: row.purchase_price ?? null,
    purchase_amount: row.purchase_amount ?? null,
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
  // purchase_amount: the amount the price covers, for proportional attribution.
  const purchaseAmount = netAmount ?? quantity;

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      household_id: input.householdId,
      name,
      normalized_name: canonicalFoodName(name),
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
      purchase_price: input.price ?? null,
      purchase_amount: input.price != null ? purchaseAmount : null,
    })
    .select(
      "id, household_id, name, normalized_name, brand_name, category, quantity, unit, net_amount, net_unit, partial_state, shelf_life_range, expires_at, source, added_at, removed_at, purchase_price, purchase_amount",
    )
    .single<InventoryLot>();

  if (error) {
    throw error;
  }

  // Money: emit a spend event. Use the entered price, else approximate from the
  // household's own category averages (cold start => value 0 => skipped).
  let spendValue = input.price ?? 0;
  if (input.price == null) {
    const lots = await fetchPricedLots(input.householdId);
    spendValue = valueOfAmount(
      purchaseAmount,
      categoryAverageUnitPrice(lots, category, netAmount != null ? netUnit : null),
    );
  }
  await insertValueEvent({
    householdId: input.householdId,
    kind: "spend",
    value: spendValue,
    normalizedName: canonicalFoodName(name),
    category,
    createdBy: userId,
  });

  return data;
}

type RemovableLot = Pick<
  InventoryLot,
  "id" | "normalized_name" | "category" | "net_amount" | "quantity" | "purchase_price" | "purchase_amount"
>;

/**
 * Remove lots and record the money outcome of the amount that left inventory:
 * "used" → saved, "discarded" → wasted. Each priced lot's remaining amount is
 * valued at its unit price.
 */
export async function removeInventoryGroup(
  lots: RemovableLot[],
  reason: "used" | "discarded",
  householdId: string,
) {
  if (lots.length === 0) return;
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("inventory_items")
    .update({ removed_at: new Date().toISOString(), removal_reason: reason })
    .in("id", lots.map((lot) => lot.id));

  if (error) {
    throw error;
  }

  // "Used it" is a use, like cooking: log it so Insights' "items saved"
  // counts it (C7). One event per distinct food, matching apply_cook.
  if (reason === "used") {
    const { data: userResult } = await supabase.auth.getUser();
    const userId = userResult.user?.id;
    if (userId) {
      const byFood = new Map(lots.map((lot) => [lot.normalized_name, lot.category]));
      const { error: usageError } = await supabase.from("item_usage_events").insert(
        [...byFood].map(([normalizedName, category]) => ({
          household_id: householdId,
          normalized_name: normalizedName,
          category,
          used_by: userId,
        })),
      );
      if (usageError && __DEV__) console.warn("[inventory] usage event failed", usageError);
    }
  }

  const kind = reason === "discarded" ? "wasted" : "saved";
  for (const lot of lots) {
    const unit = deriveUnitPrice(lot.purchase_price, lot.purchase_amount);
    const remaining = lot.net_amount ?? lot.quantity;
    await insertValueEvent({
      householdId,
      kind,
      value: valueOfAmount(remaining, unit),
      normalizedName: lot.normalized_name,
      category: lot.category,
    });
  }
}

async function markInventoryPartialState(itemId: string, partialState: PartialState) {
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

  // Expired lots are never cooked with — they wait in "Check these" for the
  // user to vouch for or toss, so depletion must not consume them.
  const usableLots = lots.filter((lot) => resolveUrgency(lot) !== "expired");

  // Most-urgent first (urgency computed live, not from the dropped column),
  // then soonest-added — so depletion spills out the at-risk lots first.
  usableLots.sort((a, b) => {
    const rank = urgencyRank(resolveUrgency(b)) - urgencyRank(resolveUrgency(a));
    if (rank !== 0) return rank;
    return a.added_at.localeCompare(b.added_at);
  });

  return planDepletion(usableLots, { amount, unit }, { gramsPerItem: getGramsPerItem(normalizedName) });
}

export type UpdateInventoryItemInput = {
  name?: string;
  category?: InventoryCategory;
  quantity?: number;
  unit?: string;
  expiresAt?: string | null;
  netAmount?: number | null;
};

// Edits one lot. When the name changes we also recompute normalized_name (so
// grouping + depletion still match) and shelf_life_range (so urgency stays
// consistent for items without an explicit expiry).
export async function updateInventoryItem(itemId: string, input: UpdateInventoryItemInput) {
  const supabase = getSupabaseClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("name is required");
    const category = input.category ?? inferCategory(name);
    patch.name = name;
    patch.normalized_name = canonicalFoodName(name);
    patch.category = category;
    patch.shelf_life_range = getShelfLifeRange(name, category);
  }
  if (input.quantity !== undefined) {
    if (!(input.quantity > 0)) throw new Error("quantity must be positive");
    patch.quantity = input.quantity;
  }
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt;
  if (input.netAmount !== undefined) {
    if (input.netAmount != null && !(input.netAmount > 0)) throw new Error("net amount must be positive");
    patch.net_amount = input.netAmount;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("inventory_items").update(patch).eq("id", itemId);
  if (error) throw error;
}

// "Still good" on an expired group: the user vouched for the food, so write
// an explicit expiry date on every lot at once.
export async function setInventoryLotsExpiry(lotIds: string[], expiresAt: string) {
  if (lotIds.length === 0) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ expires_at: expiresAt })
    .in("id", lotIds);
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
  /** Same id on every retry of one cook; apply_cook skips an id it already applied. */
  cookId?: string;
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
    p_cook_id: input.cookId ?? null,
  });

  if (error) {
    throw error;
  }
}
