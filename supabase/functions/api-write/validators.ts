// Stage 1C · Validators for write surface.
// Hand-written, no dependencies. Strict allow-list, no leak of server-controlled
// fields, no unknown keys.
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

// Server-controlled keys that the API must NEVER accept in a request body
// (clients cannot spoof them — server triggers are the source of truth).
// `currentVersionId` is allowed only on PATCH /doctor/reports/:id.
// Path-only ids (visitId/patientId/reportId) are allowed only when included
// per-route by name (we exclude them from this list and let per-route
// allow-lists be the single gate).
const ALWAYS_SERVER_CONTROLLED = new Set<string>([
  "id",
  "clinicId",
  "createdBy",
  "createdAt",
  "doctorId",
  "decidedBy",
  "decidedAt",
  "version",
  "signedBy",
  "signedAt",
  "currentVersionId",
  // Snake-case spoof attempts:
  "clinic_id",
  "created_by",
  "created_at",
  "doctor_id",
  "decided_by",
  "decided_at",
  "signed_by",
  "signed_at",
  "current_version_id",
  "patient_id",
  "visit_id",
  "report_id",
  "lesion_id",
  "patient_safe_text",
  "doctor_text",
  "follow_up_plan",
  "first_seen_at",
  "started_at",
  "closed_at",
  "body_zone",
  "map_view",
  "map_x",
  "map_y",
  "ai_risk",
  "ai_confidence",
  "ai_features",
  "ai_uncertainty_notes",
  "ai_xai_notes",
  "seven_point",
  "risk_factors",
  "full_name",
  "birth_date",
  "assistant_id",
  "report_id",
]);

export interface BodySchema {
  /** Allow-listed camelCase keys for this route. */
  allow: readonly string[];
  /** Required keys (subset of allow). */
  required?: readonly string[];
  /** If true, body MUST contain at least one of `allow`. */
  atLeastOne?: boolean;
  /** Per-route exemption from server-controlled rejection (e.g. currentVersionId on report PATCH). */
  exempt?: readonly string[];
}

export function parseJsonBody(text: string): Record<string, unknown> {
  if (text === "" || text === "null") return {};
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new HttpError("validation_error", "Body must be valid JSON");
  }
  if (v === null) return {};
  if (typeof v !== "object" || Array.isArray(v)) {
    throw new HttpError("validation_error", "Body must be a JSON object");
  }
  return v as Record<string, unknown>;
}

export function validateBody(
  body: Record<string, unknown>,
  schema: BodySchema,
): Record<string, unknown> {
  const allow = new Set(schema.allow);
  const exempt = new Set(schema.exempt ?? []);
  for (const key of Object.keys(body)) {
    if (ALWAYS_SERVER_CONTROLLED.has(key) && !exempt.has(key)) {
      throw new HttpError(
        "validation_error",
        `Server-controlled field "${key}" is not allowed in request body`,
        { field: key, reason: "server_controlled" },
      );
    }
    if (!allow.has(key)) {
      throw new HttpError(
        "validation_error",
        `Unknown field "${key}"`,
        { field: key, reason: "unknown_key" },
      );
    }
  }
  for (const req of schema.required ?? []) {
    if (!(req in body)) {
      throw new HttpError(
        "validation_error",
        `Missing required field "${req}"`,
        { field: req, reason: "required" },
      );
    }
  }
  if (schema.atLeastOne) {
    const keys = Object.keys(body);
    if (keys.length === 0) {
      throw new HttpError(
        "validation_error",
        "Body must contain at least one updatable field",
        { reason: "at_least_one" },
      );
    }
  }
  return body;
}

// ── Typed accessors ─────────────────────────────────────────────────────────
export function asString(
  body: Record<string, unknown>,
  key: string,
  opts: { min?: number; max?: number; optional?: boolean } = {},
): string | undefined {
  const v = body[key];
  if (v === undefined) {
    if (opts.optional) return undefined;
    throw new HttpError("validation_error", `Missing ${key}`, { field: key });
  }
  if (typeof v !== "string") {
    throw new HttpError("validation_error", `${key} must be a string`, {
      field: key,
    });
  }
  if (opts.min !== undefined && v.length < opts.min) {
    throw new HttpError("validation_error", `${key} too short`, {
      field: key,
    });
  }
  if (opts.max !== undefined && v.length > opts.max) {
    throw new HttpError("validation_error", `${key} too long`, {
      field: key,
    });
  }
  return v;
}

export function asEnum<T extends string>(
  body: Record<string, unknown>,
  key: string,
  values: readonly T[],
  opts: { optional?: boolean } = {},
): T | undefined {
  const v = body[key];
  if (v === undefined) {
    if (opts.optional) return undefined;
    throw new HttpError("validation_error", `Missing ${key}`, { field: key });
  }
  if (typeof v !== "string" || !(values as readonly string[]).includes(v)) {
    throw new HttpError(
      "validation_error",
      `${key} must be one of ${values.join("|")}`,
      { field: key, allowed: values },
    );
  }
  return v as T;
}

export function asNumber(
  body: Record<string, unknown>,
  key: string,
  opts: { min?: number; max?: number; optional?: boolean } = {},
): number | undefined {
  const v = body[key];
  if (v === undefined) {
    if (opts.optional) return undefined;
    throw new HttpError("validation_error", `Missing ${key}`, { field: key });
  }
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new HttpError("validation_error", `${key} must be a number`, {
      field: key,
    });
  }
  if (opts.min !== undefined && v < opts.min) {
    throw new HttpError("validation_error", `${key} below minimum`, {
      field: key,
    });
  }
  if (opts.max !== undefined && v > opts.max) {
    throw new HttpError("validation_error", `${key} above maximum`, {
      field: key,
    });
  }
  return v;
}

export function asStringArray(
  body: Record<string, unknown>,
  key: string,
  opts: { optional?: boolean } = {},
): string[] | undefined {
  const v = body[key];
  if (v === undefined) {
    if (opts.optional) return undefined;
    throw new HttpError("validation_error", `Missing ${key}`, { field: key });
  }
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new HttpError(
      "validation_error",
      `${key} must be an array of strings`,
      { field: key },
    );
  }
  return v as string[];
}

export function asObject(
  body: Record<string, unknown>,
  key: string,
  opts: { optional?: boolean } = {},
): Record<string, unknown> | undefined {
  const v = body[key];
  if (v === undefined) {
    if (opts.optional) return undefined;
    throw new HttpError("validation_error", `Missing ${key}`, { field: key });
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new HttpError("validation_error", `${key} must be an object`, {
      field: key,
    });
  }
  return v as Record<string, unknown>;
}

export function asTimestamp(
  body: Record<string, unknown>,
  key: string,
  opts: { optional?: boolean } = {},
): string | undefined {
  const v = asString(body, key, opts);
  if (v === undefined) return undefined;
  if (Number.isNaN(Date.parse(v))) {
    throw new HttpError(
      "validation_error",
      `${key} must be an ISO timestamp`,
      { field: key },
    );
  }
  return v;
}

export function asDate(
  body: Record<string, unknown>,
  key: string,
  opts: { optional?: boolean } = {},
): string | undefined {
  const v = asString(body, key, opts);
  if (v === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new HttpError("validation_error", `${key} must be YYYY-MM-DD`, {
      field: key,
    });
  }
  return v;
}
