import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { updateNotificationPreferences } from "@/repositories/notificationRepository";


/** Requests permission, fetches the Expo push token, and persists it. Idempotent. */
export async function registerDevice(): Promise<boolean> {
  // Android 13+ shows no permission prompt and returns no push token until a
  // channel exists. "default" is the channel Expo push uses when none is set.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Leftovr",
      importance: AndroidImportance.HIGH,
    });
  }
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

