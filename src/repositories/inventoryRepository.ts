import { getSupabaseClient } from "@/lib/supabase";
import {
  computeUrgency,
  getCatalogFood,
  getDepletionUpdate,
  getNextPartialState,
  getShelfLifeRange,
  inferCategory,
  InventoryCategory,
  InventoryLot,
  InventorySource,
  normalizeFoodName,
  PartialState,
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
      "id, household_id, name, normalized_name, category, quantity, unit, display_quantity, partial_state, urgency, shelf_life_range, source, added_at, removed_at, added_by, profiles!added_by(display_name)",
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

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      household_id: input.householdId,
      name,
      normalized_name: normalizeFoodName(name),
      category,
      quantity,
      unit,
      display_quantity: formatDisplayQuantity(quantity, unit),
      partial_state: "full" satisfies PartialState,
      urgency,
      shelf_life_range: getShelfLifeRange(name, category),
      source: input.source ?? "manual",
      added_by: userId,
      added_at: addedAt,
    })
    .select(
      "id, household_id, name, normalized_name, category, quantity, unit, display_quantity, partial_state, urgency, shelf_life_range, source, added_at, removed_at",
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

export async function depleteInventoryLot(itemId: string) {
  const supabase = getSupabaseClient();
  const { data: lot, error: lotError } = await supabase
    .from("inventory_items")
    .select("id, quantity, partial_state, unit")
    .eq("id", itemId)
    .is("removed_at", null)
    .single<Pick<InventoryLot, "id" | "quantity" | "partial_state" | "unit">>();

  if (lotError) {
    throw lotError;
  }

  const depletion = getDepletionUpdate(lot);

  if (depletion.shouldRemove) {
    await removeInventoryLot(itemId, "cooked");
    return;
  }

  const { error } = await supabase
    .from("inventory_items")
    .update({
      quantity: depletion.quantity,
      partial_state: depletion.partialState,
      display_quantity: formatDisplayQuantity(depletion.quantity, lot.unit),
    })
    .eq("id", itemId);

  if (error) {
    throw error;
  }
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
  usedItemIds: string[];
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

  await Promise.all(input.usedItemIds.map((itemId) => depleteInventoryLot(itemId)));

  const { error } = await supabase.from("cooked_events").insert({
    household_id: input.householdId,
    recipe_id: input.recipeId ?? null,
    cooked_by: userId,
    servings: input.servings ?? null,
    used_items: input.usedItemIds.map((id) => ({ id })),
    removed_item_ids: input.usedItemIds,
  });

  if (error) {
    throw error;
  }
}

function formatDisplayQuantity(quantity: number, unit: string) {
  const roughQuantity = Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(1));
  return `${roughQuantity} ${unit}`;
}
