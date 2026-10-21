import { getSupabaseClient } from "@/lib/supabase";

export type NotificationPreferences = {
  id: string;
  user_id: string;
  permission_status: "not_determined" | "granted" | "denied" | "provisional";
  notifications_enabled: boolean;
  smart_suggestions_enabled: boolean;
  member_activity_enabled: boolean;
  tips_enabled: boolean;
  reengagement_enabled: boolean;
  push_token: string | null;
  platform: string | null;
};

export type HouseholdNotificationSettings = {
  id: string;
  household_id: string;
  daily_suggestion_enabled: boolean;
  recap_enabled: boolean;
  send_window_start: string;
  send_window_end: string;
  last_suggestion_at: string | null;
  last_suggestion_payload: Record<string, unknown> | null;
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("id, user_id, permission_status, notifications_enabled, smart_suggestions_enabled, member_activity_enabled, tips_enabled, reengagement_enabled, push_token, platform")
    .eq("user_id", userResult.user.id)
    .single<NotificationPreferences>();

  if (error) throw error;
  return data;
}

export async function updateNotificationPreferences(
  updates: Partial<Pick<NotificationPreferences, "permission_status" | "notifications_enabled" | "smart_suggestions_enabled" | "member_activity_enabled" | "tips_enabled" | "reengagement_enabled" | "push_token" | "platform">>,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { error } = await supabase
    .from("notification_preferences")
    .update(updates)
    .eq("user_id", userResult.user.id);

  if (error) throw error;
}

export async function updateLastActive(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult.user) return;
  await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", userResult.user.id);
}

/** Keeps the active household's send-window timezone in sync with this device
 *  (B18: nothing wrote it, so every household ran in UTC). Last device wins. */
export async function syncHouseholdTimezone(timezone: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult.user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_household_id")
    .eq("id", userResult.user.id)
    .single<{ active_household_id: string | null }>();
  if (!profile?.active_household_id) return;
  await supabase
    .from("household_notification_settings")
    .update({ timezone })
    .eq("household_id", profile.active_household_id)
    .neq("timezone", timezone);
}

export async function getHouseholdNotificationSettings(
  householdId: string,
): Promise<HouseholdNotificationSettings> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("household_notification_settings")
    .select("id, household_id, daily_suggestion_enabled, recap_enabled, send_window_start, send_window_end, last_suggestion_at, last_suggestion_payload")
    .eq("household_id", householdId)
    .single<HouseholdNotificationSettings>();

  if (error) throw error;
  return data;
}

export async function updateHouseholdNotificationSettings(
  householdId: string,
  updates: Partial<Pick<HouseholdNotificationSettings, "daily_suggestion_enabled" | "recap_enabled" | "send_window_start" | "send_window_end">>,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("household_notification_settings")
    .update(updates)
    .eq("household_id", householdId);

  if (error) throw error;
}

export async function getSuccessfulReceiptScanCount(householdId: string): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from("receipt_scans")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("status", "completed")
    // Shared table: the receipt-adoption nudge counts receipt scans only.
    .eq("scan_type", "receipt");

  if (error) throw error;
  return count ?? 0;
}

export async function markCookedCoachmarkSeen(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { error } = await supabase
    .from("profiles")
    .update({ cooked_coachmark_seen_at: new Date().toISOString() })
    .eq("id", userResult.user.id);

  if (error) throw error;
}
