import { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  completeHouseholdFirstFill,
  getCurrentProfile,
  getHouseholdById,
  getHouseholdItemCount,
} from "@/repositories";
import { sendEmailOtp, signInWithEmail, signOut, signUpWithEmail, verifyEmailOtp } from "@/services";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import { i18n } from "@/i18n";

import { AuthState, Household } from "./types";

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return i18n.t("auth.genericError");
}

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  sendOtp: (input: { email: string; displayName?: string; shouldCreateUser: boolean }) => Promise<void>;
  verifyOtp: (input: { email: string; token: string }) => Promise<void>;
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
        error: i18n.t("auth.missingSupabaseConfig"),
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

        if (!activeHousehold.first_fill_completed_at) {
          const activeItemCount = await getHouseholdItemCount(activeHousehold.id);

          if (activeItemCount > 0) {
            await completeHouseholdFirstFill(activeHousehold.id);
            activeHousehold = await getHouseholdById(activeHousehold.id);
          }
        }
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
      console.error("[auth] loadSessionProfile failed", error);
      setState((current) => ({
        ...current,
        configured: hasSupabaseConfig(),
        loading: false,
        error: resolveErrorMessage(error),
      }));
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setState({
        ...initialState,
        configured: false,
        loading: false,
        error: i18n.t("auth.missingSupabaseConfig"),
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
      sendOtp: async (input) => {
        setState((current) => ({ ...current, loading: true, error: null }));
        try {
          await sendEmailOtp(input);
          setState((current) => ({ ...current, loading: false, error: null }));
        } catch (error) {
          console.error("[auth] sendOtp failed", error);
          setState((current) => ({
            ...current,
            loading: false,
            error: resolveErrorMessage(error),
          }));
          throw error;
        }
      },
      verifyOtp: async (input) => {
        setState((current) => ({ ...current, loading: true, error: null }));
        try {
          await verifyEmailOtp(input);
          await loadSessionProfile();
        } catch (error) {
          console.error("[auth] verifyOtp failed", error);
          setState((current) => ({
            ...current,
            loading: false,
            error: resolveErrorMessage(error),
          }));
          throw error;
        }
      },
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
