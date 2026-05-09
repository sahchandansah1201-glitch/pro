// Stage 1G-A · Supabase browser client (singleton).
//
// Lives in src/lib/ (outside the doctor hygiene scan target). Returns null
// when env vars are absent so the app keeps working in pure demo mode.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "dermpro.auth";

function readEnv(name: string): string | null {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string | undefined> })
      ?.env?.[name];
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function getUrl(): string | null {
  const v = readEnv("VITE_SUPABASE_URL");
  return v ? v.replace(/\/+$/, "") : null;
}

function getKey(): string | null {
  return readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
}

export function isSupabaseConfigured(): boolean {
  return getUrl() !== null && getKey() !== null;
}

export function getSupabaseUrl(): string | null {
  return getUrl();
}

let _client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  const url = getUrl();
  const key = getKey();
  if (!url || !key) {
    _client = null;
    return _client;
  }
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY,
    },
  });
  return _client;
}

/** Test-only: drop the cached singleton so a fresh env can be picked up. */
export function __resetSupabaseClientForTests(): void {
  _client = undefined;
}
