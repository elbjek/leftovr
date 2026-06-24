import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { updateNotificationPreferences } from "@/repositories/notificationRepository";
import { InventoryGroup } from "./inventoryRules";

export type DailySuggestion = {
  title: string;
  body: string;
  items: string[];
};

/** Requests permission, fetches the Expo push token, and persists it. Idempotent. */
export async function registerDevice(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  await updateNotificationPreferences({ permission_status: status === "granted" ? "granted" : "denied" });
  if (status !== "granted") return false;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await updateNotificationPreferences({ push_token: token, platform: Platform.OS });
  return true;
}

export function previewDailySuggestion(
  groups: InventoryGroup[],
  primaryGoal: string | null,
): DailySuggestion | null {
  const urgentItems = groups
    .filter((g) => g.urgency === "urgent")
    .map((g) => g.name);
  const useSoonItems = groups
    .filter((g) => g.urgency === "use_soon")
    .map((g) => g.name);

  const priorityItems = [...urgentItems, ...useSoonItems];

  if (priorityItems.length === 0) return null;

  const topItems = priorityItems.slice(0, 3);

  const goalFraming =
    primaryGoal === "money"
      ? "Save money tonight"
      : primaryGoal === "quick"
        ? "Quick dinner idea"
        : "Use it before it goes";

  return {
    title: goalFraming,
    body: `Tonight: cook with ${topItems.join(", ")}${priorityItems.length > 3 ? ` and ${priorityItems.length - 3} more` : ""}.`,
    items: topItems,
  };
}
