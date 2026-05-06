// Stage 1B-A · Forbidden-field allow-list. Source of truth for contract tests.
//
// Each surface declares keys that MUST NEVER appear at any depth in any
// JSON response from that surface. The scanner walks recursively.

export const FORBIDDEN_PATIENT_KEYS = new Set<string>([
  // Doctor-internal text and AI:
  "doctorText",
  "doctor_text",
  "doctorVersionText",
  "doctorConclusion",
  "followUpPlan",
  "follow_up_plan",
  "complaint",
  "aiSupport",
  "ai_risk",
  "ai_confidence",
  "ai_features",
  "ai_uncertainty_notes",
  "ai_xai_notes",
  "abcd",
  "sevenPoint",
  "seven_point",
  // Provenance / staff identifiers:
  "createdBy",
  "created_by",
  "decidedBy",
  "decided_by",
  "signedBy",
  "signed_by",
  "doctorId",
  "doctor_id",
  "assistantId",
  "assistant_id",
  "recordedBy",
  "recorded_by",
  // Sensitive intake:
  "riskFactors",
  "risk_factors",
  // Tokens / hashes / secrets:
  "token",
  "tokenHash",
  "token_hash",
  "passwordHash",
  "password_hash",
  "rawUserMeta",
  "raw_user_meta_data",
  // Audit:
  "auditLogs",
  "audit_logs",
]);

export const FORBIDDEN_DOCTOR_KEYS = new Set<string>([
  "token",
  "tokenHash",
  "token_hash",
  "passwordHash",
  "password_hash",
  "rawUserMeta",
  "raw_user_meta_data",
]);

export const FORBIDDEN_ME_KEYS = new Set<string>([
  "passwordHash",
  "password_hash",
  "rawUserMeta",
  "raw_user_meta_data",
  "token",
  "tokenHash",
  "token_hash",
]);

export function assertNoForbiddenKeys(
  json: unknown,
  forbidden: Set<string>,
  surface: string,
  path = "$",
): void {
  if (json === null || json === undefined) return;
  if (Array.isArray(json)) {
    json.forEach((item, i) =>
      assertNoForbiddenKeys(item, forbidden, surface, `${path}[${i}]`)
    );
    return;
  }
  if (typeof json === "object") {
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (forbidden.has(k)) {
        throw new Error(
          `[${surface}] forbidden field "${k}" leaked at ${path}.${k}`,
        );
      }
      assertNoForbiddenKeys(v, forbidden, surface, `${path}.${k}`);
    }
  }
}
