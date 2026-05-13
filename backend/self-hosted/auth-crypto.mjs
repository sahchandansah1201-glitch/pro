import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const HASH_PREFIX = "$scrypt$";
const DEFAULT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 32,
};

function safeString(value) {
  return String(value ?? "");
}

function bufferFromBase64Url(value) {
  return Buffer.from(safeString(value), "base64url");
}

function splitScryptHash(hash) {
  const parts = safeString(hash).split("$");
  if (parts.length !== 7 || parts[1] !== "scrypt") {
    return null;
  }
  const N = Number.parseInt(parts[2], 10);
  const r = Number.parseInt(parts[3], 10);
  const p = Number.parseInt(parts[4], 10);
  const salt = bufferFromBase64Url(parts[5]);
  const expected = bufferFromBase64Url(parts[6]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return null;
  }
  if (salt.length === 0 || expected.length === 0) {
    return null;
  }
  return { N, r, p, salt, expected };
}

export function hashPassword(password, options = {}) {
  const params = {
    ...DEFAULT_PARAMS,
    ...options,
  };
  const salt = options.salt
    ? Buffer.from(options.salt)
    : randomBytes(options.saltLength ?? 16);
  const derived = scryptSync(safeString(password), salt, params.keyLength, {
    N: params.N,
    r: params.r,
    p: params.p,
  });
  return [
    HASH_PREFIX.slice(0, -1),
    params.N,
    params.r,
    params.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export function verifyPasswordHash(password, passwordHash) {
  const parsed = splitScryptHash(passwordHash);
  if (!parsed) return false;
  const actual = scryptSync(safeString(password), parsed.salt, parsed.expected.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
  });
  if (actual.length !== parsed.expected.length) return false;
  return timingSafeEqual(actual, parsed.expected);
}
