import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { DatabaseUnavailableError } from "./db-client.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const NOW = () => "2026-05-13T00:00:00.000Z";

function createRuntime({
  connected = true,
  patients = [],
  patientError = null,
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
    patientRepository: {
      async listPatients(params) {
        if (patientError) throw patientError;
        return {
          items: patients,
          count: patients.length,
          limit: params.limit,
          offset: params.offset,
          search: params.search,
          source: "postgres",
        };
      },
    },
  };
}

async function request(path, env = {}, runtime = createRuntime(), method = "GET") {
  const config = readSelfHostedConfig(env);
  const response = await handleSelfHostedRequest(
    {
      method,
      url: path,
      headers: { origin: "http://localhost:8080" },
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
  assert.equal(degraded.json.dependencies.length, 2);

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
  assert.equal(meta.json.stage, "4B");
  assert.equal(meta.json.capabilities.patients, "read-only-postgres");
  assert.equal(meta.json.links.openapi, "/openapi.stage4b.json");
  assert.equal(meta.json.links.openapiStage4A, "/openapi.stage4a.json");
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
});

test("patients list returns read-only PostgreSQL data and pagination metadata", async () => {
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
  const response = await request(
    "/api/v1/patients?limit=1&offset=2&search=Demo",
    configuredEnv,
    createRuntime({ patients }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.stage, "4B");
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.limit, 1);
  assert.equal(response.json.offset, 2);
  assert.equal(response.json.search, "Demo");
  assert.equal(response.json.items[0].fullName, "Demo Patient One");
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

test("unknown routes and unsupported methods return the common JSON error shape", async () => {
  const missing = await request("/missing");
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, "not_found");
  assert.equal(typeof missing.json.error.message, "string");
  assert.equal(missing.json.correlationId, "stage4b-local");

  const post = await request("/api/v1/meta", {}, createRuntime(), "POST");
  assert.equal(post.status, 405);
  assert.equal(post.json.error.code, "method_not_allowed");

  const createPatient = await request(
    "/api/v1/patients",
    configuredEnv,
    createRuntime(),
    "POST",
  );
  assert.equal(createPatient.status, 501);
  assert.equal(createPatient.json.error.code, "not_implemented");
});
