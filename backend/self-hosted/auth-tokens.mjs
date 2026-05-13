import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60;

export class AuthTokenError extends Error {
  constructor(message = "Invalid authorization token.") {
    super(message);
    this.name = "AuthTokenError";
    this.publicCode = "invalid_token";
    this.publicStatus = 401;
  }
}

export class AuthConfigError extends Error {
  constructor(message = "JWT_SECRET is not configured.") {
    super(message);
    this.name = "AuthConfigError";
    this.publicCode = "auth_not_configured";
    this.publicStatus = 503;
  }
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseBase64UrlJson(value) {
  return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
}

function hmacSha256(input, secret) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function assertJwtSecret(secret) {
  if (!secret || String(secret).length < 16) {
    throw new AuthConfigError("JWT_SECRET must be configured and at least 16 characters.");
  }
}

export function signAccessToken({
  subject,
  issuer,
  secret,
  roles,
  clinicIds,
  nowSeconds = Math.floor(Date.now() / 1000),
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
}) {
  assertJwtSecret(secret);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const payload = {
    iss: issuer,
    sub: subject,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
    roles: Array.isArray(roles) ? roles : [],
    clinicIds: Array.isArray(clinicIds) ? clinicIds : [],
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = hmacSha256(signingInput, secret);
  return `${signingInput}.${signature}`;
}

export function verifyAccessToken({
  token,
  issuer,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  assertJwtSecret(secret);
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new AuthTokenError();
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);
  if (!safeCompare(signature, expected)) {
    throw new AuthTokenError();
  }
  let header;
  let payload;
  try {
    header = parseBase64UrlJson(encodedHeader);
    payload = parseBase64UrlJson(encodedPayload);
  } catch {
    throw new AuthTokenError();
  }
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    throw new AuthTokenError();
  }
  if (payload?.iss !== issuer || !payload?.sub) {
    throw new AuthTokenError();
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    throw new AuthTokenError("Authorization token is expired.");
  }
  return {
    userId: String(payload.sub),
    roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
    clinicIds: Array.isArray(payload.clinicIds) ? payload.clinicIds.map(String) : [],
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}

export function extractBearerToken(headers = {}) {
  const raw =
    headers.authorization ||
    headers.Authorization ||
    headers.AUTHORIZATION ||
    "";
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}
