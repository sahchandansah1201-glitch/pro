import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const IDEMPOTENCY_KEY = "asset-upload-0000000000000001";
const config = readSelfHostedConfig({
  DATABASE_URL: "postgres://user:secret@postgres:5432/app",
  OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  JWT_SECRET: "stage4i-local-test-secret",
});

function runtime({ replayed = false, calls = [] } = {}) {
  return {
    authService: {
      async authenticate() {
        return { userId: "doctor-1", roles: ["doctor"], clinicIds: [CLINIC_ID] };
      },
    },
    assetWriteService: {
      async createVisitAsset(...args) {
        calls.push(args);
        return {
          replayed,
          asset: {
            id: "10000000-0000-4000-8000-000000000901",
            clinicId: CLINIC_ID,
            visitId: VISIT_ID,
            kind: "overview_photo",
            contentType: "image/png",
          },
          scope: { allClinics: false, clinicIds: [CLINIC_ID] },
        };
      },
    },
  };
}

async function request(headers, services) {
  const response = await handleSelfHostedRequest(
    {
      method: "POST",
      url: `/api/v1/visits/${VISIT_ID}/assets`,
      headers: { origin: "http://localhost:8080", authorization: "Bearer token", ...headers },
      body: JSON.stringify({ kind: "overview", contentType: "image/png", byteSize: 4096 }),
    },
    config,
    () => "2026-09-03T00:00:00.000Z",
    services,
  );
  return { ...response, json: JSON.parse(response.body) };
}

test("asset route forwards idempotency and distinguishes create from replay", async () => {
  const calls = [];
  const created = await request({ "idempotency-key": IDEMPOTENCY_KEY }, runtime({ calls }));
  assert.equal(created.status, 201);
  assert.equal(created.json.upload.replayed, false);
  assert.equal(calls[0][3].idempotencyKey, IDEMPOTENCY_KEY);

  const replay = await request({ "Idempotency-Key": IDEMPOTENCY_KEY }, runtime({ replayed: true }));
  assert.equal(replay.status, 200);
  assert.equal(replay.json.upload.replayed, true);
  assert.doesNotMatch(replay.body, /object_bucket|object_key|storage_object_path|signed|access_token/i);
});

test("asset route exposes the idempotency CORS and OpenAPI contracts", async () => {
  const preflight = await handleSelfHostedRequest(
    { method: "OPTIONS", url: `/api/v1/visits/${VISIT_ID}/assets`, headers: { origin: "http://localhost:8080" } },
    config,
    undefined,
    runtime(),
  );
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers["access-control-allow-headers"], /idempotency-key/);

  const openapi = await handleSelfHostedRequest(
    { method: "GET", url: "/openapi.stage4i.json", headers: {} },
    config,
    undefined,
    runtime(),
  );
  const post = JSON.parse(openapi.body).paths["/api/v1/visits/{visitId}/assets"].post;
  assert.equal(post.parameters[1].name, "Idempotency-Key");
  assert.equal(post.parameters[1].required, true);
  assert.ok(post.responses["200"]);
  assert.ok(post.responses["409"]);
});
