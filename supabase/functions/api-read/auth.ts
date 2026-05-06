// Stage 1B-A/C · Per-request Supabase client bound to caller JWT.
// All reads go through Stage 1A RLS — service role is never used here.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./errors.ts";

export interface CallerContext {
  client: SupabaseClient;
  userId: string;
  email: string | null;
  jwt: string;
  roles: string[];
}

interface JwtClaims {
  sub: string;
  email?: string;
  exp?: number;
  [k: string]: unknown;
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJsonSegment(seg: string): Record<string, unknown> {
  const bytes = base64UrlDecode(seg);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function verifyHs256Locally(
  jwt: string,
  secret: string,
): Promise<JwtClaims> {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new HttpError("unauthenticated", "Malformed token");
  }
  const [h, p, s] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJsonSegment(h);
    payload = decodeJsonSegment(p);
  } catch {
    throw new HttpError("unauthenticated", "Invalid token encoding");
  }
  if (header.alg !== "HS256") {
    throw new HttpError("unauthenticated", "Unsupported alg");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sig = base64UrlDecode(s);
  const data = new TextEncoder().encode(`${h}.${p}`);
  const ok = await crypto.subtle.verify("HMAC", key, sig, data);
  if (!ok) throw new HttpError("unauthenticated", "Invalid signature");
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new HttpError("unauthenticated", "Missing sub");
  }
  if (typeof payload.exp === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new HttpError("unauthenticated", "Token expired");
    }
  }
  return payload as JwtClaims;
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

  // Supabase CLI strips env vars beginning with SUPABASE_ from --env-file,
  // so prefer API_READ_JWT_SECRET. Fall back to SUPABASE_JWT_SECRET for
  // environments (e.g. hosted) where it is injected by the platform.
  const jwtSecret = Deno.env.get("API_READ_JWT_SECRET") ??
    Deno.env.get("SUPABASE_JWT_SECRET");
  let userId: string;
  let email: string | null;

  if (jwtSecret) {
    const claims = await verifyHs256Locally(jwt, jwtSecret);
    userId = claims.sub;
    email = typeof claims.email === "string" ? claims.email : null;
  } else {
    const { data, error } = await client.auth.getClaims(jwt);
    if (error || !data?.claims?.sub) {
      throw new HttpError("unauthenticated", "Invalid token");
    }
    userId = String(data.claims.sub);
    email = (data.claims.email as string | undefined) ?? null;
  }

  // DB roles are authoritative. Use caller-bound client (RLS self-select).
  const rolesRes = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesRes.error) {
    throw new HttpError("internal_error", rolesRes.error.message);
  }
  const roles = (rolesRes.data ?? []).map((r) => String(r.role));

  return { client, userId, email, jwt, roles };
}
