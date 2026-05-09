// Stage 1B-A · Tiny hand-written validators (no Zod in this slice).
import { HttpError } from "./errors.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, field: string): string {
  if (!value || !UUID_RE.test(value)) {
    throw new HttpError("validation_error", `Invalid uuid for ${field}`, {
      field,
    });
  }
  return value.toLowerCase();
}

// Stage 1E-D · Signed download URL expiry window.
// Default 300s. Out-of-bounds values are REJECTED (not silently clamped) so
// callers learn about misuse — documented in docs/backend/stage-1e-runbook.md.
export const SIGNED_URL_DEFAULT_EXPIRES = 300;
export const SIGNED_URL_MIN_EXPIRES = 60;
export const SIGNED_URL_MAX_EXPIRES = 900;

export function assertExpiresIn(raw: string | null): number {
  if (raw === null || raw === "") return SIGNED_URL_DEFAULT_EXPIRES;
  if (!/^-?\d+$/.test(raw)) {
    throw new HttpError("validation_error", "expiresIn must be an integer", {
      field: "expiresIn",
    });
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new HttpError("validation_error", "expiresIn must be an integer", {
      field: "expiresIn",
    });
  }
  if (n < SIGNED_URL_MIN_EXPIRES || n > SIGNED_URL_MAX_EXPIRES) {
    throw new HttpError(
      "validation_error",
      `expiresIn must be between ${SIGNED_URL_MIN_EXPIRES} and ${SIGNED_URL_MAX_EXPIRES} seconds`,
      {
        field: "expiresIn",
        min: SIGNED_URL_MIN_EXPIRES,
        max: SIGNED_URL_MAX_EXPIRES,
      },
    );
  }
  return n;
}
