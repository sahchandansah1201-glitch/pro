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
