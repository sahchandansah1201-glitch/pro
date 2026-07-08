import assert from "node:assert/strict";
import { test } from "node:test";

import { handlePublicAnalysisRequest } from "./public-analysis-routes.mjs";

const config = { corsOrigins: ["https://example.test"] };

function publicErrorFor(error) {
  return {
    status: error.publicStatus || 500,
    code: error.publicCode || "internal_error",
    message: error.message || "Internal error",
  };
}

test("public analysis route returns safe public analysis payload", async () => {
  const calls = [];
  const response = await handlePublicAnalysisRequest({
    method: "GET",
    url: new URL("https://example.test/api/v1/public/analysis/live-token-001"),
    config,
    requestOrigin: "https://example.test",
    correlationId: "cor-public-001",
    now: () => "2026-07-08T10:00:00.000Z",
    publicErrorFor,
    runtimeServices: {
      publicAnalysisService: {
        async getPublicAnalysis(token, options) {
          calls.push({ token, options });
          return {
            analysis: {
              status: "valid",
              safeSummary: "Покажите врачу на контрольном приёме.",
              clinicName: "Клиника",
              qualityPassed: true,
            },
          };
        },
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      token: "live-token-001",
      options: {
        correlationId: "cor-public-001",
        nowIso: "2026-07-08T10:00:00.000Z",
      },
    },
  ]);
  const body = JSON.parse(response.body);
  assert.equal(body.stage, "6P");
  assert.equal(body.source, "postgres");
  assert.equal(body.item.status, "valid");
  assert.equal(body.item.safeSummary, "Покажите врачу на контрольном приёме.");
});

test("public analysis route ignores unrelated routes", async () => {
  const response = await handlePublicAnalysisRequest({
    method: "GET",
    url: new URL("https://example.test/api/v1/patients"),
    config,
    requestOrigin: "https://example.test",
    correlationId: "cor-public-002",
    now: () => "2026-07-08T10:00:00.000Z",
    publicErrorFor,
    runtimeServices: {},
  });

  assert.equal(response, null);
});
