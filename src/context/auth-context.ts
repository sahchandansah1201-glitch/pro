// Stage 1G-A · AuthContext value type + context object.
//
// Split from the provider component to satisfy react-refresh and to allow
// tests / hooks to import the context object without pulling in providers.

import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  apiBaseUrl: string | null;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
