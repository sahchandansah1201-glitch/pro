import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const CLINIC_ID_2 = "10000000-0000-4000-8000-000000000002";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const LESION_ID = "10000000-0000-4000-8000-000000000401";
const ASSET_ID = "10000000-0000-4000-8000-000000000501";
const CONFIG = readSelfHostedConfig({
  DATABASE_URL: "postgres://user:secret@postgres:5432/app",
  OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  JWT_SECRET: "clinic-admin-rbac-test-secret",
});
const AUTH = {
  userId: "10000000-0000-4000-8000-000000000101",
  roles: ["clinic_admin"],
  clinicIds: [CLINIC_ID],
  roleBindings: [{ role: "clinic_admin", clinicId: CLINIC_ID }],
  token: {},
};

function createFailClosedRuntime() {
  let repositoryCalls = 0;
  const repository = new Proxy({}, {
    get() {
      return async () => {
        repositoryCalls += 1;
        throw new Error("repository must not be called for denied clinic-admin access");
      };
    },
  });
  return {
    runtime: {
      dbClient: {},
      objectStore: repository,
      authService: { async authenticate() { return AUTH; } },
      auditRepository: { async recordEvent() {} },
      patientRepository: repository,
      visitWorkspaceRepository: repository,
      clinicalWorkspaceRepository: repository,
      clinicalReportPackageRepository: repository,
      assetWriteRepository: repository,
      clinicalFollowUpRepository: repository,
      doctorDashboardRepository: repository,
      visitScheduleRepository: repository,
    },
    repositoryCallCount: () => repositoryCalls,
  };
}

async function request(path, method, body, runtime) {
  return handleSelfHostedRequest({
    method,
    url: path,
    headers: {
      origin: "http://localhost:8080",
      authorization: "Bearer header.payload.signature",
    },
    body,
  }, CONFIG, () => "2026-09-03T00:00:00.000Z", runtime);
}

const DENIED_ROUTES = [
  ["GET", "/api/v1/patients"],
  ["POST", "/api/v1/patients", "{}"],
  ["GET", `/api/v1/patients/${PATIENT_ID}`],
  ["PATCH", `/api/v1/patients/${PATIENT_ID}`, "{}"],
  ["DELETE", `/api/v1/patients/${PATIENT_ID}`, "{}"],
  ["GET", "/api/v1/visits"],
  ["GET", `/api/v1/patients/${PATIENT_ID}/visits`],
  ["GET", `/api/v1/visits/${VISIT_ID}`],
  ["GET", `/api/v1/visits/${VISIT_ID}/lesions`],
  ["GET", `/api/v1/visits/${VISIT_ID}/assets`],
  ["GET", `/api/v1/visits/${VISIT_ID}/assessment`],
  ["GET", `/api/v1/visits/${VISIT_ID}/conclusion`],
  ["GET", `/api/v1/visits/${VISIT_ID}/report`],
  ["GET", `/api/v1/visits/${VISIT_ID}/report-package`],
  ["GET", `/api/v1/visits/${VISIT_ID}/patient-photo-protocol-release/audit`],
  ["GET", `/api/v1/assets/${ASSET_ID}/download-url`],
  ["GET", `/api/v1/assets/${ASSET_ID}/download`],
  ["GET", `/api/v1/patients/${PATIENT_ID}/lesions/${LESION_ID}/longitudinal-history`],
  ["GET", `/api/v1/patients/${PATIENT_ID}/lesions/${LESION_ID}/capture-metadata`],
  ["GET", `/api/v1/patients/${PATIENT_ID}/lesions/${LESION_ID}/longitudinal-qa`],
  ["GET", `/api/v1/patients/${PATIENT_ID}/lesions/${LESION_ID}/images/${ASSET_ID}/render`],
  ["GET", `/api/v1/visits/${VISIT_ID}/lesion-comparison-viewer-qa/review-queue`],
  ["GET", `/api/v1/visits/${VISIT_ID}/longitudinal-dataset-validation`],
  ["GET", "/api/v1/clinical/follow-ups"],
  ["GET", "/api/v1/clinical/follow-ups/operations"],
  ["GET", "/api/v1/doctor/dashboard"],
];

test("clinic_admin receives 403 before repositories for patient and clinical routes", async () => {
  for (const [method, path, body] of DENIED_ROUTES) {
    const fixture = createFailClosedRuntime();
    const response = await request(path, method, body, fixture.runtime);
    assert.equal(response.status, 403, `${method} ${path}`);
    assert.equal(JSON.parse(response.body).error.code, "forbidden", `${method} ${path}`);
    assert.equal(fixture.repositoryCallCount(), 0, `${method} ${path}`);
    assert.doesNotMatch(response.body, /header\.payload|object[_-](?:bucket|key)|signed[_-]?url/i);
  }
});

test("clinic_admin keeps allow-listed operations and governance summaries", async () => {
  const calls = [];
  const runtime = {
    dbClient: {},
    objectStore: {},
    authService: { async authenticate() { return AUTH; } },
    auditRepository: { async recordEvent() {} },
    clinicalFollowUpRepository: {
      async getClinicalFollowUpOperationsSummary(params) {
        calls.push(["operations", params]);
        return { totalOpen: 2, overdue: 1, escalated: 0 };
      },
      async getClinicalFollowUpOutcomeQualitySummary(params) {
        calls.push(["governance", params]);
        return { closedFollowUps: 4, closedMissingEvidence: 0, qualityNeedsAttention: 1 };
      },
    },
  };

  const operations = await request("/api/v1/clinical/follow-ups/operations/summary", "GET", undefined, runtime);
  const governance = await request("/api/v1/clinical/follow-ups/outcomes/summary", "GET", undefined, runtime);
  assert.equal(operations.status, 200);
  assert.equal(governance.status, 200);
  assert.deepEqual(calls.map(([name]) => name), ["operations", "governance"]);
  for (const [, params] of calls) {
    assert.equal(params.allClinics, false);
    assert.deepEqual(params.clinicIds, [CLINIC_ID]);
  }
});

test("doctor capabilities keep representative same-clinic clinical access", async () => {
  for (const roles of [["doctor"], ["private_doctor"], ["clinic_admin", "private_doctor"]]) {
    let repositoryCalls = 0;
    const runtime = {
      dbClient: {},
      objectStore: {},
      authService: {
        async authenticate() {
          return {
            ...AUTH,
            roles,
            roleBindings: roles.map((role) => ({ role, clinicId: CLINIC_ID })),
          };
        },
      },
      auditRepository: { async recordEvent() {} },
      visitWorkspaceRepository: {
        async getVisit() {
          repositoryCalls += 1;
          return { id: VISIT_ID, clinic: { id: CLINIC_ID }, patient: { id: PATIENT_ID } };
        },
      },
    };

    const response = await request(`/api/v1/visits/${VISIT_ID}`, "GET", undefined, runtime);
    assert.equal(response.status, 200, roles.join("+"));
    assert.equal(repositoryCalls, 1, roles.join("+"));
  }
});

test("multi-role clinical access uses only clinics bound to a clinical role", async () => {
  let receivedScope = null;
  const runtime = {
    dbClient: {},
    objectStore: {},
    authService: {
      async authenticate() {
        return {
          ...AUTH,
          roles: ["clinic_admin", "private_doctor"],
          clinicIds: [CLINIC_ID, CLINIC_ID_2],
          roleBindings: [
            { role: "clinic_admin", clinicId: CLINIC_ID },
            { role: "private_doctor", clinicId: CLINIC_ID_2 },
          ],
        };
      },
    },
    auditRepository: { async recordEvent() {} },
    visitWorkspaceRepository: {
      async getVisit(scope) {
        receivedScope = scope;
        return { id: VISIT_ID, clinic: { id: CLINIC_ID_2 }, patient: { id: PATIENT_ID } };
      },
    },
  };

  const response = await request(`/api/v1/visits/${VISIT_ID}`, "GET", undefined, runtime);
  assert.equal(response.status, 200);
  assert.deepEqual(receivedScope, {
    visitId: VISIT_ID,
    clinicIds: [CLINIC_ID_2],
    allClinics: false,
  });
});
