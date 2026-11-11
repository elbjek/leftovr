import { getSupabaseClient } from "@/lib/supabase";
import { canonicalFoodName } from "@/services/inventoryRules";

export type ShoppingListItem = {
  id: string;
  name: string;
  normalized_name: string;
  checked_at: string | null;
  created_at: string;
};

export type BuyAgainItem = { name: string; normalized_name: string };

export type ShoppingReminder = { days: number[]; hour: number };

/** Open items plus anything ticked in the last day, so a tick can be undone. */
export async function listShoppingItems(householdId: string): Promise<ShoppingListItem[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("id, name, normalized_name, checked_at, created_at")
    .eq("household_id", householdId)
    .or(`checked_at.is.null,checked_at.gt.${since}`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShoppingListItem[];
}

export async function addShoppingItem(householdId: string, name: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 80);
  const { error } = await supabase.from("shopping_list_items").insert({
    household_id: householdId,
    name: trimmed,
    normalized_name: canonicalFoodName(trimmed),
    added_by: userResult.user.id,
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
