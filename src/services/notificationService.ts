import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { updateNotificationPreferences } from "@/repositories/notificationRepository";


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

