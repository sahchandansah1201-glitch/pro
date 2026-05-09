// Stage 1C · Live contract test helpers for api-write.
// Mirrors tests/api-read/live/helpers.ts patterns. HS256 JWTs minted locally.
// No service role.

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
}

export const DEMO_USERS: Record<DemoUser["key"], DemoUser> = {
  doctor: {
    key: "doctor",
    id: "a0000000-0000-0000-0000-00000000d001",
    email: "doctor@derma-pro.demo",
  },
  assistant: {
    key: "assistant",
    id: "a0000000-0000-0000-0000-00000000a001",
    email: "assistant@derma-pro.demo",
  },
  clinicAdmin: {
    key: "clinicAdmin",
    id: "a0000000-0000-0000-0000-00000000c001",
    email: "clinicadmin@derma-pro.demo",
  },
  privateDoctor: {
    key: "privateDoctor",
    id: "a0000000-0000-0000-0000-0000000000d2",
    email: "privatedoc@derma-pro.demo",
  },
  operator: {
    key: "operator",
    id: "a0000000-0000-0000-0000-00000000f001",
    email: "operator@derma-pro.demo",
  },
  systemAdmin: {
    key: "systemAdmin",
    id: "a0000000-0000-0000-0000-00000000e001",
    email: "sysadmin@derma-pro.demo",
  },
  patient: {
    key: "patient",
    id: "a0000000-0000-0000-0000-00000000b001",
    email: "patient@derma-pro.demo",
  },
};

export const FIXTURES = {
  clinicMain: "11111111-1111-1111-1111-111111111111",
  clinicNorth: "22222222-2222-2222-2222-222222222222",
  clinicPrivate: "33333333-3333-3333-3333-333333333333",
  patientP001: "50000000-0000-0000-0000-000000000001",
  patientP004: "50000000-0000-0000-0000-000000000004",
  patientP006Private: "50000000-0000-0000-0000-000000000006",
};

export interface Env {
  url: string;
  jwtSecret: string;
  apiWriteBaseUrl: string;
}

export function readEnv(): Env {
  const url = Deno.env.get("SUPABASE_URL");
  const jwtSecret = Deno.env.get("API_READ_JWT_SECRET") ??
    Deno.env.get("SUPABASE_JWT_SECRET");
  if (!url || !jwtSecret) {
    throw new Error(
      "Missing SUPABASE_URL / API_READ_JWT_SECRET (local only).",
    );
  }
  const apiWriteBaseUrl = Deno.env.get("API_WRITE_BASE_URL") ??
    `${url.replace(/\/+$/, "")}/functions/v1/api-write`;
  return { url, jwtSecret, apiWriteBaseUrl };
}

// --- base64url + HS256 signing -------------------------------------------------

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function signHs256(secret: string, signingInput: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8(signingInput));
  return base64urlEncode(new Uint8Array(sig));
}

const jwtCache = new Map<string, string>();

export async function getJwtFor(user: DemoUser): Promise<string> {
  const cached = jwtCache.get(user.key);
  if (cached) return cached;
  const env = readEnv();

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: user.id,
    role: "authenticated",
    aud: "authenticated",
    email: user.email,
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64urlEncode(utf8(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(utf8(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = await signHs256(env.jwtSecret, signingInput);
  const jwt = `${signingInput}.${sig}`;
  jwtCache.set(user.key, jwt);
  return jwt;
}

// --- HTTP -----------------------------------------------------------------------

export interface ApiResponse {
  status: number;
  correlationId: string | null;
  body: unknown;
}

export async function callApi(
  method: "POST" | "PATCH" | "GET",
  path: string,
  opts: {
    jwt?: string;
    body?: unknown;
    correlationId?: string;
  } = {},
): Promise<ApiResponse> {
  const env = readEnv();
  const url = `${env.apiWriteBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.jwt) headers["authorization"] = `Bearer ${opts.jwt}`;
  if (opts.correlationId) headers["x-correlation-id"] = opts.correlationId;

  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string"
      ? opts.body
      : JSON.stringify(opts.body);
  }

  const res = await fetch(url, init);
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

export function uniqueCode(prefix = "AW"): string {
  // Deterministic-ish unique seed-safe code ≤ 64 chars.
  const ts = Date.now().toString(36);
  const rnd = crypto.randomUUID().slice(0, 8);
  return `${prefix}-${ts}-${rnd}`;
}
