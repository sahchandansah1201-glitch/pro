// Stage 1C · Live API contract tests for `supabase/functions/api-write`.
//
// Preconditions (local only):
//   1. `npx supabase start`
//   2. `npx supabase db reset`        (loads Stage 1A schema/RLS/seed + Stage 1C)
//   3. `npx supabase test db`         (must report PASS, Files=2, Tests=96)
//   4. `npx supabase functions serve api-write \
//        --env-file ./supabase/.env.local --no-verify-jwt`
//   5. Export SUPABASE_URL and API_READ_JWT_SECRET (or SUPABASE_JWT_SECRET).
//
// Run:
//   deno test --allow-env --allow-net --allow-read --no-check \
//     --config tests/api-write/live/deno.json \
//     tests/api-write/live/contract.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  assertErrorEnvelope,
  callApi,
  DEMO_USERS,
  FIXTURES,
  getJwtFor,
  isUuid,
  uniqueCode,
} from "./helpers.ts";
import { assertNoForbiddenWriteKeys } from "../../../supabase/functions/api-write/_tests/forbidden-fields.ts";

// ── 1) Auth / envelope ─────────────────────────────────────────────────────
Deno.test("missing Authorization → 401 unauthenticated envelope", async () => {
  const res = await callApi("POST", "/doctor/patients", { body: {} });
  assertEquals(res.status, 401);
  assertErrorEnvelope(res.body, "unauthenticated");
  if (!isUuid(res.correlationId)) {
    throw new Error(`x-correlation-id must be uuid: ${res.correlationId}`);
  }
});

Deno.test("invalid Bearer token → 401 unauthenticated envelope", async () => {
  const res = await callApi("POST", "/doctor/patients", {
    jwt: "not-a-jwt",
    body: {},
  });
  assertEquals(res.status, 401);
  assertErrorEnvelope(res.body, "unauthenticated");
});

Deno.test("supplied valid x-correlation-id is echoed", async () => {
  const cid = crypto.randomUUID();
  const res = await callApi("POST", "/doctor/patients", {
    correlationId: cid,
    body: {},
  });
  assertEquals(res.correlationId, cid);
});

Deno.test("unknown route → 404 not_found envelope", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("POST", "/no/such/route", { jwt, body: {} });
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});

Deno.test("GET on api-write → 422 validation_error", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("GET", "/doctor/patients", { jwt });
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

// ── 2) Non-doctor roles → 403 ─────────────────────────────────────────────
for (
  const key of [
    "patient",
    "assistant",
    "clinicAdmin",
    "operator",
    "systemAdmin",
  ] as const
) {
  Deno.test(`${key} hitting POST /doctor/patients → 403 forbidden`, async () => {
    const jwt = await getJwtFor(DEMO_USERS[key]);
    const res = await callApi("POST", "/doctor/patients", {
      jwt,
      body: {
        code: uniqueCode(),
        fullName: "X",
        birthDate: "1990-01-01",
        sex: "female",
        phototype: "II",
      },
    });
    assertEquals(res.status, 403);
    assertErrorEnvelope(res.body, "forbidden");
  });
}

// ── 3) Doctor happy path: full chain ──────────────────────────────────────
Deno.test("doctor full happy path: patient → visit → lesion → assessment → conclusion → report → version → finalize", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const code = uniqueCode("HP");

  // Create patient
  const cp = await callApi("POST", "/doctor/patients", {
    jwt,
    body: {
      code,
      fullName: "Иванов Тест Тестович",
      birthDate: "1985-04-21",
      sex: "male",
      phototype: "III",
      riskFactors: ["family_history"],
    },
  });
  assertEquals(cp.status, 201);
  const patient = (cp.body as { data: Record<string, unknown> }).data;
  assertEquals(patient.code, code);
  assertEquals(patient.clinicId, FIXTURES.clinicMain);
  if (!isUuid(patient.id)) throw new Error("patient.id must be uuid");
  assertNoForbiddenWriteKeys(cp.body, "POST /doctor/patients");
  const patientId = patient.id as string;

  // Patch patient
  const up = await callApi("PATCH", `/doctor/patients/${patientId}`, {
    jwt,
    body: { fullName: "Иванов Иван Иванович" },
  });
  assertEquals(up.status, 200);
  const upd = (up.body as { data: Record<string, unknown> }).data;
  assertEquals(upd.fullName, "Иванов Иван Иванович");
  assertNoForbiddenWriteKeys(up.body, "PATCH /doctor/patients/:id");

  // Create visit
  const cv = await callApi("POST", `/doctor/patients/${patientId}/visits`, {
    jwt,
    body: {
      startedAt: new Date().toISOString(),
      complaint: "родинка на спине",
    },
  });
  assertEquals(cv.status, 201);
  const visit = (cv.body as { data: Record<string, unknown> }).data;
  assertEquals(visit.patientId, patientId);
  assertEquals(visit.doctorId, DEMO_USERS.doctor.id);
  assertEquals(visit.status, "scheduled");
  assertNoForbiddenWriteKeys(cv.body, "POST /doctor/visits");
  const visitId = visit.id as string;

  // Patch visit → in_progress
  const uv = await callApi("PATCH", `/doctor/visits/${visitId}`, {
    jwt,
    body: { status: "in_progress" },
  });
  assertEquals(uv.status, 200);
  assertEquals(((uv.body as { data: Record<string, unknown> }).data).status, "in_progress");
  assertNoForbiddenWriteKeys(uv.body, "PATCH /doctor/visits/:id");

  // Create lesion
  const cl = await callApi("POST", `/doctor/patients/${patientId}/lesions`, {
    jwt,
    body: {
      bodyZone: "back-upper",
      mapView: "back",
      mapX: 0.5,
      mapY: 0.3,
      label: "L1",
      firstSeenAt: new Date().toISOString(),
    },
  });
  assertEquals(cl.status, 201);
  const lesion = (cl.body as { data: Record<string, unknown> }).data;
  assertEquals(lesion.patientId, patientId);
  assertEquals(lesion.status, "active");
  assertNoForbiddenWriteKeys(cl.body, "POST /doctor/lesions");
  const lesionId = lesion.id as string;

  // Patch lesion
  const ul = await callApi("PATCH", `/doctor/lesions/${lesionId}`, {
    jwt,
    body: { status: "monitoring", label: "L1-mon" },
  });
  assertEquals(ul.status, 200);
  assertNoForbiddenWriteKeys(ul.body, "PATCH /doctor/lesions/:id");

  // Create assessment
  const ca = await callApi("POST", `/doctor/visits/${visitId}/assessments`, {
    jwt,
    body: {
      lesionId,
      abcd: { A: 1, B: 0, C: 1, D: 2 },
      sevenPoint: { score: 4 },
      aiRisk: "moderate",
      aiConfidence: 0.62,
      aiFeatures: ["asymmetry"],
      aiUncertaintyNotes: ["low res"],
      aiXaiNotes: "Suspect zone",
    },
  });
  assertEquals(ca.status, 201);
  const ass = (ca.body as { data: Record<string, unknown> }).data;
  assertEquals(ass.visitId, visitId);
  assertEquals(ass.lesionId, lesionId);
  assertEquals(ass.aiRisk, "moderate");
  assertNoForbiddenWriteKeys(ca.body, "POST /doctor/assessments");

  // Create conclusion
  const cc = await callApi("POST", `/doctor/visits/${visitId}/conclusions`, {
    jwt,
    body: { doctorText: "Рекомендован контроль через 3 мес.", followUpPlan: "контроль 3 мес" },
  });
  assertEquals(cc.status, 201);
  const concl = (cc.body as { data: Record<string, unknown> }).data;
  assertEquals(concl.visitId, visitId);
  assertEquals(concl.decidedBy, DEMO_USERS.doctor.id);
  assertNoForbiddenWriteKeys(cc.body, "POST /doctor/conclusions");

  // Create report (idempotent? no — duplicate must be 409)
  const cr = await callApi("POST", `/doctor/visits/${visitId}/reports`, {
    jwt,
    body: {},
  });
  assertEquals(cr.status, 201);
  const report = (cr.body as { data: Record<string, unknown> }).data;
  assertEquals(report.visitId, visitId);
  assertEquals(report.currentVersionId, null);
  assertNoForbiddenWriteKeys(cr.body, "POST /doctor/reports");
  const reportId = report.id as string;

  const dup = await callApi("POST", `/doctor/visits/${visitId}/reports`, {
    jwt,
    body: {},
  });
  assertEquals(dup.status, 409);
  assertErrorEnvelope(dup.body, "conflict");

  // Create report version (draft)
  const crv = await callApi("POST", `/doctor/reports/${reportId}/versions`, {
    jwt,
    body: { patientText: "Безопасный текст", doctorText: "Внутренний текст" },
  });
  assertEquals(crv.status, 201);
  const v1 = (crv.body as { data: Record<string, unknown> }).data;
  assertEquals(v1.reportId, reportId);
  assertEquals(v1.status, "draft");
  assertEquals(v1.version, 1);
  assertNoForbiddenWriteKeys(crv.body, "POST /doctor/report-versions");
  const versionId = v1.id as string;

  // Finalize draft → final
  const fin = await callApi("PATCH", `/doctor/report-versions/${versionId}`, {
    jwt,
    body: { status: "final" },
  });
  assertEquals(fin.status, 200);
  const v1Final = (fin.body as { data: Record<string, unknown> }).data;
  assertEquals(v1Final.status, "final");
  if (typeof v1Final.signedAt !== "string") {
    throw new Error("signedAt must be set after finalize");
  }
  assertNoForbiddenWriteKeys(fin.body, "PATCH /doctor/report-versions/:id");

  // Patch report.currentVersionId
  const ur = await callApi("PATCH", `/doctor/reports/${reportId}`, {
    jwt,
    body: { currentVersionId: versionId },
  });
  assertEquals(ur.status, 200);
  assertEquals(
    ((ur.body as { data: Record<string, unknown> }).data).currentVersionId,
    versionId,
  );
  assertNoForbiddenWriteKeys(ur.body, "PATCH /doctor/reports/:id");

  // Try final → final on same version (locked)
  const lock = await callApi("PATCH", `/doctor/report-versions/${versionId}`, {
    jwt,
    body: { status: "final" },
  });
  assertEquals(lock.status, 409);
  assertErrorEnvelope(lock.body, "conflict");

  // Final → amended
  const amend = await callApi("PATCH", `/doctor/report-versions/${versionId}`, {
    jwt,
    body: { status: "amended" },
  });
  assertEquals(amend.status, 200);
  assertEquals(
    ((amend.body as { data: Record<string, unknown> }).data).status,
    "amended",
  );

  // Amended is terminal
  const term = await callApi("PATCH", `/doctor/report-versions/${versionId}`, {
    jwt,
    body: { doctorText: "noop" },
  });
  assertEquals(term.status, 409);
  assertErrorEnvelope(term.body, "conflict");
});

// ── 4) Validation ─────────────────────────────────────────────────────────
Deno.test("invalid UUID path → 422 validation_error", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("PATCH", "/doctor/patients/not-a-uuid", {
    jwt,
    body: { fullName: "X" },
  });
  assertEquals(res.status, 422);
  const env = assertErrorEnvelope(res.body, "validation_error");
  assertEquals(env.error.details.field, "patientId");
});

Deno.test("unknown body key → 422 validation_error", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("POST", "/doctor/patients", {
    jwt,
    body: {
      code: uniqueCode(),
      fullName: "X",
      birthDate: "1990-01-01",
      sex: "female",
      phototype: "II",
      somethingExtra: 1,
    },
  });
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

Deno.test("server-controlled key (clinicId) → 422 validation_error", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("POST", "/doctor/patients", {
    jwt,
    body: {
      code: uniqueCode(),
      fullName: "X",
      birthDate: "1990-01-01",
      sex: "female",
      phototype: "II",
      clinicId: FIXTURES.clinicMain,
    },
  });
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

Deno.test("server-controlled key (createdBy) → 422 validation_error", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("POST", "/doctor/patients", {
    jwt,
    body: {
      code: uniqueCode(),
      fullName: "X",
      birthDate: "1990-01-01",
      sex: "female",
      phototype: "II",
      createdBy: DEMO_USERS.doctor.id,
    },
  });
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

Deno.test("out-of-range mapX → 422 validation_error", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi(
    "POST",
    `/doctor/patients/${FIXTURES.patientP001}/lesions`,
    {
      jwt,
      body: {
        bodyZone: "back",
        mapView: "back",
        mapX: 1.5,
        mapY: 0.1,
        label: "L",
        firstSeenAt: new Date().toISOString(),
      },
    },
  );
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

Deno.test("invalid `revoked` status on report-version PATCH → 422", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  // Use a random uuid; validator rejects status before lookup.
  const res = await callApi(
    "PATCH",
    `/doctor/report-versions/${crypto.randomUUID()}`,
    { jwt, body: { status: "revoked" } },
  );
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

// ── 5) Conflict ───────────────────────────────────────────────────────────
Deno.test("duplicate patient code in same clinic → 409 conflict", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const code = uniqueCode("DUP");
  const first = await callApi("POST", "/doctor/patients", {
    jwt,
    body: {
      code,
      fullName: "First",
      birthDate: "1990-01-01",
      sex: "male",
      phototype: "II",
    },
  });
  assertEquals(first.status, 201);
  const second = await callApi("POST", "/doctor/patients", {
    jwt,
    body: {
      code,
      fullName: "Second",
      birthDate: "1990-01-01",
      sex: "male",
      phototype: "II",
    },
  });
  assertEquals(second.status, 409);
  assertErrorEnvelope(second.body, "conflict");
});

// ── 6) 404 not_found ──────────────────────────────────────────────────────
Deno.test("PATCH non-existent patient id → 404 not_found", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi(
    "PATCH",
    `/doctor/patients/${crypto.randomUUID()}`,
    { jwt, body: { fullName: "X" } },
  );
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});

Deno.test("POST visit on unknown patient id → 404 not_found", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi(
    "POST",
    `/doctor/patients/${crypto.randomUUID()}/visits`,
    { jwt, body: { startedAt: new Date().toISOString() } },
  );
  // Either RLS-hidden parent (P0001 patient_not_found) or FK (23503): both → 404.
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});

Deno.test("doctor cannot patch private-clinic patient → 404 not_found", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi(
    "PATCH",
    `/doctor/patients/${FIXTURES.patientP006Private}`,
    { jwt, body: { fullName: "X" } },
  );
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});

// ── 7) every response carries x-correlation-id ────────────────────────────
Deno.test("every response carries x-correlation-id (uuid)", async () => {
  const cases = [
    () => callApi("POST", "/doctor/patients", { body: {} }),
    () =>
      callApi("PATCH", "/doctor/patients/not-a-uuid", {
        jwt: "junk",
        body: {},
      }),
    () => callApi("POST", "/no/such/route", { body: {} }),
  ];
  for (const c of cases) {
    const r = await c();
    if (!isUuid(r.correlationId)) {
      throw new Error(`missing/invalid x-correlation-id: ${r.correlationId}`);
    }
  }
});

// ── 8) Stage 1D · audit logging (visibility + isolation) ─────────────────
import { fetchAuditLogsByCorrelationId } from "./helpers.ts";

Deno.test("successful patient create writes a clinic_admin-visible audit row", async () => {
  const cid = crypto.randomUUID();
  const doctorJwt = await getJwtFor(DEMO_USERS.doctor);
  const create = await callApi("POST", "/doctor/patients", {
    jwt: doctorJwt,
    correlationId: cid,
    body: {
      code: uniqueCode("AW1D"),
      fullName: "Аудит Один",
      birthDate: "1990-01-01",
      sex: "female",
      phototype: "II",
    },
  });
  assertEquals(create.status, 201);

  const adminJwt = await getJwtFor(DEMO_USERS.clinicAdmin);
  const rows = await fetchAuditLogsByCorrelationId(adminJwt, cid);
  if (rows.length !== 1) {
    throw new Error(`expected 1 audit row, got ${rows.length}`);
  }
  assertEquals(rows[0].action, "create");
  assertEquals(rows[0].entity, "patient");
  if ((rows[0].payload as { route?: string }).route !== "POST /doctor/patients") {
    throw new Error("audit payload.route mismatch");
  }
});

Deno.test("doctor cannot SELECT audit_logs even for own clinic", async () => {
  const cid = crypto.randomUUID();
  const doctorJwt = await getJwtFor(DEMO_USERS.doctor);
  const create = await callApi("POST", "/doctor/patients", {
    jwt: doctorJwt,
    correlationId: cid,
    body: {
      code: uniqueCode("AW1D"),
      fullName: "Аудит Два",
      birthDate: "1990-01-01",
      sex: "female",
      phototype: "II",
    },
  });
  assertEquals(create.status, 201);
  const rows = await fetchAuditLogsByCorrelationId(doctorJwt, cid);
  assertEquals(rows.length, 0);
});

Deno.test("failed validation does not write an audit row", async () => {
  const cid = crypto.randomUUID();
  const doctorJwt = await getJwtFor(DEMO_USERS.doctor);
  // Missing required fields → 422 validation_error.
  const res = await callApi("POST", "/doctor/patients", {
    jwt: doctorJwt,
    correlationId: cid,
    body: { code: "X" },
  });
  if (res.status === 201) throw new Error("expected validation failure");
  const adminJwt = await getJwtFor(DEMO_USERS.clinicAdmin);
  const rows = await fetchAuditLogsByCorrelationId(adminJwt, cid);
  assertEquals(rows.length, 0);
});

// ── 9) Stage 1E-B · Asset metadata routes ──────────────────────────────────
// Storage upload/download URL issuance is intentionally deferred to Stage 1E-C.

async function newPatientVisit(jwt: string) {
  const cp = await callApi("POST", "/doctor/patients", {
    jwt,
    body: {
      code: uniqueCode("AS"),
      fullName: "Asset Тестовый",
      birthDate: "1985-04-21",
      sex: "male",
      phototype: "III",
    },
  });
  assertEquals(cp.status, 201);
  const patientId = ((cp.body as { data: Record<string, unknown> }).data).id as string;
  const cv = await callApi("POST", `/doctor/patients/${patientId}/visits`, {
    jwt,
    body: { startedAt: new Date().toISOString() },
  });
  assertEquals(cv.status, 201);
  const visit = (cv.body as { data: Record<string, unknown> }).data;
  return { patientId, visitId: visit.id as string, clinicId: visit.clinicId as string };
}

Deno.test("doctor POST /doctor/visits/:visitId/assets → 201 + DTO + audit", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const { visitId, clinicId } = await newPatientVisit(jwt);
  const cid = crypto.randomUUID();
  const path = `clinic/${clinicId}/visit/${visitId}/${crypto.randomUUID()}.jpg`;
  const res = await callApi("POST", `/doctor/visits/${visitId}/assets`, {
    jwt,
    correlationId: cid,
    body: {
      kind: "overview",
      source: "phone",
      storageObjectPath: path,
      capturedAt: new Date().toISOString(),
      qualityScore: 0.9,
      qualityIssues: [],
      exif: { width: 4032, height: 3024 },
    },
  });
  assertEquals(res.status, 201);
  const dto = (res.body as { data: Record<string, unknown> }).data;
  assertEquals(dto.visitId, visitId);
  assertEquals(dto.clinicId, clinicId);
  assertEquals(dto.kind, "overview");
  assertEquals(dto.source, "phone");
  // Stage 1E-B safety: response DTO must NOT expose raw storage path or EXIF,
  // even though the request body accepts them.
  if ("storageObjectPath" in dto) throw new Error("storageObjectPath must not leak");
  if ("storage_object_path" in dto) throw new Error("storage_object_path must not leak");
  if ("exif" in dto) throw new Error("exif must not leak");
  if (!isUuid(dto.id)) throw new Error("asset.id must be uuid");
  assertNoForbiddenWriteKeys(res.body, "POST /doctor/assets");

  // Audit visibility for clinic_admin only.
  const adminJwt = await getJwtFor(DEMO_USERS.clinicAdmin);
  const rows = await fetchAuditLogsByCorrelationId(adminJwt, cid);
  if (rows.length !== 1) throw new Error(`expected 1 audit row, got ${rows.length}`);
  assertEquals(rows[0].entity, "asset");
  assertEquals(rows[0].action, "create");
});

Deno.test("doctor POST asset rejects storageObjectPath not bound to visit → 422", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const { visitId } = await newPatientVisit(jwt);
  const res = await callApi("POST", `/doctor/visits/${visitId}/assets`, {
    jwt,
    body: {
      kind: "overview",
      source: "phone",
      storageObjectPath: "wrong/path/object.jpg",
      capturedAt: new Date().toISOString(),
      qualityScore: 0.5,
    },
  });
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

Deno.test("doctor POST asset rejects unknown body key → 422", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const { visitId, clinicId } = await newPatientVisit(jwt);
  const res = await callApi("POST", `/doctor/visits/${visitId}/assets`, {
    jwt,
    body: {
      kind: "overview",
      source: "phone",
      storageObjectPath: `clinic/${clinicId}/visit/${visitId}/x.jpg`,
      capturedAt: new Date().toISOString(),
      qualityScore: 0.5,
      unexpectedKey: 1,
    },
  });
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

Deno.test("doctor POST asset rejects server-controlled clinicId → 422", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const { visitId, clinicId } = await newPatientVisit(jwt);
  const res = await callApi("POST", `/doctor/visits/${visitId}/assets`, {
    jwt,
    body: {
      kind: "overview",
      source: "phone",
      storageObjectPath: `clinic/${clinicId}/visit/${visitId}/x.jpg`,
      capturedAt: new Date().toISOString(),
      qualityScore: 0.5,
      clinicId: FIXTURES.clinicMain,
    },
  });
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

Deno.test("doctor POST asset on unknown visit → 404", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const fakeVisit = crypto.randomUUID();
  const res = await callApi("POST", `/doctor/visits/${fakeVisit}/assets`, {
    jwt,
    body: {
      kind: "overview",
      source: "phone",
      storageObjectPath: `clinic/${FIXTURES.clinicMain}/visit/${fakeVisit}/x.jpg`,
      capturedAt: new Date().toISOString(),
      qualityScore: 0.5,
    },
  });
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});

Deno.test("non-doctor (assistant) POST asset → 403", async () => {
  const jwt = await getJwtFor(DEMO_USERS.assistant);
  const fake = crypto.randomUUID();
  const res = await callApi("POST", `/doctor/visits/${fake}/assets`, {
    jwt,
    body: {
      kind: "overview",
      source: "phone",
      storageObjectPath: `x/visit/${fake}/x.jpg`,
      capturedAt: new Date().toISOString(),
      qualityScore: 0.5,
    },
  });
  assertEquals(res.status, 403);
  assertErrorEnvelope(res.body, "forbidden");
});

Deno.test("doctor PATCH /doctor/assets/:id updates mutable fields, blocks immutable", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const { visitId, clinicId } = await newPatientVisit(jwt);
  const path = `clinic/${clinicId}/visit/${visitId}/${crypto.randomUUID()}.jpg`;
  const create = await callApi("POST", `/doctor/visits/${visitId}/assets`, {
    jwt,
    body: {
      kind: "dermoscopy",
      source: "device_bridge",
      storageObjectPath: path,
      capturedAt: new Date().toISOString(),
      qualityScore: 0.7,
    },
  });
  assertEquals(create.status, 201);
  const assetId = ((create.body as { data: Record<string, unknown> }).data).id as string;

  // Update mutable: qualityScore + qualityIssues + exif.
  const upd = await callApi("PATCH", `/doctor/assets/${assetId}`, {
    jwt,
    body: { qualityScore: 0.95, qualityIssues: ["focus"], exif: { iso: 200 } },
  });
  assertEquals(upd.status, 200);
  const updated = (upd.body as { data: Record<string, unknown> }).data;
  assertEquals(updated.qualityScore, 0.95);
  assertEquals(updated.qualityIssues, ["focus"]);
  // PATCH may accept exif on input, but response must still strip it.
  if ("exif" in updated) throw new Error("exif must not leak in PATCH response");
  if ("storageObjectPath" in updated) throw new Error("storageObjectPath must not leak in PATCH response");

  // Immutable: try to change kind → 422 unknown_key (not in PATCH allow-list).
  const bad = await callApi("PATCH", `/doctor/assets/${assetId}`, {
    jwt,
    body: { kind: "macro" },
  });
  assertEquals(bad.status, 422);
  assertErrorEnvelope(bad.body, "validation_error");
});

Deno.test("doctor cannot PATCH cross-clinic asset (RLS-hidden) → 404", async () => {
  // Seed asset in clinicNorth (visit 70...0005) — visible to demo doctor.
  // Use privateDoctor (not in clinicNorth) — should not see it.
  const privJwt = await getJwtFor(DEMO_USERS.privateDoctor);
  const seededAsset = "90000000-0000-0000-0000-000000000010";
  const res = await callApi("PATCH", `/doctor/assets/${seededAsset}`, {
    jwt: privJwt,
    body: { qualityScore: 0.1 },
  });
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});
