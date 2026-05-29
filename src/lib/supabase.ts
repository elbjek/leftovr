import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock, SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

import { env, getRequiredEnv } from "./env";

let client: SupabaseClient | null = null;

export function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function getSupabaseClient() {
  if (client) {
    return client;
  }

  client = createClient(getRequiredEnv("supabaseUrl"), getRequiredEnv("supabaseAnonKey"), {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
    },
  });

  return client;
}
