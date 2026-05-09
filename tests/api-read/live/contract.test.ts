// Stage 1B-B · Live API contract tests for `supabase/functions/api-read`.
//
// Preconditions (local only — NOT run in CI in this stage):
//   1. `npx supabase start`
//   2. `npx supabase db reset`             (loads Stage 1A schema/RLS/seed)
//   3. `npx supabase functions serve api-read \
//        --env-file ./supabase/.env.local --no-verify-jwt`
//   4. Export SUPABASE_URL and SUPABASE_JWT_SECRET. JWTs are minted
//      locally (HS256) for seeded auth.users.id values; no service role,
//      no admin client, no password sign-in.
//
// Run:
//   deno test --allow-env --allow-net --allow-read --no-check \
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

// ── Stage 1E-B: doctor asset metadata read ────────────────────────────────
Deno.test("doctor GET /doctor/visits/:visitId/assets returns seeded assets", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const visitId = "70000000-0000-0000-0000-000000000005"; // clinicNorth seeded
  const res = await callApi(`/doctor/visits/${visitId}/assets`, { jwt });
  assertEquals(res.status, 200);
  const body = res.body as { data: Array<Record<string, unknown>> };
  if (body.data.length !== 3) {
    throw new Error(`expected 3 seeded assets, got ${body.data.length}`);
  }
  for (const a of body.data) {
    assertEquals(a.visitId, visitId);
    if (typeof a.qualityScore !== "number") {
      throw new Error("qualityScore must be a number");
    }
    // Stage 1E-B safety: raw storage path and EXIF must NEVER appear.
    if ("storageObjectPath" in a) throw new Error("storageObjectPath must not leak");
    if ("storage_object_path" in a) throw new Error("storage_object_path must not leak");
    if ("exif" in a) throw new Error("exif must not leak");
  }
  assertNoForbiddenKeys(body, FORBIDDEN_DOCTOR_KEYS, "/doctor/visits/:id/assets");
});

Deno.test("private doctor GET assets on cross-clinic visit → empty list (RLS)", async () => {
  const jwt = await getJwtFor(DEMO_USERS.privateDoctor);
  const visitId = "70000000-0000-0000-0000-000000000005";
  const res = await callApi(`/doctor/visits/${visitId}/assets`, { jwt });
  assertEquals(res.status, 200);
  const body = res.body as { data: unknown[] };
  assertEquals(body.data.length, 0);
});

Deno.test("patient GET /doctor/visits/:id/assets → 403 forbidden", async () => {
  const jwt = await getJwtFor(DEMO_USERS.patient);
  const res = await callApi(
    `/doctor/visits/70000000-0000-0000-0000-000000000005/assets`,
    { jwt },
  );
  assertEquals(res.status, 403);
  assertErrorEnvelope(res.body, "forbidden");
});

Deno.test("doctor GET assets with invalid uuid → 422", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("/doctor/visits/not-a-uuid/assets", { jwt });
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

// ── Stage 1E-D: signed download URL ───────────────────────────────────────
//
// Bound chosen behavior: out-of-bounds `expiresIn` is REJECTED with 422
// (NOT silently clamped). See docs/backend/stage-1e-runbook.md.
//
// The seeded assets in db/stage1a/seed.sql have storage paths that do NOT
// exist as real Storage objects (metadata-only seed). To exercise the happy
// path we first upload a real file via api-write, then ask api-read for a
// signed URL on the resulting assetId. This keeps the test self-contained
// and avoids touching seed.sql.
async function uploadSeededAsset(
  jwt: string,
  visitId: string,
): Promise<string> {
  const baseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("SUPABASE_URL must be set");
  const apiWriteBase = Deno.env.get("API_WRITE_BASE_URL") ??
    `${baseUrl}/functions/v1/api-write`;
  const form = new FormData();
  // 1×1 PNG, valid image/png payload.
  const png = Uint8Array.from([
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,
    0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
    0x08,0x06,0x00,0x00,0x00,0x1f,0x15,0xc4,0x89,0x00,0x00,0x00,
    0x0d,0x49,0x44,0x41,0x54,0x78,0x9c,0x63,0x00,0x01,0x00,0x00,
    0x05,0x00,0x01,0x0d,0x0a,0x2d,0xb4,0x00,0x00,0x00,0x00,0x49,
    0x45,0x4e,0x44,0xae,0x42,0x60,0x82,
  ]);
  form.set("file", new File([png], "px.png", { type: "image/png" }));
  form.set("kind", "overview");
  form.set("source", "phone");
  form.set("capturedAt", new Date().toISOString());
  form.set("qualityScore", "0.9");
  const res = await fetch(
    `${apiWriteBase}/doctor/visits/${visitId}/assets/upload`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${jwt}` },
      body: form,
    },
  );
  const text = await res.text();
  if (res.status !== 201) {
    throw new Error(
      `upload precondition failed: ${res.status} ${text}`,
    );
  }
  const body = JSON.parse(text) as { data: { id: string } };
  return body.data.id;
}

Deno.test("doctor GET /doctor/assets/:id/download-url → 200 + DTO, no path/exif leak", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const visitId = "70000000-0000-0000-0000-000000000005";
  const assetId = await uploadSeededAsset(jwt, visitId);
  const res = await callApi(`/doctor/assets/${assetId}/download-url`, { jwt });
  if (res.status !== 200) {
    throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
  const body = res.body as { data: Record<string, unknown> };
  const dto = body.data;
  assertEquals(Object.keys(dto).sort(), [
    "assetId",
    "clinicId",
    "downloadUrl",
    "expiresAt",
    "expiresIn",
    "visitId",
  ]);
  assertEquals(dto.assetId, assetId);
  assertEquals(dto.visitId, visitId);
  assertEquals(dto.expiresIn, 300);
  if (typeof dto.downloadUrl !== "string" || dto.downloadUrl.length < 8) {
    throw new Error("downloadUrl must be a non-empty string");
  }
  if (typeof dto.expiresAt !== "string" || Number.isNaN(Date.parse(dto.expiresAt as string))) {
    throw new Error("expiresAt must be ISO timestamp");
  }
  // Raw storage path / EXIF MUST NEVER appear anywhere in the response.
  const raw = JSON.stringify(body);
  if (raw.includes("storage_object_path") || raw.includes("storageObjectPath")) {
    throw new Error("storage path leaked in signed-URL response");
  }
  if (raw.includes('"exif"')) {
    throw new Error("exif leaked in signed-URL response");
  }
  assertNoForbiddenKeys(body, FORBIDDEN_DOCTOR_KEYS, "/doctor/assets/:id/download-url");
});

Deno.test("doctor download-url honours custom expiresIn within bounds", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const visitId = "70000000-0000-0000-0000-000000000005";
  const assetId = await uploadSeededAsset(jwt, visitId);
  const res = await callApi(
    `/doctor/assets/${assetId}/download-url?expiresIn=120`,
    { jwt },
  );
  assertEquals(res.status, 200);
  const body = res.body as { data: { expiresIn: number } };
  assertEquals(body.data.expiresIn, 120);
});

Deno.test("private doctor cross-clinic asset → 404 (RLS-hidden)", async () => {
  const jwt = await getJwtFor(DEMO_USERS.privateDoctor);
  // Seeded north-clinic asset; private doctor is in a different clinic.
  const assetId = "90000000-0000-0000-0000-000000000010";
  const res = await callApi(`/doctor/assets/${assetId}/download-url`, { jwt });
  assertEquals(res.status, 404);
  assertErrorEnvelope(res.body, "not_found");
});

Deno.test("patient GET /doctor/assets/:id/download-url → 403 forbidden", async () => {
  const jwt = await getJwtFor(DEMO_USERS.patient);
  const res = await callApi(
    `/doctor/assets/90000000-0000-0000-0000-000000000010/download-url`,
    { jwt },
  );
  assertEquals(res.status, 403);
  assertErrorEnvelope(res.body, "forbidden");
});

Deno.test("doctor download-url with invalid uuid → 422", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const res = await callApi("/doctor/assets/not-a-uuid/download-url", { jwt });
  assertEquals(res.status, 422);
  const env = assertErrorEnvelope(res.body, "validation_error");
  assertEquals(env.error.details.field, "assetId");
});

Deno.test("doctor download-url with expiresIn=12.5 (non-integer) → 422", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const assetId = "90000000-0000-0000-0000-000000000010";
  const res = await callApi(
    `/doctor/assets/${assetId}/download-url?expiresIn=12.5`,
    { jwt },
  );
  assertEquals(res.status, 422);
  const env = assertErrorEnvelope(res.body, "validation_error");
  assertEquals(env.error.details.field, "expiresIn");
});

Deno.test("doctor download-url with expiresIn below 60 → 422 (rejected, not clamped)", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const assetId = "90000000-0000-0000-0000-000000000010";
  const res = await callApi(
    `/doctor/assets/${assetId}/download-url?expiresIn=10`,
    { jwt },
  );
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});

Deno.test("doctor download-url with expiresIn above 900 → 422 (rejected, not clamped)", async () => {
  const jwt = await getJwtFor(DEMO_USERS.doctor);
  const assetId = "90000000-0000-0000-0000-000000000010";
  const res = await callApi(
    `/doctor/assets/${assetId}/download-url?expiresIn=1000`,
    { jwt },
  );
  assertEquals(res.status, 422);
  assertErrorEnvelope(res.body, "validation_error");
});
