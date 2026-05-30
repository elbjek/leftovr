import { getSupabaseClient } from "@/lib/supabase";

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
