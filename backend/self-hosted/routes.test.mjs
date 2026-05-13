import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const NOW = () => "2026-05-13T00:00:00.000Z";

function request(path, env = {}) {
  const config = readSelfHostedConfig(env);
  const response = handleSelfHostedRequest(
    {
      method: "GET",
      url: path,
      headers: { origin: "http://localhost:8080" },
    },
    config,
    NOW,
  );
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

test("healthz returns a safe self-hosted service status", () => {
  const response = request("/healthz", {
    DATABASE_URL: "postgres://user:secret@postgres:5432/app",
    OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  });

  assert.equal(response.status, 200);
  assert.equal(response.json.status, "ok");
  assert.equal(response.json.deploymentMode, "self-hosted");
  assert.doesNotMatch(response.body, /secret|postgres:\/\/user/i);
});

test("readyz reports degraded until database and object storage are configured", () => {
  const degraded = request("/readyz");
  assert.equal(degraded.status, 503);
  assert.equal(degraded.json.status, "degraded");
  assert.equal(degraded.json.dependencies.length, 2);

  const ready = request("/readyz", {
    DATABASE_URL: "postgres://app:secret@postgres:5432/dermatolog_pro",
    OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  });
  assert.equal(ready.status, 200);
  assert.equal(ready.json.status, "ready");
  assert.doesNotMatch(ready.body, /secret|dermatolog_pro/);
});

test("meta and openapi routes expose contracts without runtime secrets", () => {
  const meta = request("/api/v1/meta", {
    DATABASE_URL: "postgres://app:secret@postgres:5432/dermatolog_pro",
    OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
    OBJECT_STORAGE_BUCKET: "medical-assets",
  });
  assert.equal(meta.status, 200);
  assert.equal(meta.json.capabilities.audit, "append-only-contract");
  assert.equal(meta.json.links.openapi, "/openapi.stage4a.json");
  assert.equal(meta.json.service.objectStorageBucket, "medical-assets");
  assert.doesNotMatch(meta.body, /secret|postgres:\/\//);

  const openapi = request("/openapi.stage4a.json");
  assert.equal(openapi.status, 200);
  assert.equal(openapi.json.openapi, "3.1.0");
  assert.equal(openapi.json.info.title, "Dermatolog Pro Self-hosted API");
});

test("unknown routes return JSON 404", () => {
  const response = request("/missing");
  assert.equal(response.status, 404);
  assert.equal(response.json.error, "not_found");
});
