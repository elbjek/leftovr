import { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getCurrentProfile, getHouseholdById } from "@/repositories";
import { signInWithEmail, signOut, signUpWithEmail } from "@/services";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";

import { AuthState, Household } from "./types";

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signUp: (input: { displayName: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthState = {
  configured: hasSupabaseConfig(),
  loading: true,
  session: null,
  user: null,
  profile: null,
  activeHousehold: null,
  error: null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const loadSessionProfile = useCallback(async (sessionOverride?: Session | null) => {
    if (!hasSupabaseConfig()) {
      setState({
        ...initialState,
        configured: false,
        loading: false,
        error: "Missing Supabase environment variables.",
      });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const sessionResult =
        sessionOverride === undefined
          ? await supabase.auth.getSession()
          : { data: { session: sessionOverride }, error: null };

      if (sessionResult.error) {
        throw sessionResult.error;
      }

      const session = sessionResult.data.session;

      if (!session) {
        setState({
          configured: true,
          loading: false,
          session: null,
          user: null,
          profile: null,
          activeHousehold: null,
          error: null,
        });
        return;
      }

      const profile = await getCurrentProfile();
      let activeHousehold: Household | null = null;

      if (profile.active_household_id) {
        activeHousehold = await getHouseholdById(profile.active_household_id);
      }

      setState({
        configured: true,
        loading: false,
        session,
        user: session.user,
        profile,
        activeHousehold,
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        configured: hasSupabaseConfig(),
        loading: false,
        error: error instanceof Error ? error.message : "Something went wrong.",
      }));
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setState({
        ...initialState,
        configured: false,
        loading: false,
        error: "Missing Supabase environment variables.",
      });
      return;
    }

    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSessionProfile(session);
    });

    loadSessionProfile();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSessionProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refresh: () => loadSessionProfile(),
      signIn: async (input) => {
        setState((current) => ({ ...current, loading: true, error: null }));
        await signInWithEmail(input);
        await loadSessionProfile();
      },
      signUp: async (input) => {
        setState((current) => ({ ...current, loading: true, error: null }));
        await signUpWithEmail(input);
        await loadSessionProfile();
      },
      signOut: async () => {
        setState((current) => ({ ...current, loading: true, error: null }));
        await signOut();
        setState({
          configured: hasSupabaseConfig(),
          loading: false,
          session: null,
          user: null,
          profile: null,
          activeHousehold: null,
          error: null,
        });
      },
    }),
    [loadSessionProfile, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
