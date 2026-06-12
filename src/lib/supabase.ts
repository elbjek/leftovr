import { createClient, processLock, SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

import { env, getRequiredEnv } from "./env";
import { LargeSecureStore } from "./secureStore";

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
      // Encrypted-at-rest session storage (SECURITY_REVIEW S5).
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
      lockAcquireTimeout: 5000,
    },
  });

  return client;
}
