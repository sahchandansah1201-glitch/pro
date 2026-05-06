// Stage 1B-A · Pure unit tests for projections, validators, error envelope.
//
// These tests run with `deno test` and do NOT require a live database or JWT.
// They prove the projection layer is the response-shape contract:
//   * forbidden fields are stripped,
//   * DTOs only contain allow-listed keys,
//   * the error envelope shape is canonical.
//
// Live integration tests (auth, RLS, cross-clinic) require a running local
// Supabase stack and are tracked separately in docs/backend/stage-1b-a-runbook.md.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  toDoctorPatientDetailDTO,
  toDoctorPatientListDTO,
  toDoctorReportVersionDTO,
  toMeDTO,
  toPatientReportSummaryDTO,
  toPatientReportVersionDTO,
  toPatientSelfDTO,
} from "../projections.ts";
import {
  assertNoForbiddenKeys,
  FORBIDDEN_DOCTOR_KEYS,
  FORBIDDEN_ME_KEYS,
  FORBIDDEN_PATIENT_KEYS,
} from "./forbidden-fields.ts";
import { assertUuid } from "../validators.ts";
import { HttpError } from "../errors.ts";

// ── Helper: cast row with extra fields, simulating a leaked-field DB row.
// deno-lint-ignore no-explicit-any
const dirty = <T,>(row: T, extra: Record<string, unknown>): T =>
  ({ ...row, ...extra } as any);

// ── /me DTO ────────────────────────────────────────────────────────────────
Deno.test("toMeDTO: only allow-listed keys, roles deduped+sorted", () => {
  const dto = toMeDTO({
    userId: "u-1",
    email: "u@example.com",
    profile: { full_name: "User One", clinic_id: "c-1" },
    roles: [{ role: "doctor" }, { role: "doctor" }, { role: "system_admin" }],
    hasPatientLink: false,
  });
  assertEquals(Object.keys(dto).sort(), [
    "clinicId",
    "displayName",
    "email",
    "hasPatientLink",
    "roles",
    "userId",
  ]);
  assertEquals(dto.roles, ["doctor", "system_admin"]);
  assertNoForbiddenKeys({ data: dto }, FORBIDDEN_ME_KEYS, "/me");
});

// ── Patient surface DTOs ───────────────────────────────────────────────────
Deno.test("toPatientSelfDTO strips risk_factors / created_by / clinic_id", () => {
  const row = dirty(
    {
      id: "p-1",
      code: "DP-1",
      full_name: "Иванова Н. О.",
      birth_date: "1984-03-12",
      sex: "female" as const,
      phototype: "II" as const,
    },
    {
      risk_factors: ["x"],
      created_by: "doc-1",
      clinic_id: "c-1",
      doctor_text: "leak",
    },
  );
  const dto = toPatientSelfDTO(row);
  assertEquals(Object.keys(dto).sort(), [
    "birthDate",
    "code",
    "fullName",
    "id",
    "phototype",
    "sex",
  ]);
  assertNoForbiddenKeys({ data: dto }, FORBIDDEN_PATIENT_KEYS, "/patient/me");
});

Deno.test("toPatientReportSummaryDTO maps created_at→generatedAt and strips clinic_id", () => {
  const dto = toPatientReportSummaryDTO(
    dirty(
      { id: "r-1", visit_id: "v-1", generated_at: "2026-03-02T09:15:00Z" },
      { clinic_id: "c-1", current_version_id: "rv-1", doctor_text: "leak" },
    ),
  );
  assertEquals(Object.keys(dto).sort(), ["generatedAt", "id", "visitId"]);
  assertNoForbiddenKeys(
    { data: [dto] },
    FORBIDDEN_PATIENT_KEYS,
    "/patient/reports",
  );
});

Deno.test("toPatientReportVersionDTO exposes `text`, never `patientSafeText` or doctor_text", () => {
  const dto = toPatientReportVersionDTO(
    dirty(
      {
        id: "rv-1",
        status: "final" as const,
        patient_safe_text: "safe",
        created_at: "2026-03-02T09:15:00Z",
      },
      {
        doctor_text: "internal",
        signed_by: "doc-1",
        created_by: "doc-1",
        report_id: "r-1",
        version: 1,
        clinic_id: "c-1",
      },
    ),
  );
  assertEquals(Object.keys(dto).sort(), [
    "createdAt",
    "id",
    "status",
    "text",
  ]);
  // External DTO key MUST be `text`, not `patientSafeText`.
  // deno-lint-ignore no-explicit-any
  assertEquals((dto as any).patientSafeText, undefined);
  assertEquals(dto.text, "safe");
  assertNoForbiddenKeys(
    { data: [dto] },
    FORBIDDEN_PATIENT_KEYS,
    "/patient/reports/:id/versions",
  );
});

// ── Doctor surface DTOs ────────────────────────────────────────────────────
Deno.test("toDoctorPatientListDTO strips risk_factors and created_by", () => {
  const dto = toDoctorPatientListDTO(
    dirty(
      {
        id: "p-1",
        clinic_id: "c-1",
        code: "DP-1",
        full_name: "X",
        birth_date: "1980-01-01",
        sex: "male" as const,
        phototype: "III" as const,
        created_at: "2026-01-01T00:00:00Z",
      },
      { risk_factors: ["x"], created_by: "doc-1", password_hash: "leak" },
    ),
  );
  assertEquals(Object.keys(dto).sort(), [
    "birthDate",
    "clinicId",
    "code",
    "createdAt",
    "fullName",
    "id",
    "phototype",
    "sex",
  ]);
  assertNoForbiddenKeys(
    { data: [dto] },
    FORBIDDEN_DOCTOR_KEYS,
    "/doctor/patients",
  );
});

Deno.test("toDoctorPatientDetailDTO exposes risk_factors but not created_by", () => {
  const dto = toDoctorPatientDetailDTO(
    dirty(
      {
        id: "p-1",
        clinic_id: "c-1",
        code: "DP-1",
        full_name: "X",
        birth_date: "1980-01-01",
        sex: "male" as const,
        phototype: "III" as const,
        risk_factors: ["a", "b"],
        created_at: "2026-01-01T00:00:00Z",
      },
      { created_by: "doc-1", password_hash: "leak" },
    ),
  );
  assertEquals(dto.riskFactors, ["a", "b"]);
  // created_by must NOT appear
  // deno-lint-ignore no-explicit-any
  assertEquals((dto as any).created_by, undefined);
  // deno-lint-ignore no-explicit-any
  assertEquals((dto as any).createdBy, undefined);
  assertNoForbiddenKeys(
    { data: dto },
    FORBIDDEN_DOCTOR_KEYS,
    "/doctor/patients/:id",
  );
});

Deno.test("toDoctorReportVersionDTO carries doctor_text but never tokens", () => {
  const dto = toDoctorReportVersionDTO(
    dirty(
      {
        id: "rv-1",
        report_id: "r-1",
        version: 1,
        status: "final" as const,
        patient_safe_text: "safe",
        doctor_text: "internal",
        created_at: "2026-03-02T09:15:00Z",
        signed_at: "2026-03-02T09:16:00Z",
      },
      { token: "leak", token_hash: "leak", password_hash: "leak" },
    ),
  );
  assertEquals(dto.doctorText, "internal");
  assertNoForbiddenKeys(
    { data: [dto] },
    FORBIDDEN_DOCTOR_KEYS,
    "/doctor/reports/:id/versions",
  );
});

// ── Validators ─────────────────────────────────────────────────────────────
Deno.test("assertUuid accepts canonical uuid and rejects junk", () => {
  assertEquals(
    assertUuid("D1000000-0000-0000-0000-000000000002", "reportId"),
    "d1000000-0000-0000-0000-000000000002",
  );
  assertThrows(() => assertUuid("not-a-uuid", "reportId"), HttpError);
  assertThrows(() => assertUuid("", "reportId"), HttpError);
});

// ── Forbidden-field scanner self-test ──────────────────────────────────────
Deno.test("assertNoForbiddenKeys finds nested leaks", () => {
  assertThrows(
    () =>
      assertNoForbiddenKeys(
        { data: { nested: { doctor_text: "leak" } } },
        FORBIDDEN_PATIENT_KEYS,
        "test",
      ),
    Error,
    'forbidden field "doctor_text"',
  );
});
