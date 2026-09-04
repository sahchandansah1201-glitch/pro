import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000203";
const IDEMPOTENCY_KEY = "019ffbca-f316-7f81-80db-9e1792daa4d5";
const config = readSelfHostedConfig({
  DATABASE_URL: "postgres://user:secret@postgres:5432/app",
  OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  JWT_SECRET: "stage4c-local-test-secret",
});

function runtime({ replayed = false, calls = [] } = {}) {
  return {
    authService: {
      async authenticate() {
        return { userId: "doctor-1", roles: ["doctor"], clinicIds: ["clinic-1"] };
      },
    },
    visitWorkspaceWriteService: {
      async createLesion(...args) {
        calls.push(args);
        return {
          replayed,
          lesion: {
            id: "lesion-1",
            mapPoint: { view: "front", x: 0.35083, y: 0.7875 },
            bodyRegionId: "front-right-toes",
            bodyRegionDetailId: "digit-5",
            bodyAtlasSource: "makehuman-cc0",
            bodyAtlasProfileId: "adult_female_30",
            bodyAtlasManifestSha256: "a".repeat(64),
            bodyRegionMapSha256: "b".repeat(64),
            placementRevision: 1,
          },
          scope: { allClinics: false },
        };
      },
    },
  };
}

async function request(method, body, headers, services) {
  const response = await handleSelfHostedRequest(
    {
      method,
      url: `/api/v1/visits/${VISIT_ID}/lesions`,
      headers: { origin: "http://localhost:8080", authorization: "Bearer token", ...headers },
      body,
    },
    config,
    () => "2026-08-21T18:00:00.000Z",
    services,
  );
  return { ...response, json: response.body ? JSON.parse(response.body) : null };
}

test("body-map create route forwards idempotency and distinguishes create from replay", async () => {
  const calls = [];
  const body = JSON.stringify({
    label: "Очаг на мизинце",
    bodyMap: {
      atlasSource: "makehuman-cc0",
      atlasProfileId: "adult_female_30",
      view: "front",
      x: 0.35,
      y: 0.96,
      regionId: "front-right-toes",
      detailId: "digit-5",
    },
  });
  const created = await request("POST", body, { "idempotency-key": IDEMPOTENCY_KEY }, runtime({ calls }));
  assert.equal(created.status, 201);
  assert.equal(created.json.stage, "4L-Q4");
  assert.equal(created.json.replayed, false);
  assert.equal(created.json.item.bodyAtlasProfileId, "adult_female_30");
  assert.equal(calls[0][3].idempotencyKey, IDEMPOTENCY_KEY);

  const replay = await request("POST", body, { "Idempotency-Key": IDEMPOTENCY_KEY }, runtime({ replayed: true }));
  assert.equal(replay.status, 200);
  assert.equal(replay.json.replayed, true);
});

test("body-map route exposes the idempotency CORS and OpenAPI contracts", async () => {
  const preflight = await request("OPTIONS", undefined, {}, runtime());
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers["access-control-allow-headers"], /idempotency-key/);

  const openapi = await handleSelfHostedRequest(
    { method: "GET", url: "/openapi.stage4h.json", headers: {} },
    config,
    undefined,
    runtime(),
  );
  const document = JSON.parse(openapi.body);
  assert.ok(document.components.schemas.BodyMapPlacementRequest);
  assert.equal(document.paths["/api/v1/visits/{visitId}/lesions"].post.parameters[1].name, "Idempotency-Key");
  assert.deepEqual(document.components.schemas.BodyMapPlacementRequest.required, [
    "atlasSource", "atlasProfileId", "view", "x", "y", "regionId",
  ]);
});

test("body-map backend config pins the owner-approved high-resolution atlas", () => {
  assert.equal(config.clinicalBodyAtlasSource, "daz-hires-local");
  assert.equal(config.clinicalBodyAtlasDir, "public/clinical-body-atlas-daz-local");
  assert.equal(
    config.clinicalBodyAtlasManifestSha256,
    "0afadcfdfffb5a6a23e7061ca2fc48eba951e32395eecdde8313e846fac4c741",
  );
  const localDaz = readSelfHostedConfig({
    CLINICAL_BODY_ATLAS_SOURCE: "daz-hires-local",
    CLINICAL_BODY_ATLAS_DIR: "/tmp/atlas",
    CLINICAL_BODY_ATLAS_MANIFEST_SHA256: "a".repeat(64),
  });
  assert.equal(localDaz.clinicalBodyAtlasSource, "daz-hires-local");
  assert.equal(localDaz.clinicalBodyAtlasDir, "/tmp/atlas");
  assert.equal(localDaz.clinicalBodyAtlasManifestSha256, "a".repeat(64));

  assert.throws(
    () => readSelfHostedConfig({ CLINICAL_BODY_ATLAS_SOURCE: "makehuman-cc0" }),
    /only the owner-approved high-resolution atlas/i,
  );
});
