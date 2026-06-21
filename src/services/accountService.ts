import { Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import { getSupabaseClient } from "@/lib/supabase";

/** Fetch the user's full data export and hand it to the OS share sheet as a JSON file. */
export async function exportAccountData(): Promise<void> {
  const { data, error } = await getSupabaseClient().functions.invoke("export-data", { body: {} });
  if (error) throw error;

  const json = JSON.stringify(data, null, 2);
  const path = `${FileSystem.cacheDirectory}leftovr-data-export.json`;
  await FileSystem.writeAsStringAsync(path, json);
  await Share.share({ url: path, title: "leftovr data export" });
}

/** Permanently delete the account and all personal data (handled server-side). */
export async function deleteAccount(): Promise<void> {
  const { error } = await getSupabaseClient().functions.invoke("delete-account", { body: {} });
  if (error) throw error;
}
