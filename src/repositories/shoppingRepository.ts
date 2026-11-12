import { getSupabaseClient } from "@/lib/supabase";
import { foodMatchKey } from "@/lib/foodIcons";
import { capitalize } from "@/lib/text";
import { canonicalFoodName } from "@/services/inventoryRules";

export type ShoppingListItem = {
  id: string;
  name: string;
  normalized_name: string;
  food_key: string | null;
  /** Null: the household's list. Set: that member's own list (only they see it). */
  owner_id: string | null;
  checked_at: string | null;
  created_at: string;
};

export type BuyAgainItem = {
  name: string;
  normalized_name: string;
  /** Catalog food, else normalized name: what a dismissal is keyed by. */
  item_key: string;
  /** The last one was thrown out: suggest buying less. */
  thrown_out: boolean;
};

export type ShoppingReminder = { days: number[]; hour: number };

/** Open items plus anything ticked in the last day, so a tick can be undone. */
export async function listShoppingItems(householdId: string): Promise<ShoppingListItem[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("id, name, normalized_name, food_key, owner_id, checked_at, created_at")
    .eq("household_id", householdId)
    .or(`checked_at.is.null,checked_at.gt.${since}`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ShoppingListItem[]).map((item) => ({ ...item, name: capitalize(item.name) }));
}

/** Adds to the household's list, or with `personal` to the user's own. */
export async function addShoppingItem(householdId: string, name: string, personal = false): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const trimmed = capitalize(name.trim().replace(/\s+/g, " ").slice(0, 80));
  const { error } = await supabase.from("shopping_list_items").insert({
    household_id: householdId,
    name: trimmed,
    normalized_name: canonicalFoodName(trimmed),
    food_key: foodMatchKey(trimmed),
    added_by: userResult.user.id,
    owner_id: personal ? userResult.user.id : null,
  });
  if (error) throw error;
}

export async function setShoppingItemChecked(id: string, checked: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("shopping_list_items")
    .update({ checked_at: checked ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function setShoppingItemsChecked(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("shopping_list_items")
    .update({ checked_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", id);
  if (error) throw error;
}

/** Used-up staples (bought on 2+ days lately, none left, not on the list). */
export async function listBuyAgain(householdId: string): Promise<BuyAgainItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("buy_again", { p_household: householdId });
  if (error) throw error;
  return (data ?? []) as BuyAgainItem[];
}

/** item_key → when it was dismissed. Hidden until that food is added again. */
export async function listShoppingDismissals(householdId: string): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("shopping_dismissals")
    .select("item_key, dismissed_at")
    .eq("household_id", householdId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.item_key, row.dismissed_at]));
}

export async function dismissShoppingSuggestion(householdId: string, itemKey: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { error } = await supabase.from("shopping_dismissals").upsert(
    {
      household_id: householdId,
      item_key: itemKey,
      dismissed_by: userResult.user.id,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: "household_id,item_key" },
  );
  if (error) throw error;
}

export async function getShoppingReminder(householdId: string): Promise<ShoppingReminder> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("household_notification_settings")
    .select("shopping_reminder_days, shopping_reminder_hour")
    .eq("household_id", householdId)
    .single<{ shopping_reminder_days: number[]; shopping_reminder_hour: number }>();
  if (error) throw error;
  return { days: data.shopping_reminder_days ?? [], hour: data.shopping_reminder_hour ?? 10 };
}

export async function updateShoppingReminder(householdId: string, reminder: ShoppingReminder): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("household_notification_settings")
    .update({ shopping_reminder_days: reminder.days, shopping_reminder_hour: reminder.hour })
    .eq("household_id", householdId);
  if (error) throw error;
}
