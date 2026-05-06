// Stage 1B-A · Per-request Supabase client bound to caller JWT.
// All reads go through Stage 1A RLS — service role is never used here.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { HttpError } from "./errors.ts";

export interface CallerContext {
  client: SupabaseClient;
  userId: string;
  email: string | null;
  jwt: string;
}

export async function authenticate(req: Request): Promise<CallerContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw new HttpError("unauthenticated", "Missing bearer token");
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) throw new HttpError("unauthenticated", "Empty bearer token");

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    throw new HttpError("internal_error", "Server misconfigured");
  }

  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getClaims(jwt);
  if (error || !data?.claims?.sub) {
    throw new HttpError("unauthenticated", "Invalid token");
  }

  return {
    client,
    userId: String(data.claims.sub),
    email: (data.claims.email as string | undefined) ?? null,
    jwt,
  };
}
