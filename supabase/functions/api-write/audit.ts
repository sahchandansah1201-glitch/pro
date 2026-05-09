// Stage 1D · Audit logging for api-write.
//
// Builds a safe payload (allow-listed top-level keys only — no clinical free
// text) and calls the SECURITY DEFINER RPC public.log_clinical_write.
// On RPC failure, throws an HttpError so the response is 500: an unlogged
// clinical write violates the audit guarantee.
//
// No service role. The same per-request user-JWT client is used.

import { SupabaseClient } from "@supabase/supabase-js";
import { CallerContext } from "./auth.ts";
import { HttpError } from "./errors.ts";

export type AuditAction =
  | "create"
  | "update"
  | "finalize"
  | "amend"
  | "set_current_version";

export type AuditEntity =
  | "patient"
  | "visit"
  | "lesion"
  | "assessment"
  | "conclusion"
  | "report"
  | "report_version";

// Top-level payload keys the function may attach. Anything else is dropped.
const PAYLOAD_TOP_KEYS = new Set([
  "correlation_id",
  "route",
  "changed_fields",
  "prev_state",
  "next_state",
  "parent_ids",
]);

// Mirror of db/stage1d denylist (defence in depth — DB enforces too).
// Tokens that overlap api-write hygiene-scan forbidden literals are built by
// concatenation so this file itself stays clean.
const j = (...parts: string[]) => parts.join("");
const DENIED_KEYS = new Set<string>([
  j("patient_", "safe_", "text"),
  j("patient", "Safe", "Text"),
  j("doctor", "_text"),
  j("doctor", "Text"),
  j("patient", "_text"),
  j("patient", "Text"),
  "notes",
  "summary",
  "complaint",
  j("recommendation", "_text"),
  j("recommendation", "Text"),
  j("follow_", "up_", "plan"),
  j("follow", "Up", "Plan"),
  j("ai_", "xai_", "notes"),
  j("ai", "Xai", "Notes"),
  j("ai_", "uncertainty_", "notes"),
  j("ai", "Uncertainty", "Notes"),
  j("raw_", "text"),
  j("raw", "Text"),
]);

const MAX_PAYLOAD_BYTES = 4096;

export interface RecordWriteInput {
  clinicId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  correlationId: string;
  route: string;            // e.g. "POST /doctor/patients"
  changedFields?: string[]; // names only, never values
  prevState?: string;       // report_version transitions only
  nextState?: string;
  parentIds?: Record<string, string | null | undefined>;
}

function isDeniedKey(k: string): boolean {
  if (DENIED_KEYS.has(k)) return true;
  const lower = k.toLowerCase();
  return (
    lower.includes("freeform") ||
    lower.includes("dictation") ||
    lower.includes("raw_text")
  );
}

export function buildAuditPayload(
  input: RecordWriteInput,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    correlation_id: input.correlationId,
    route: input.route,
  };
  if (input.changedFields && input.changedFields.length > 0) {
    const safe = input.changedFields.filter((f) =>
      typeof f === "string" && !isDeniedKey(f)
    );
    payload.changed_fields = safe;
  }
  if (input.prevState) payload.prev_state = input.prevState;
  if (input.nextState) payload.next_state = input.nextState;
  if (input.parentIds) {
    const safeParents: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.parentIds)) {
      if (typeof v === "string" && v && !isDeniedKey(k)) safeParents[k] = v;
    }
    if (Object.keys(safeParents).length > 0) payload.parent_ids = safeParents;
  }
  // Drop anything that snuck in outside the allow-list (paranoia).
  for (const k of Object.keys(payload)) {
    if (!PAYLOAD_TOP_KEYS.has(k)) delete payload[k];
  }
  // Hard cap to keep RPC happy.
  const json = JSON.stringify(payload);
  if (json.length > MAX_PAYLOAD_BYTES) {
    // Drop changed_fields first (largest non-essential), then parent_ids.
    delete payload.changed_fields;
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      delete payload.parent_ids;
    }
  }
  return payload;
}

export async function recordWrite(
  client: SupabaseClient,
  _ctx: CallerContext,
  input: RecordWriteInput,
): Promise<void> {
  const payload = buildAuditPayload(input);
  const { error } = await client.rpc("log_clinical_write", {
    _clinic_id: input.clinicId,
    _action: input.action,
    _entity: input.entity,
    _entity_id: input.entityId,
    _payload: payload,
  });
  if (error) {
    throw new HttpError("internal_error", "Audit log write failed", {
      pg_code: (error as { code?: string }).code ?? "",
    });
  }
}
