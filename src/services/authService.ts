import { env } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";
import { updateNotificationPreferences } from "@/repositories/notificationRepository";

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

/**
 * Native Apple sign-in (iOS only): opens the system Apple flow, then exchanges
 * the returned identity token for a Supabase session via signInWithIdToken.
 * Requires a dev client / native build (not Expo Go) and `usesAppleSignIn` in
 * app.json. Apple only returns the user's name on the first sign-in, so we
 * persist it to user metadata when present. Returns null when the user cancels.
 */
export async function signInWithApple() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AppleAuthentication = require("expo-apple-authentication");
  const supabase = getSupabaseClient();

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple sign-in did not return an identity token.");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });

    if (error) {
      throw error;
    }

    // Apple only provides the full name on the very first authorization; persist
    // it as display_name so the profile matches the email/Google paths.
    const fullName = credential.fullName;
    const displayName = [fullName?.givenName, fullName?.familyName]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (displayName) {
      await supabase.auth.updateUser({ data: { display_name: displayName } });
    }

    return data;
  } catch (error) {
    if ((error as { code?: string })?.code === "ERR_REQUEST_CANCELED") {
      return null;
    }
    throw error;
  }
}

export async function signOut() {
  const supabase = getSupabaseClient();
  // Detach this device from the account first (needs the session that's about
  // to end): otherwise the signed-out phone keeps getting the household's
  // pushes. Best-effort — an offline sign-out must still sign out.
  try {
    await updateNotificationPreferences({ push_token: null });
  } catch (error) {
    if (__DEV__) console.warn("[auth] push token clear failed", error);
  }
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
