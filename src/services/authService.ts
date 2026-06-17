import { env } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";

let googleConfigured = false;

// Lazily require the native module so importing this file never crashes the app
// at boot when the native module isn't in the current binary (e.g. an old dev
// client, Expo Go, or a web export). It is only touched when the user actually
// taps "Continue with Google".
function getGoogleSignin() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@react-native-google-signin/google-signin");
  if (!googleConfigured) {
    mod.GoogleSignin.configure({
      // Web client ID is what Supabase verifies the ID token against.
      webClientId: env.googleWebClientId,
      iosClientId: env.googleIosClientId,
    });
    googleConfigured = true;
  }
  return mod;
}

/**
 * Native Google sign-in: opens the system Google flow, then exchanges the
 * returned ID token for a Supabase session via signInWithIdToken. Requires a
 * dev client / native build (not Expo Go) and the EXPO_PUBLIC_GOOGLE_* client
 * IDs to be set. Returns null when the user cancels.
 */
export async function signInWithGoogle() {
  const { GoogleSignin, isSuccessResponse, statusCodes } = getGoogleSignin();
  const supabase = getSupabaseClient();

  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return null;
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error("Google sign-in did not return an ID token.");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    if ((error as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw error;
  }
}

export async function signUpWithEmail({
  displayName,
  email,
  password,
}: {
  displayName: string;
  email: string;
  password: string;
}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithEmail({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function sendEmailOtp({
  email,
  displayName,
  shouldCreateUser,
}: {
  email: string;
  displayName?: string;
  shouldCreateUser: boolean;
}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser,
      data: displayName ? { display_name: displayName } : undefined,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function verifyEmailOtp({ email, token }: { email: string; token: string }) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    throw error;
  }

  return data;
}
