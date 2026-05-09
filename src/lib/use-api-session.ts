// Stage 1G-A · API session hook backed by AuthContext.
//
// Returns `{ apiToken, apiBaseUrl }` when the user is authenticated against
// a configured Supabase project, otherwise `{ null, null }`. Replaces the
// Stage 1F localStorage parser. Lives in src/lib/ (outside doctor scan).

import { useContext } from "react";
import { AuthContext } from "@/context/auth-context";

export interface ApiSession {
  apiToken: string | null;
  apiBaseUrl: string | null;
}

const NULL_SESSION: ApiSession = { apiToken: null, apiBaseUrl: null };

export function useApiSession(): ApiSession {
  const ctx = useContext(AuthContext);
  if (!ctx) return NULL_SESSION;
  if (ctx.status !== "authenticated") return NULL_SESSION;
  if (!ctx.accessToken || !ctx.apiBaseUrl) return NULL_SESSION;
  return { apiToken: ctx.accessToken, apiBaseUrl: ctx.apiBaseUrl };
}
