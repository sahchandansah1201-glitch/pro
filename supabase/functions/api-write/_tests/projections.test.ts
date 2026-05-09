// Stage 1C · Pure unit tests for write-surface projections + validators.
// No live database; runs under `deno test`.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  toAssessmentDTO,
  toConclusionDTO,
  toLesionDTO,
  toPatientDTO,
  toReportDTO,
  toReportVersionDTO,
  toVisitDTO,
} from "../projections.ts";
import {
  assertNoForbiddenWriteKeys,
  FORBIDDEN_DOCTOR_WRITE_KEYS,
} from "./forbidden-fields.ts";
import {
  asEnum,
  asNumber,
  assertUuid,
  parseJsonBody,
  validateBody,
} from "../validators.ts";
import { HttpError } from "../errors.ts";

// deno-lint-ignore no-explicit-any
const dirty = <T,>(base: T, extra: Record<string, unknown>): T =>
  (Object.assign({}, base, extra) as any);

const PATIENT_ROW = {
  id: "p-1",
  clinic_id: "c-1",
  code: "DP-99",
  full_name: "X Y",
  birth_date: "1990-01-01",
  sex: "female" as const,
  phototype: "II" as const,
  risk_factors: ["a"],
  created_by: "doc-1",
  created_at: "2026-05-07T00:00:00Z",
};

Deno.test("toPatientDTO: only allow-listed camelCase keys, no snake_case leak", () => {
  const dto = toPatientDTO(dirty(PATIENT_ROW, { password_hash: "leak", doctor_text: "x" }));
  assertEquals(Object.keys(dto).sort(), [
    "birthDate", "clinicId", "code", "createdAt", "createdBy",
    "fullName", "id", "phototype", "riskFactors", "sex",
  ]);
  assertNoForbiddenWriteKeys({ data: dto }, "POST /doctor/patients");
});

Deno.test("toVisitDTO: camelCase-only DTO", () => {
  const dto = toVisitDTO({
    id: "v-1", clinic_id: "c-1", patient_id: "p-1",
    doctor_id: "doc-1", assistant_id: null, status: "scheduled",
    started_at: "2026-05-07T08:00:00Z", closed_at: null,
    complaint: "x", created_at: "2026-05-07T08:00:00Z",
  });
  assertEquals(Object.keys(dto).sort(), [
    "assistantId", "clinicId", "closedAt", "complaint", "createdAt",
    "doctorId", "id", "patientId", "startedAt", "status",
  ]);
  assertNoForbiddenWriteKeys({ data: dto }, "POST /doctor/visits");
});

Deno.test("toLesionDTO: camelCase-only DTO with mapX/mapY numbers", () => {
  const dto = toLesionDTO({
    id: "l-1", clinic_id: "c-1", patient_id: "p-1", body_zone: "back",
    map_view: "back", map_x: 0.42, map_y: 0.13, label: "L1",
    first_seen_at: "2026-05-07T08:00:00Z", status: "active",
    created_at: "2026-05-07T08:00:00Z",
  });
  assertEquals(Object.keys(dto).sort(), [
    "bodyZone", "clinicId", "createdAt", "firstSeenAt", "id",
    "label", "mapView", "mapX", "mapY", "patientId", "status",
  ]);
  assertEquals(dto.mapX, 0.42);
  assertNoForbiddenWriteKeys({ data: dto }, "POST /doctor/lesions");
});

Deno.test("toAssessmentDTO: ai* + abcd/sevenPoint exposed in camelCase", () => {
  const dto = toAssessmentDTO({
    id: "a-1", clinic_id: "c-1", visit_id: "v-1", lesion_id: "l-1",
    abcd: { A: 1 }, seven_point: { score: 3 },
    ai_risk: "moderate", ai_confidence: 0.7,
    ai_features: ["asym"], ai_uncertainty_notes: ["n1"],
    ai_xai_notes: "x", decided_by: "doc-1",
    decided_at: "2026-05-07T08:00:00Z",
  });
  assertEquals(Object.keys(dto).sort(), [
    "abcd", "aiConfidence", "aiFeatures", "aiRisk",
    "aiUncertaintyNotes", "aiXaiNotes", "clinicId",
    "decidedAt", "decidedBy", "id", "lesionId", "sevenPoint", "visitId",
  ]);
  assertEquals(dto.aiConfidence, 0.7);
  assertNoForbiddenWriteKeys({ data: dto }, "POST /doctor/assessments");
});

Deno.test("toConclusionDTO: camelCase-only", () => {
  const dto = toConclusionDTO({
    id: "c-1", clinic_id: "c-1", visit_id: "v-1",
    doctor_text: "internal", follow_up_plan: "fp",
    decided_by: "doc-1", decided_at: "2026-05-07T08:00:00Z",
  });
  assertEquals(Object.keys(dto).sort(), [
    "clinicId", "decidedAt", "decidedBy", "doctorText",
    "followUpPlan", "id", "visitId",
  ]);
  assertNoForbiddenWriteKeys({ data: dto }, "POST /doctor/conclusions");
});

Deno.test("toReportDTO: camelCase-only with currentVersionId", () => {
  const dto = toReportDTO({
    id: "r-1", clinic_id: "c-1", visit_id: "v-1",
    current_version_id: null, created_at: "2026-05-07T08:00:00Z",
  });
  assertEquals(Object.keys(dto).sort(), [
    "clinicId", "createdAt", "currentVersionId", "id", "visitId",
  ]);
  assertNoForbiddenWriteKeys({ data: dto }, "POST /doctor/reports");
});

Deno.test("toReportVersionDTO: patientText/doctorText, no patient_safe_text leak", () => {
  const dto = toReportVersionDTO({
    id: "rv-1", clinic_id: "c-1", report_id: "r-1", version: 1,
    status: "draft", patient_safe_text: "safe", doctor_text: "internal",
    created_by: "doc-1", created_at: "2026-05-07T08:00:00Z",
    signed_by: null, signed_at: null,
  });
  assertEquals(Object.keys(dto).sort(), [
    "clinicId", "createdAt", "createdBy", "doctorText", "id",
    "patientText", "reportId", "signedAt", "signedBy", "status", "version",
  ]);
  assertEquals(dto.patientText, "safe");
  assertNoForbiddenWriteKeys({ data: dto }, "POST /doctor/report-versions");
});

// ── Validator unit tests ──────────────────────────────────────────────────
Deno.test("validateBody rejects unknown body key with 422", () => {
  const e = assertThrows(
    () => validateBody({ foo: 1 } as Record<string, unknown>, { allow: ["bar"] }),
    HttpError,
  );
  assertEquals((e as HttpError).code, "validation_error");
});

Deno.test("validateBody rejects server-controlled key", () => {
  for (const k of ["clinicId", "createdBy", "doctorId", "decidedAt", "version", "signedBy"]) {
    const e = assertThrows(
      () => validateBody({ [k]: "x" }, { allow: [k, "fullName"] }),
      HttpError,
    );
    assertEquals((e as HttpError).code, "validation_error");
  }
});

Deno.test("validateBody allows currentVersionId only when exempted", () => {
  // Without exemption → rejected.
  assertThrows(
    () =>
      validateBody({ currentVersionId: "x" }, { allow: ["currentVersionId"] }),
    HttpError,
  );
  // With exemption → accepted.
  validateBody(
    { currentVersionId: "x" },
    { allow: ["currentVersionId"], exempt: ["currentVersionId"] },
  );
});

Deno.test("validateBody rejects empty body when atLeastOne is required", () => {
  const e = assertThrows(
    () => validateBody({}, { allow: ["fullName"], atLeastOne: true }),
    HttpError,
  );
  assertEquals((e as HttpError).code, "validation_error");
});

Deno.test("asEnum rejects revoked when only final/amended allowed", () => {
  assertThrows(
    () => asEnum({ status: "revoked" }, "status", ["final", "amended"] as const),
    HttpError,
  );
});

Deno.test("asNumber rejects out-of-range mapX/mapY", () => {
  assertThrows(
    () => asNumber({ mapX: 1.5 }, "mapX", { min: 0, max: 1 }),
    HttpError,
  );
  assertThrows(
    () => asNumber({ mapY: -0.1 }, "mapY", { min: 0, max: 1 }),
    HttpError,
  );
});

Deno.test("assertUuid accepts canonical and rejects junk", () => {
  assertEquals(
    assertUuid("D1000000-0000-0000-0000-000000000002", "id"),
    "d1000000-0000-0000-0000-000000000002",
  );
  assertThrows(() => assertUuid("not-a-uuid", "id"), HttpError);
});

Deno.test("parseJsonBody accepts empty string and returns {}", () => {
  assertEquals(parseJsonBody(""), {});
  assertEquals(parseJsonBody("null"), {});
});

Deno.test("parseJsonBody rejects non-object JSON", () => {
  assertThrows(() => parseJsonBody("[]"), HttpError);
  assertThrows(() => parseJsonBody("123"), HttpError);
});

// Forbidden-key scanner self-test.
Deno.test("assertNoForbiddenWriteKeys finds nested snake_case leak", () => {
  assertThrows(
    () =>
      assertNoForbiddenWriteKeys(
        { data: { nested: { patient_safe_text: "leak" } } },
        "test",
      ),
    Error,
    'forbidden field "patient_safe_text"',
  );
});

// Confirm allow-list contains a known set so list edits stay deliberate.
Deno.test("FORBIDDEN_DOCTOR_WRITE_KEYS includes critical snake_case keys", () => {
  for (
    const k of [
      "clinic_id",
      "patient_safe_text",
      "doctor_text",
      "current_version_id",
      "created_by",
      "decided_by",
      "signed_by",
      "ai_risk",
    ]
  ) {
    if (!FORBIDDEN_DOCTOR_WRITE_KEYS.has(k)) {
      throw new Error(`Missing forbidden key: ${k}`);
    }
  }
});
