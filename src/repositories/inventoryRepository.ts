import { getSupabaseClient } from "@/lib/supabase";
import {
  computeUrgency,
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
} from "@/services";

export type AddInventoryItemInput = {
  householdId: string;
  name: string;
  category?: InventoryCategory;
  quantity?: number;
  unit?: string;
  source?: InventorySource;
  addedAt?: string;
};

export async function listActiveHouseholdInventory(householdId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select(
      "id, household_id, name, normalized_name, category, quantity, unit, display_quantity, net_amount, net_unit, partial_state, urgency, shelf_life_range, source, added_at, removed_at, added_by, profiles!added_by(display_name)",
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
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    net_amount: row.net_amount ?? null,
    net_unit: row.net_unit ?? null,
    display_quantity: row.display_quantity,
    partial_state: row.partial_state,
    urgency: row.urgency,
    shelf_life_range: row.shelf_life_range,
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
  const urgency = computeUrgency({ name, category, addedAt });
  const quantity = input.quantity ?? 1;
  const unit = input.unit ?? catalogItem?.unit ?? "item";
  const catalogNet = getCatalogNet(name);
  const netUnit = catalogNet?.netUnit ?? null;
  const netAmount = catalogNet ? catalogNet.netAmount * quantity : null;

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      household_id: input.householdId,
      name,
      normalized_name: normalizeFoodName(name),
      category,
      quantity,
      unit,
      net_amount: netAmount,
      net_unit: netUnit,
      display_quantity: formatDisplayQuantity(quantity, unit),
      partial_state: "full" satisfies PartialState,
      urgency,
      shelf_life_range: getShelfLifeRange(name, category),
      source: input.source ?? "manual",
      added_by: userId,
      added_at: addedAt,
    })
    .select(
      "id, household_id, name, normalized_name, category, quantity, unit, display_quantity, net_amount, net_unit, partial_state, urgency, shelf_life_range, source, added_at, removed_at",
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
  await Promise.all(lotIds.map((lotId) => removeInventoryLot(lotId, reason)));
}

export async function updateInventoryQuantity(itemId: string, quantity: number) {
  const supabase = getSupabaseClient();

  if (quantity <= 0) {
    await removeInventoryLot(itemId, "quantity_depleted");
    return;
  }

  const { data: current, error: currentError } = await supabase
    .from("inventory_items")
    .select("unit")
    .eq("id", itemId)
    .single<{ unit: string }>();

  if (currentError) {
    throw currentError;
  }

  const { error } = await supabase
    .from("inventory_items")
    .update({
      quantity,
      display_quantity: formatDisplayQuantity(quantity, current.unit),
    })
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

function urgencyDepletionRank(urgency: "safe" | "use_soon" | "urgent" | null) {
  if (urgency === "urgent") return 3;
  if (urgency === "use_soon") return 2;
  return 1;
}

export async function depleteItemQuantity(
  householdId: string,
  normalizedName: string,
  amount = 1,
  unit = "item",
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, quantity, partial_state, unit, urgency, added_at, net_amount, net_unit")
    .eq("household_id", householdId)
    .eq("normalized_name", normalizedName)
    .is("removed_at", null);

  if (error) throw error;

  const lots = (data ?? []) as {
    id: string;
    quantity: number;
    partial_state: PartialState;
    unit: string;
    urgency: "safe" | "use_soon" | "urgent" | null;
    added_at: string;
    net_amount: number | null;
    net_unit: "ml" | "g" | null;
  }[];

  lots.sort((a, b) => {
    const rank = urgencyDepletionRank(b.urgency) - urgencyDepletionRank(a.urgency);
    if (rank !== 0) return rank;
    return a.added_at.localeCompare(b.added_at);
  });

  const ops = planDepletion(lots, { amount, unit });

  for (const op of ops) {
    if (op.kind === "remove") {
      await removeInventoryLot(op.id, "cooked");
      continue;
    }
    const lot = lots.find((l) => l.id === op.id)!;
    const update: Record<string, unknown> = {};
    if (op.kind === "setNet") {
      update.net_amount = op.netAmount;
      update.display_quantity = formatDisplayQuantity(op.netAmount, lot.net_unit ?? lot.unit);
    } else if (op.kind === "setQuantity") {
      update.quantity = op.quantity;
      update.display_quantity = formatDisplayQuantity(op.quantity, lot.unit);
    } else {
      update.partial_state = op.partialState;
    }
    const { error: updateError } = await supabase
      .from("inventory_items")
      .update(update)
      .eq("id", op.id);
    if (updateError) throw updateError;
  }
}

export async function updateInventoryNetAmount(itemId: string, netAmount: number) {
  if (!(netAmount > 0)) throw new Error("net amount must be positive");
  const supabase = getSupabaseClient();
  const { data: lot, error: readError } = await supabase
    .from("inventory_items")
    .select("net_unit, unit")
    .eq("id", itemId)
    .single<{ net_unit: string | null; unit: string }>();
  if (readError) throw readError;
  const { error } = await supabase
    .from("inventory_items")
    .update({
      net_amount: netAmount,
      display_quantity: formatDisplayQuantity(netAmount, lot.net_unit ?? lot.unit),
    })
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
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const userId = userResult.user?.id;

  if (!userId) {
    throw new Error("No signed-in user.");
  }

  // Deplete sequentially so concurrent updates to the same lot can't race.
  for (const item of input.usedItems) {
    await depleteItemQuantity(
      input.householdId,
      item.normalizedName,
      item.amount ?? 1,
      item.unit ?? "item",
    );
  }

  const { error } = await supabase.from("cooked_events").insert({
    household_id: input.householdId,
    recipe_id: input.recipeId ?? null,
    cooked_by: userId,
    servings: input.servings ?? null,
    used_items: input.usedItems,
  });

  if (error) {
    throw error;
  }
}

function formatDisplayQuantity(quantity: number, unit: string) {
  const roughQuantity = Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(1));
  return `${roughQuantity} ${unit}`;
}
