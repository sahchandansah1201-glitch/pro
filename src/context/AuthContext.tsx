// Stage 1G-A · AuthProvider.
//
// Wraps the app once. Owns the Supabase auth subscription, exposes session
// state + sign-in/sign-out methods. When Supabase is not configured the
// provider stays in `anonymous` status so the demo role switcher keeps
// working unchanged.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import {
  getSupabaseClient,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase-client";
import { AuthContext, type AuthContextValue, type AuthStatus } from "@/context/auth-context";

interface State {
  status: AuthStatus;
  session: Session | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const apiBaseUrl = useMemo(() => getSupabaseUrl(), []);
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = useMemo(() => getSupabaseClient(), []);

  const [state, setState] = useState<State>(() => ({
    status: configured ? "loading" : "anonymous",
    session: null,
  }));

  // Track mount so async results don't race after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!client) return;

    // Subscribe BEFORE getSession() per Lovable cloud-auth guidance.
    const sub = client.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      if (event === "SIGNED_OUT") {
        setState({ status: "anonymous", session: null });
        return;
      }
      // SIGNED_IN, TOKEN_REFRESHED, INITIAL_SESSION, USER_UPDATED, etc.
      setState({
        status: session ? "authenticated" : "anonymous",
        session: session ?? null,
      });
    });

    client.auth
      .getSession()
      .then(({ data }) => {
        if (!mountedRef.current) return;
        setState({
          status: data.session ? "authenticated" : "anonymous",
          session: data.session ?? null,
        });
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setState({ status: "anonymous", session: null });
      });

    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, [client]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!client) return { error: new Error("Supabase is not configured") };
      const { error } = await client.auth.signInWithPassword({ email, password });
      return { error: error ?? null };
    },
    [client],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!client) return { error: new Error("Supabase is not configured") };
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    return { error: error ?? null };
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) {
      setState({ status: "anonymous", session: null });
      return { error: null };
    }
    const { error } = await client.auth.signOut();
    return { error: error ?? null };
  }, [client]);

  const value = useMemo<AuthContextValue>(() => {
    const user: User | null = state.session?.user ?? null;
    const accessToken =
      state.status === "authenticated" ? state.session?.access_token ?? null : null;
    return {
      status: state.status,
      session: state.session,
      user,
      accessToken,
      apiBaseUrl: state.status === "authenticated" ? apiBaseUrl : null,
      signInWithPassword,
      signInWithGoogle,
      signOut,
    };
  }, [state, apiBaseUrl, signInWithPassword, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
