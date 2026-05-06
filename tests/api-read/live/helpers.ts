// Stage 1B-B · Live contract test helpers.
//
// These helpers are TEST-ONLY. They use the service role key to:
//   * set deterministic passwords on the seeded auth.users (without mutating
//     auth.users.id),
// then exchange password sign-in for a real JWT and call the running
// `api-read` Edge Function. The Edge Function itself never sees the service
// role; it only sees the per-user JWT, so Stage 1A RLS remains the boundary.
//
// Environment (local only — never CI in this stage):
//   SUPABASE_URL                     e.g. http://127.0.0.1:54321
//   SUPABASE_ANON_KEY                local anon JWT
//   SUPABASE_SERVICE_ROLE_KEY        local service-role JWT (TEST SETUP ONLY)
//   API_READ_BASE_URL  (optional)    defaults to ${SUPABASE_URL}/functions/v1/api-read
//
// Run the function with JWT gateway verification disabled so the function
// itself returns canonical auth errors:
//   npx supabase functions serve api-read \
//     --env-file ./supabase/.env.local --no-verify-jwt

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const DEMO_PASSWORD = "stage1b-b-demo-Pass!9";

export interface DemoUser {
  key:
    | "doctor"
    | "assistant"
    | "clinicAdmin"
    | "privateDoctor"
    | "operator"
    | "systemAdmin"
    | "patient";
  id: string;
  email: string;
  expectedRoles: string[];
  expectedClinicId: string | null;
}

export const DEMO_USERS: Record<DemoUser["key"], DemoUser> = {
  doctor: {
    key: "doctor",
    id: "a0000000-0000-0000-0000-00000000d001",
    email: "doctor@derma-pro.demo",
    expectedRoles: ["doctor"],
    expectedClinicId: "11111111-1111-1111-1111-111111111111",
  },
  assistant: {
    key: "assistant",
    id: "a0000000-0000-0000-0000-00000000a001",
    email: "assistant@derma-pro.demo",
    expectedRoles: ["assistant"],
    expectedClinicId: "11111111-1111-1111-1111-111111111111",
  },
  clinicAdmin: {
    key: "clinicAdmin",
    id: "a0000000-0000-0000-0000-00000000c001",
    email: "clinicadmin@derma-pro.demo",
    expectedRoles: ["clinic_admin"],
    expectedClinicId: "11111111-1111-1111-1111-111111111111",
  },
  privateDoctor: {
    key: "privateDoctor",
    id: "a0000000-0000-0000-0000-0000000000d2",
    email: "privatedoc@derma-pro.demo",
    expectedRoles: ["private_doctor"],
    expectedClinicId: "33333333-3333-3333-3333-333333333333",
  },
  operator: {
    key: "operator",
    id: "a0000000-0000-0000-0000-00000000f001",
    email: "operator@derma-pro.demo",
    expectedRoles: ["operator"],
    expectedClinicId: null,
  },
  systemAdmin: {
    key: "systemAdmin",
    id: "a0000000-0000-0000-0000-00000000e001",
    email: "sysadmin@derma-pro.demo",
    expectedRoles: ["system_admin"],
    expectedClinicId: null,
  },
  patient: {
    key: "patient",
    id: "a0000000-0000-0000-0000-00000000b001",
    email: "patient@derma-pro.demo",
    expectedRoles: ["patient"],
    expectedClinicId: null,
  },
};

export const FIXTURES = {
  // Seed UUIDs — mirror db/stage1a/seed.sql.
  patientLinkedReport: "c1000000-0000-0000-0000-000000000002",
  patientLinkedReportVersion: "d1000000-0000-0000-0000-000000000002",
  northReport: "c1000000-0000-0000-0000-000000000001",
  northReportVersion: "d1000000-0000-0000-0000-000000000001",
  patientP001: "50000000-0000-0000-0000-000000000001",
  patientP004: "50000000-0000-0000-0000-000000000004",
  patientP006Private: "50000000-0000-0000-0000-000000000006",
  clinicMain: "11111111-1111-1111-1111-111111111111",
  clinicNorth: "22222222-2222-2222-2222-222222222222",
  clinicPrivate: "33333333-3333-3333-3333-333333333333",
};

export interface Env {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  apiReadBaseUrl: string;
}

export function readEnv(): Env {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (local only).",
    );
  }
  const apiReadBaseUrl = Deno.env.get("API_READ_BASE_URL") ??
    `${url.replace(/\/+$/, "")}/functions/v1/api-read`;
  return { url, anonKey, serviceRoleKey, apiReadBaseUrl };
}

let cachedAdmin: SupabaseClient | null = null;
function admin(env: Env): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  cachedAdmin = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdmin;
}

const jwtCache = new Map<string, string>();

/** Set demo password on seeded user (id is NOT mutated) and sign in. */
export async function getJwtFor(user: DemoUser): Promise<string> {
  const cached = jwtCache.get(user.key);
  if (cached) return cached;
  const env = readEnv();

  // Set password via admin (id-preserving update on auth.users).
  const updateRes = await admin(env).auth.admin.updateUserById(user.id, {
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (updateRes.error) {
    throw new Error(
      `admin.updateUserById(${user.email}) failed: ${updateRes.error.message}`,
    );
  }

  // Password sign-in via anon client.
  const anon = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await anon.auth.signInWithPassword({
    email: user.email,
    password: DEMO_PASSWORD,
  });
  if (signIn.error || !signIn.data.session?.access_token) {
    throw new Error(
      `signInWithPassword(${user.email}) failed: ${signIn.error?.message}`,
    );
  }
  const jwt = signIn.data.session.access_token;
  jwtCache.set(user.key, jwt);
  return jwt;
}

export interface ApiResponse {
  status: number;
  correlationId: string | null;
  body: unknown;
}

export async function callApi(
  path: string,
  opts: { jwt?: string; correlationId?: string } = {},
): Promise<ApiResponse> {
  const env = readEnv();
  const url = `${env.apiReadBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.jwt) headers["authorization"] = `Bearer ${opts.jwt}`;
  if (opts.correlationId) headers["x-correlation-id"] = opts.correlationId;

  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = text.length ? JSON.parse(text) : null;
  } catch {
    body = { __nonJson: text };
  }
  return {
    status: res.status,
    correlationId: res.headers.get("x-correlation-id"),
    body,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    correlationId: string;
  };
}

export function assertErrorEnvelope(
  body: unknown,
  expectedCode: string,
): ApiErrorEnvelope {
  if (
    !body || typeof body !== "object" || !("error" in (body as object))
  ) {
    throw new Error(`Expected error envelope, got: ${JSON.stringify(body)}`);
  }
  const err = (body as ApiErrorEnvelope).error;
  if (err.code !== expectedCode) {
    throw new Error(
      `Expected error.code="${expectedCode}", got "${err.code}" (${err.message})`,
    );
  }
  if (typeof err.message !== "string" || !err.message) {
    throw new Error(`error.message must be a non-empty string`);
  }
  if (!err.details || typeof err.details !== "object") {
    throw new Error(`error.details must be an object`);
  }
  if (!isUuid(err.correlationId)) {
    throw new Error(
      `error.correlationId must be a uuid, got "${err.correlationId}"`,
    );
  }
  return body as ApiErrorEnvelope;
}
