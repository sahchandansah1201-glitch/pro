// Stage 1C · Forbidden-key allow-lists for doctor write surface.
// Source of truth for projection unit tests AND live contract tests.
//
// Every write response MUST be camelCase only. No snake_case ever leaks.

export const FORBIDDEN_DOCTOR_WRITE_KEYS = new Set<string>([
  // snake_case spoof / leak surface
  "clinic_id",
  "patient_id",
  "visit_id",
  "report_id",
  "lesion_id",
  "doctor_id",
  "assistant_id",
  "created_by",
  "created_at",
  "decided_by",
  "decided_at",
  "signed_by",
  "signed_at",
  "current_version_id",
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
  // Tokens / hashes / secrets — must never appear here either.
  "token",
  "tokenHash",
  "token_hash",
  "passwordHash",
  "password_hash",
  "rawUserMeta",
  "raw_user_meta_data",
]);

export function assertNoForbiddenWriteKeys(
  json: unknown,
  surface: string,
  path = "$",
): void {
  if (json === null || json === undefined) return;
  if (Array.isArray(json)) {
    json.forEach((item, i) =>
      assertNoForbiddenWriteKeys(item, surface, `${path}[${i}]`)
    );
    return;
  }
  if (typeof json === "object") {
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (FORBIDDEN_DOCTOR_WRITE_KEYS.has(k)) {
        throw new Error(
          `[${surface}] forbidden field "${k}" leaked at ${path}.${k}`,
        );
      }
      assertNoForbiddenWriteKeys(v, surface, `${path}.${k}`);
    }
  }
}
