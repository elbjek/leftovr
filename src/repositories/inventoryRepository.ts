import { getSupabaseClient } from "@/lib/supabase";
import {
  computeUrgency,
  getCatalogFood,
  getCatalogNet,
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

/**
 * Deplete `amount` units of an item across all of its active lots, consuming the
 * soonest-to-expire lots first (urgent → use_soon → safe, then oldest added).
 * Used when cooking a recipe or marking an item used from the fridge, so the
 * count drops correctly even when the item is split across multiple lots.
 */
export async function depleteItemQuantity(
  householdId: string,
  normalizedName: string,
  amount = 1,
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, quantity, partial_state, unit, urgency, added_at")
    .eq("household_id", householdId)
    .eq("normalized_name", normalizedName)
    .is("removed_at", null);

  if (error) {
    throw error;
  }

  const lots = (data ?? []) as {
    id: string;
    quantity: number;
    partial_state: PartialState;
    unit: string;
    urgency: "safe" | "use_soon" | "urgent" | null;
    added_at: string;
  }[];

  lots.sort((a, b) => {
    const rank = urgencyDepletionRank(b.urgency) - urgencyDepletionRank(a.urgency);
    if (rank !== 0) return rank;
    return a.added_at.localeCompare(b.added_at);
  });

  let remaining = Math.max(1, amount);

  for (const lot of lots) {
    if (remaining <= 0) break;

    if (lot.quantity > 1) {
      const consume = Math.min(lot.quantity, remaining);
      const nextQuantity = lot.quantity - consume;
      if (nextQuantity <= 0) {
        await removeInventoryLot(lot.id, "cooked");
      } else {
        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({
            quantity: nextQuantity,
            display_quantity: formatDisplayQuantity(nextQuantity, lot.unit),
          })
          .eq("id", lot.id);
        if (updateError) {
          throw updateError;
        }
      }
      remaining -= consume;
    } else {
      // Single-unit lot: advance partial state (or remove). Counts as one unit.
      const depletion = getDepletionUpdate(lot, 1);
      if (depletion.shouldRemove) {
        await removeInventoryLot(lot.id, "cooked");
      } else {
        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({
            quantity: depletion.quantity,
            partial_state: depletion.partialState,
            display_quantity: formatDisplayQuantity(depletion.quantity, lot.unit),
          })
          .eq("id", lot.id);
        if (updateError) {
          throw updateError;
        }
      }
      remaining -= 1;
    }
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
  usedItems: { normalizedName: string; amount?: number | null }[];
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
    await depleteItemQuantity(input.householdId, item.normalizedName, item.amount ?? 1);
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
