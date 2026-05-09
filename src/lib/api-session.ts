// Stage 1F · Frontend API session helper.
//
// Reads the current Supabase access token + project URL from the standard
// browser storage layout used by @supabase/supabase-js v2, without taking a
// dependency on that package. Returns `{ null, null }` whenever anything is
// missing, malformed, or expired so the caller can preserve demo behavior.
//
// This module lives in `src/lib/` (outside the doctor hygiene scan target)
// and is the ONLY place that touches `localStorage` / `window` for the
// clinical assets API session.

import { useEffect, useState } from "react";

export interface ApiSession {
  apiToken: string | null;
  apiBaseUrl: string | null;
}

const NULL_SESSION: ApiSession = { apiToken: null, apiBaseUrl: null };

/** Custom event fired by future in-app login/logout flows to refresh sessions. */
export const AUTH_CHANGED_EVENT = "dermpro:auth-changed";

function getEnvSupabaseUrl(): string | null {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string | undefined> })
      ?.env?.VITE_SUPABASE_URL;
    if (typeof v !== "string") return null;
    const trimmed = v.trim().replace(/\/+$/, "");
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function projectRefFromUrl(url: string): string | null {
  // Supports https://<ref>.supabase.co and https://<ref>.supabase.in
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i);
  return m ? m[1] : null;
}

interface RawSession {
  access_token?: unknown;
  expires_at?: unknown;
  currentSession?: { access_token?: unknown; expires_at?: unknown };
}

function extractToken(parsed: RawSession): { token: string | null; expiresAt: number | null } {
  const node = parsed?.currentSession ?? parsed;
  const token = typeof node?.access_token === "string" && node.access_token.length > 0
    ? node.access_token
    : null;
  const expiresAt = typeof node?.expires_at === "number" ? node.expires_at : null;
  return { token, expiresAt };
}

/**
 * Synchronously read the current API session from environment + browser storage.
 * Never throws; returns `{ null, null }` on any error / missing data / expiry.
 *
 * @param now Optional unix-seconds clock for tests.
 */
export function readSupabaseSession(now: number = Math.floor(Date.now() / 1000)): ApiSession {
  const baseUrl = getEnvSupabaseUrl();
  if (!baseUrl) return NULL_SESSION;

  const ref = projectRefFromUrl(baseUrl);
  if (!ref) return NULL_SESSION;

  if (typeof window === "undefined" || !window.localStorage) return NULL_SESSION;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
  } catch {
    return NULL_SESSION;
  }
  if (!raw) return NULL_SESSION;

  let parsed: RawSession;
  try {
    parsed = JSON.parse(raw) as RawSession;
  } catch {
    return NULL_SESSION;
  }

  const { token, expiresAt } = extractToken(parsed);
  if (!token) return NULL_SESSION;
  if (expiresAt !== null && expiresAt <= now) return NULL_SESSION;

  return { apiToken: token, apiBaseUrl: baseUrl };
}

/**
 * React hook returning the current API session. Re-evaluates on mount, on
 * cross-tab `storage` events, and on the in-app `dermpro:auth-changed` event.
 */
export function useApiSession(): ApiSession {
  const [session, setSession] = useState<ApiSession>(() => readSupabaseSession());

  useEffect(() => {
    const refresh = () => setSession(readSupabaseSession());
    refresh();
    if (typeof window === "undefined") return;
    window.addEventListener("storage", refresh);
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
    };
  }, []);

  return session;
}
