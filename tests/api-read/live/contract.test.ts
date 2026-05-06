// Stage 1B-B · Live API contract tests for `supabase/functions/api-read`.
//
// Preconditions (local only — NOT run in CI in this stage):
//   1. `npx supabase start`
//   2. `npx supabase db reset`             (loads Stage 1A schema/RLS/seed)
//   3. `npx supabase functions serve api-read \
//        --env-file ./supabase/.env.local --no-verify-jwt`
//   4. Export SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//      (service role is used ONLY to set demo passwords on seeded users —
//       the API itself never sees it).
//
// Run:
//   deno test --allow-env --allow-net --no-check \
//     --config tests/api-read/live/deno.json \
//     tests/api-read/live/contract.test.ts
//
// These tests assert:
//   * canonical error envelope on auth/validation/not-found
//   * /me roles are correct per role
//   * patient surface returns the linked patient + 1 final report version
//   * doctor surface returns only own-clinic patients
//   * cross-clinic patient detail → not_found via RLS (404)
//   * forbidden fields never leak (recursive scanner over every response)

import { assertEquals } from "jsr:@std/assert@1";
import {
  ApiResponse,
  assertErrorEnvelope,
  callApi,
  DEMO_USERS,
  FIXTURES,
  getJwtFor,
  isUuid,
} from "./helpers.ts";
import {
  assertNoForbiddenKeys,
  FORBIDDEN_DOCTOR_KEYS,
  FORBIDDEN_ME_KEYS,
  FORBIDDEN_PATIENT_KEYS,
} from "../../../supabase/functions/api-read/_tests/forbidden-fields.ts";

// ── Auth / envelope ────────────────────────────────────────────────────────
Deno.test("missing Authorization → 401 unauthenticated envelope", async () => {
  const res = await callApi("/me");
  assertEquals(res.status, 401);
  assertErrorEnvelope(res.body, "unauthenticated");
  if (!isUuid(res.correlationId)) {
    throw new Error(`x-correlation-id must be uuid: ${res.correlationId}`);
  }
});

Deno.test("invalid Bearer token → 401 unauthenticated envelope", async () => {
  const res = await callApi("/me", { jwt: "not-a-real-jwt" });
  assertEquals(res.status, 401);
  assertErrorEnvelope(res.body, "unauthenticated");
});

Deno.test("supplied valid x-correlation-id is echoed", async () => {
  const cid = crypto.randomUUID();
  const res = await callApi("/me", { correlationId: cid });
  assertEquals(res.correlationId, cid);
});

Deno.test("invalid uuid path param → 422 validation_error envelope", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("/patient/reports/not-a-uuid/versions", { jwt });
  assertEquals(res.status, 422);
  const env = assertErrorEnvelope(res.body, "validation_error");
  assertEquals(env.error.details.field, "reportId");
});

Deno.test("unknown route → 404 not_found envelope", async () => {
  const res = await callApi("/no/such/route");
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});

// ── /me per role ───────────────────────────────────────────────────────────
function assertMeShape(res: ApiResponse, expected: {
  userId: string;
  email: string;
  roles: string[];
  clinicId: string | null;
  hasPatientLink: boolean;
}) {
  assertEquals(res.status, 200);
  const body = res.body as { data: Record<string, unknown> };
  const dto = body.data;
  assertEquals(dto.userId, expected.userId);
  assertEquals(dto.email, expected.email);
  assertEquals(dto.roles, expected.roles);
  assertEquals(dto.clinicId, expected.clinicId);
  assertEquals(dto.hasPatientLink, expected.hasPatientLink);
  assertNoForbiddenKeys(body, FORBIDDEN_ME_KEYS, "/me");
}

for (const key of Object.keys(DEMO_USERS) as (keyof typeof DEMO_USERS)[]) {
  const u = DEMO_USERS[key];
  Deno.test(`/me as ${u.key}`, async () => {
    const jwt = await getJwtFor(u);
    const res = await callApi("/me", { jwt });
    assertMeShape(res, {
      userId: u.id,
      email: u.email,
      roles: u.expectedRoles,
      clinicId: u.expectedClinicId,
      hasPatientLink: u.key === "patient",
    });
  });
}

// ── Patient surface ────────────────────────────────────────────────────────
Deno.test("/patient/me returns the linked patient (p-001)", async () => {
  const jwt = await getJwtFor(DEMO_USERS.patient);
  const res = await callApi("/patient/me", { jwt });
  assertEquals(res.status, 200);
  const body = res.body as { data: Record<string, unknown> };
  assertEquals(body.data.id, FIXTURES.patientP001);
  assertEquals(Object.keys(body.data).sort(), [
    "birthDate",
    "code",
    "fullName",
    "id",
    "phototype",
    "sex",
  ]);
  assertNoForbiddenKeys(body, FORBIDDEN_PATIENT_KEYS, "/patient/me");
});

Deno.test("/patient/reports returns exactly the 1 final report", async () => {
  const jwt = await getJwtFor(DEMO_USERS.patient);
  const res = await callApi("/patient/reports", { jwt });
  assertEquals(res.status, 200);
  const body = res.body as { data: Array<Record<string, unknown>>; nextCursor: null };
  assertEquals(body.nextCursor, null);
  assertEquals(body.data.length, 1);
  assertEquals(body.data[0].id, FIXTURES.patientLinkedReport);
  assertEquals(Object.keys(body.data[0]).sort(), [
    "generatedAt",
    "id",
    "visitId",
  ]);
  assertNoForbiddenKeys(body, FORBIDDEN_PATIENT_KEYS, "/patient/reports");
});

Deno.test("/patient/reports/:id/versions returns 1 final version, text only", async () => {
  const jwt = await getJwtFor(DEMO_USERS.patient);
  const res = await callApi(
    `/patient/reports/${FIXTURES.patientLinkedReport}/versions`,
    { jwt },
  );
  assertEquals(res.status, 200);
  const body = res.body as { data: Array<Record<string, unknown>> };
  assertEquals(body.data.length, 1);
  const v = body.data[0];
  assertEquals(v.id, FIXTURES.patientLinkedReportVersion);
  assertEquals(v.status, "final");
  assertEquals(typeof v.text, "string");
  assertEquals(Object.keys(v).sort(), ["createdAt", "id", "status", "text"]);
  assertNoForbiddenKeys(
    body,
    FORBIDDEN_PATIENT_KEYS,
    "/patient/reports/:id/versions",
  );
});

Deno.test("patient cannot read another patient's report versions (RLS → empty)", async () => {
  const jwt = await getJwtFor(DEMO_USERS.patient);
  const res = await callApi(
    `/patient/reports/${FIXTURES.northReport}/versions`,
    { jwt },
  );
  assertEquals(res.status, 200);
  const body = res.body as { data: unknown[] };
  assertEquals(body.data.length, 0);
});

// ── Doctor surface ─────────────────────────────────────────────────────────
Deno.test("/doctor/patients returns only doctor's own clinics (main+north)", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("/doctor/patients", { jwt });
  assertEquals(res.status, 200);
  const body = res.body as { data: Array<Record<string, unknown>> };
  const clinicIds = new Set(body.data.map((p) => p.clinicId as string));
  // Doctor staffs main + north; must NOT see private clinic patient.
  if (clinicIds.has(FIXTURES.clinicPrivate)) {
    throw new Error(
      `doctor saw private clinic patient — cross-clinic leak: ${
        JSON.stringify([...clinicIds])
      }`,
    );
  }
  const ids = new Set(body.data.map((p) => p.id as string));
  if (!ids.has(FIXTURES.patientP001) || !ids.has(FIXTURES.patientP004)) {
    throw new Error(
      `doctor missing expected own-clinic patients: ${JSON.stringify([...ids])}`,
    );
  }
  assertNoForbiddenKeys(body, FORBIDDEN_DOCTOR_KEYS, "/doctor/patients");
});

Deno.test("/doctor/patients/:id cross-clinic → 404 not_found", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi(
    `/doctor/patients/${FIXTURES.patientP006Private}`,
    { jwt },
  );
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});

Deno.test("/doctor/patients/:id own-clinic → 200 with riskFactors", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi(
    `/doctor/patients/${FIXTURES.patientP004}`,
    { jwt },
  );
  assertEquals(res.status, 200);
  const body = res.body as { data: Record<string, unknown> };
  assertEquals(body.data.id, FIXTURES.patientP004);
  assertEquals(Array.isArray(body.data.riskFactors), true);
  assertNoForbiddenKeys(body, FORBIDDEN_DOCTOR_KEYS, "/doctor/patients/:id");
});

Deno.test("/doctor/reports/:id/versions returns doctorText + patientText", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi(
    `/doctor/reports/${FIXTURES.northReport}/versions`,
    { jwt },
  );
  assertEquals(res.status, 200);
  const body = res.body as { data: Array<Record<string, unknown>> };
  assertEquals(body.data.length, 1);
  const v = body.data[0];
  assertEquals(v.id, FIXTURES.northReportVersion);
  assertEquals(typeof v.doctorText, "string");
  assertEquals(typeof v.patientText, "string");
  assertNoForbiddenKeys(
    body,
    FORBIDDEN_DOCTOR_KEYS,
    "/doctor/reports/:id/versions",
  );
});

// ── Cross-surface: patient hits doctor route ───────────────────────────────
Deno.test("patient calling /doctor/patients → 403 forbidden", async () => {
  const jwt = await getJwtFor(DEMO_USERS.patient);
  const res = await callApi("/doctor/patients", { jwt });
  assertEquals(res.status, 403);
  assertErrorEnvelope(res.body, "forbidden");
});

Deno.test("patient calling /doctor/patients/:id → 403 forbidden", async () => {
  const jwt = await getJwtFor(DEMO_USERS.patient);
  const res = await callApi(
    `/doctor/patients/${FIXTURES.patientP001}`,
    { jwt },
  );
  assertEquals(res.status, 403);
  assertErrorEnvelope(res.body, "forbidden");
});

Deno.test("private doctor cannot read main-clinic patient (RLS → 404)", async () => {
  const jwt = await getJwtFor(DEMO_USERS.privateDoctor);
  const res = await callApi(
    `/doctor/patients/${FIXTURES.patientP001}`,
    { jwt },
  );
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});
