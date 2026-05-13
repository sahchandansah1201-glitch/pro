import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { DatabaseUnavailableError } from "./db-client.mjs";
import { ForbiddenError } from "./rbac.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const NOW = () => "2026-05-13T00:00:00.000Z";

function createRuntime({
  connected = true,
  patients = [],
  patientError = null,
  patientDetail = null,
  createdPatient = null,
  updatedPatient = null,
  archivedPatient = null,
  authContext = {
    userId: "10000000-0000-4000-8000-000000000101",
    displayName: "Demo Doctor",
    roles: ["doctor"],
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    roleBindings: [
      {
        role: "doctor",
        clinicId: "10000000-0000-4000-8000-000000000001",
        clinicSlug: "demo-clinic",
      },
    ],
    token: { issuedAt: 1, expiresAt: 3601 },
  },
  authError = null,
  loginError = null,
  auditEvents = [],
} = {}) {
  return {
    dbClient: {
      async checkConnection() {
        if (!connected) {
          throw new DatabaseUnavailableError("PostgreSQL password=secret failed");
        }
        return { connected: true, detail: "PostgreSQL connection verified" };
      },
    },
    authService: {
      async login() {
        if (loginError) throw loginError;
        return {
          tokenType: "Bearer",
          accessToken: "header.payload.signature",
          expiresInSeconds: 3600,
          user: {
            id: authContext.userId,
            displayName: authContext.displayName,
            roles: authContext.roleBindings,
          },
        };
      },
      async authenticate() {
        if (authError) throw authError;
        return authContext;
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
    patientRepository: {
      async listPatients(params) {
        if (patientError) throw patientError;
        return {
          items: patients,
          count: patients.length,
          limit: params.limit,
          offset: params.offset,
          search: params.search,
          clinicIds: params.clinicIds,
          allClinics: params.allClinics,
          source: "postgres",
        };
      },
      async getPatient() {
        if (patientError) throw patientError;
        return patientDetail;
      },
      async createPatient() {
        if (patientError) throw patientError;
        return createdPatient;
      },
      async updatePatient() {
        if (patientError) throw patientError;
        return updatedPatient;
      },
      async archivePatient() {
        if (patientError) throw patientError;
        return archivedPatient;
      },
    },
  };
}

async function request(
  path,
  env = {},
  runtime = createRuntime(),
  method = "GET",
  body = undefined,
) {
  const config = readSelfHostedConfig(env);
  const response = await handleSelfHostedRequest(
    {
      method,
      url: path,
      headers: {
        origin: "http://localhost:8080",
        authorization: "Bearer header.payload.signature",
      },
      body,
    },
    config,
    NOW,
    runtime,
  );
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

const configuredEnv = {
  DATABASE_URL: "postgres://user:secret@postgres:5432/app",
  OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  JWT_SECRET: "stage4c-local-test-secret",
};

test("healthz returns a safe self-hosted service status", async () => {
  const response = await request("/healthz", configuredEnv);

  assert.equal(response.status, 200);
  assert.equal(response.json.status, "ok");
  assert.equal(response.json.deploymentMode, "self-hosted");
  assert.doesNotMatch(response.body, /secret|postgres:\/\/user/i);
});

test("readyz reports degraded until database and object storage are configured", async () => {
  const degraded = await request("/readyz", {}, createRuntime());
  assert.equal(degraded.status, 503);
  assert.equal(degraded.json.status, "degraded");
  assert.equal(degraded.json.dependencies.length, 3);

  const unavailable = await request(
    "/readyz",
    configuredEnv,
    createRuntime({ connected: false }),
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.json.status, "degraded");
  assert.equal(
    unavailable.json.dependencies.find((item) => item.name === "postgres").status,
    "unavailable",
  );
  assert.doesNotMatch(unavailable.body, /secret|postgres:\/\//);

  const ready = await request("/readyz", configuredEnv, createRuntime());
  assert.equal(ready.status, 200);
  assert.equal(ready.json.status, "ready");
  assert.equal(
    ready.json.dependencies.find((item) => item.name === "postgres").status,
    "connected",
  );
  assert.doesNotMatch(ready.body, /secret|app/);
});

test("meta and openapi routes expose contracts without runtime secrets", async () => {
  const meta = await request("/api/v1/meta", {
    ...configuredEnv,
    OBJECT_STORAGE_BUCKET: "medical-assets",
  });
  assert.equal(meta.status, 200);
  assert.equal(meta.json.stage, "4D");
  assert.equal(meta.json.capabilities.auth, "local-jwt");
  assert.equal(meta.json.capabilities.patients, "rbac-read-write-postgres");
  assert.equal(meta.json.links.openapi, "/openapi.stage4d.json");
  assert.equal(meta.json.links.openapiStage4A, "/openapi.stage4a.json");
  assert.equal(meta.json.links.openapiStage4B, "/openapi.stage4b.json");
  assert.equal(meta.json.links.openapiStage4C, "/openapi.stage4c.json");
  assert.equal(meta.json.service.objectStorageBucket, "medical-assets");
  assert.doesNotMatch(meta.body, /secret|postgres:\/\//);

  const openapi4a = await request("/openapi.stage4a.json");
  assert.equal(openapi4a.status, 200);
  assert.equal(openapi4a.json.info.version, "4A-foundation");

  const openapi4b = await request("/openapi.stage4b.json");
  assert.equal(openapi4b.status, 200);
  assert.equal(openapi4b.json.info.version, "4B-runtime");
  assert.equal(
    openapi4b.json.paths["/api/v1/patients"].get.responses["200"].description,
    "Read-only patient list from PostgreSQL",
  );

  const openapi4c = await request("/openapi.stage4c.json");
  assert.equal(openapi4c.status, 200);
  assert.equal(openapi4c.json.info.version, "4C-auth-rbac");
  assert.equal(openapi4c.json.components.securitySchemes.bearerAuth.scheme, "bearer");

  const openapi4d = await request("/openapi.stage4d.json");
  assert.equal(openapi4d.status, 200);
  assert.equal(openapi4d.json.info.version, "4D-patient-writes");
  assert.equal(openapi4d.json.paths["/api/v1/patients"].post.responses["201"].description, "Patient created");
});

test("auth login returns a bearer token without leaking password material", async () => {
  const response = await request(
    "/api/v1/auth/login",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({ email: "doctor.demo@example.invalid", password: "demo-password" }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.tokenType, "Bearer");
  assert.equal(response.json.user.displayName, "Demo Doctor");
  assert.equal(response.json.user.roles[0].role, "doctor");
  assert.doesNotMatch(response.body, /demo-password|passwordHash|\$scrypt|secret/i);
});

test("auth me returns role bindings for an authenticated bearer token", async () => {
  const response = await request("/api/v1/auth/me", configuredEnv, createRuntime());

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.user.displayName, "Demo Doctor");
  assert.equal(response.json.user.roles[0].clinicSlug, "demo-clinic");
  assert.equal(response.json.token.expiresAt, 3601);
});

test("patients list returns role-scoped read-only PostgreSQL data and audit metadata", async () => {
  const patients = [
    {
      id: "10000000-0000-4000-8000-000000000201",
      code: "DP-DEMO-0001",
      fullName: "Demo Patient One",
      birthDate: "1984-02-14",
      sex: "female",
      phototype: "II",
      imagingConsent: true,
      clinic: { slug: "demo-clinic", name: "Dermatolog Pro Demo Clinic" },
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
    },
  ];
  const auditEvents = [];
  const response = await request(
    "/api/v1/patients?limit=1&offset=2&search=Demo",
    configuredEnv,
    createRuntime({ patients, auditEvents }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.limit, 1);
  assert.equal(response.json.offset, 2);
  assert.equal(response.json.search, "Demo");
  assert.equal(response.json.clinicIds[0], "10000000-0000-4000-8000-000000000001");
  assert.equal(response.json.auth.roles[0], "doctor");
  assert.equal(response.json.items[0].fullName, "Demo Patient One");
  assert.equal(auditEvents[0].action, "patient.list");
  assert.doesNotMatch(response.body, /storage_object_path|access_token|postgres:\/\/|secret/i);
});

test("patients list maps database failures to safe JSON errors", async () => {
  const response = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({
      patientError: new DatabaseUnavailableError(
        "PostgreSQL failed for postgres://user:secret@postgres:5432/app",
      ),
    }),
  );

  assert.equal(response.status, 503);
  assert.equal(response.json.error.code, "database_unavailable");
  assert.equal(
    response.json.error.message,
    "Database is unavailable for the self-hosted backend.",
  );
  assert.doesNotMatch(response.body, /secret|postgres:\/\/user|app/);
});

test("patients list requires auth and rejects roles without patient-read access", async () => {
  const anonymous = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({ authContext: null }),
  );
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.json.error.code, "auth_required");
  assert.equal(
    anonymous.json.error.message,
    "Authentication is required for this endpoint.",
  );

  const denied = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime({
      authContext: {
        userId: "operator-1",
        displayName: "Operator",
        roles: ["operator"],
        clinicIds: ["10000000-0000-4000-8000-000000000001"],
        roleBindings: [],
        token: {},
      },
      authError: new ForbiddenError(),
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, "forbidden");
  assert.equal(
    denied.json.error.message,
    "The authenticated user does not have access to this resource.",
  );
});

test("patient detail returns role-scoped data and audit event", async () => {
  const auditEvents = [];
  const response = await request(
    "/api/v1/patients/10000000-0000-4000-8000-000000000201",
    configuredEnv,
    createRuntime({
      auditEvents,
      patientDetail: {
        id: "10000000-0000-4000-8000-000000000201",
        code: "DP-DEMO-0001",
        fullName: "Demo Patient One",
        birthDate: "1984-02-14",
        sex: "female",
        phototype: "II",
        imagingConsent: true,
        notes: "detail note",
        clinic: {
          id: "10000000-0000-4000-8000-000000000001",
          slug: "demo-clinic",
          name: "Dermatolog Pro Demo Clinic",
        },
        createdAt: "2026-05-13T00:00:00.000Z",
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4D");
  assert.equal(response.json.item.notes, "detail note");
  assert.equal(auditEvents[0].action, "patient.read");
});

test("patient write routes create, update, and archive with audit-safe responses", async () => {
  const auditEvents = [];
  const basePatient = {
    id: "10000000-0000-4000-8000-000000000201",
    code: "DP-DEMO-0001",
    fullName: "Demo Patient One",
    birthDate: "1984-02-14",
    sex: "female",
    phototype: "II",
    imagingConsent: true,
    notes: null,
    clinic: {
      id: "10000000-0000-4000-8000-000000000001",
      slug: "demo-clinic",
      name: "Dermatolog Pro Demo Clinic",
    },
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
  };
  const runtime = createRuntime({
    auditEvents,
    createdPatient: basePatient,
    updatedPatient: { ...basePatient, fullName: "Updated Patient" },
    archivedPatient: { ...basePatient, deletedAt: "2026-05-13T00:00:00.000Z" },
  });

  const created = await request(
    "/api/v1/patients",
    configuredEnv,
    runtime,
    "POST",
    JSON.stringify({ fullName: "Demo Patient One", birthDate: "1984-02-14" }),
  );
  assert.equal(created.status, 201);
  assert.equal(created.json.stage, "4D");
  assert.equal(created.json.item.id, basePatient.id);

  const updated = await request(
    `/api/v1/patients/${basePatient.id}`,
    configuredEnv,
    runtime,
    "PATCH",
    JSON.stringify({ fullName: "Updated Patient" }),
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.fullName, "Updated Patient");

  const archived = await request(
    `/api/v1/patients/${basePatient.id}`,
    configuredEnv,
    runtime,
    "DELETE",
    JSON.stringify({ reason: "duplicate" }),
  );
  assert.equal(archived.status, 200);
  assert.equal(archived.json.archived, true);
  assert.equal(auditEvents.map((event) => event.action).join(","), "patient.create,patient.update,patient.archive");
  assert.doesNotMatch(archived.body, /password_hash|storage_object_path|access_token|postgres:\/\/|secret/i);
});

test("patient write routes validate payload, auth, and clinic scope safely", async () => {
  const invalid = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({ fullName: "Only" }),
  );
  assert.equal(invalid.status, 422);
  assert.equal(invalid.json.error.code, "validation_error");
  assert.equal(invalid.json.error.details[0].field, "fullName");

  const malformed = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    "{bad json",
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformed.json.error.code, "invalid_json");

  const forbiddenClinic = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
    JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000099",
      fullName: "Demo Patient",
    }),
  );
  assert.equal(forbiddenClinic.status, 403);
  assert.equal(forbiddenClinic.json.error.code, "forbidden");
});

test("unknown routes and unsupported methods return the common JSON error shape", async () => {
  const missing = await request("/missing");
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, "not_found");
  assert.equal(typeof missing.json.error.message, "string");
  assert.equal(missing.json.correlationId, "stage4d-local");

  const post = await request("/api/v1/meta", {}, createRuntime(), "POST");
  assert.equal(post.status, 405);
  assert.equal(post.json.error.code, "method_not_allowed");

  const put = await request(
    "/api/v1/patients/10000000-0000-4000-8000-000000000201",
    configuredEnv,
    createRuntime(),
    "PUT",
  );
  assert.equal(put.status, 405);
  assert.equal(put.json.error.code, "method_not_allowed");
});
