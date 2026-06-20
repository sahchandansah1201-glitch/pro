import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  PRODUCTION_AGGREGATE_CONFIRMATION,
  exportProductionClinicalEvidenceFromApi,
  main,
  redactSecrets,
} from "./export-stage5h-production-clinical-evidence-from-api.mjs";

const FIXTURE_PATH = "fixtures/stage5h/production-clinical-evidence-closure.ready.json";

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

function productionValidation() {
  const fixture = loadFixture();
  const { evidenceScope: _evidenceScope, schemaVersion: _schemaVersion, ...validation } = fixture;
  return validation;
}

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "stage5h-api-export-"));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const apiBaseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await run(apiBaseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function writeJsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

async function captureConsole(run) {
  const originalLog = console.log;
  const originalError = console.error;
  const stdout = [];
  const stderr = [];
  console.log = (...args) => stdout.push(args.join(" "));
  console.error = (...args) => stderr.push(args.join(" "));
  try {
    const status = await run();
    return {
      status,
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test("Stage 5H API export fetches aggregate validation and writes strict closure receipt", async () => {
  await withServer((request, response) => {
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/api/v1/visits/visit-001/longitudinal-dataset-validation");
    assert.equal(request.headers.authorization, "Bearer test-token");
    writeJsonResponse(response, 200, {
      data: productionValidation(),
    });
  }, async (apiBaseUrl) => {
    await withTempDir(async (outDir) => {
      const result = await exportProductionClinicalEvidenceFromApi({
        apiBaseUrl,
        apiToken: "test-token",
        visitId: "visit-001",
        outDir,
        confirmation: PRODUCTION_AGGREGATE_CONFIRMATION,
      });

      assert.equal(result.ok, true);
      assert.equal(existsSync(join(outDir, "validation-export.json")), true);
      assert.equal(existsSync(join(outDir, "evidence-bundle.json")), true);
      assert.equal(existsSync(join(outDir, "evidence-closure-receipt.json")), true);
      assert.equal(result.receipt.verification.strictProduction, true);
      assert.equal(result.receipt.verification.ok, true);

      const sourceText = readFileSync(join(outDir, "validation-export.json"), "utf8");
      assert.match(sourceText, /"source": "production_clinic_operations"/);
      assert.doesNotMatch(sourceText, /test-token|patientId|signedUrl|doctorVersionText/);
    });
  });
});

test("Stage 5H API export requires explicit real aggregate confirmation before network access", async () => {
  let fetchCalled = false;
  await assert.rejects(
    () => exportProductionClinicalEvidenceFromApi({
      apiBaseUrl: "https://clinic.example.invalid",
      apiToken: "test-token",
      visitId: "visit-001",
      outDir: "/tmp/not-used",
      confirmation: "yes",
      fetchImpl: async () => {
        fetchCalled = true;
        throw new Error("should not fetch");
      },
    }),
    /confirm-real-production-aggregate must equal|STAGE5H_CONFIRM_REAL_PRODUCTION_AGGREGATE/,
  );
  assert.equal(fetchCalled, false);
});

test("Stage 5H API export rejects API failures without writing closure files", async () => {
  await withServer((_request, response) => {
    writeJsonResponse(response, 500, {
      error: "internal",
    });
  }, async (apiBaseUrl) => {
    await withTempDir(async (outDir) => {
      await assert.rejects(
        () => exportProductionClinicalEvidenceFromApi({
          apiBaseUrl,
          apiToken: "test-token",
          visitId: "visit-001",
          outDir,
          confirmation: PRODUCTION_AGGREGATE_CONFIRMATION,
        }),
        /API request failed: 500/,
      );
      assert.equal(existsSync(join(outDir, "validation-export.json")), false);
      assert.equal(existsSync(join(outDir, "evidence-closure-receipt.json")), false);
    });
  });
});

test("Stage 5H API export rejects protected keys before writing source export or receipt", async () => {
  const validation = productionValidation();
  validation.timelineRolloutProductionReviewerEvidence.signedUrl = "https://example.invalid/private";

  await withServer((_request, response) => {
    writeJsonResponse(response, 200, {
      data: validation,
    });
  }, async (apiBaseUrl) => {
    await withTempDir(async (outDir) => {
      await assert.rejects(
        () => exportProductionClinicalEvidenceFromApi({
          apiBaseUrl,
          apiToken: "test-token",
          visitId: "visit-001",
          outDir,
          confirmation: PRODUCTION_AGGREGATE_CONFIRMATION,
        }),
        /Forbidden protected or clinical keys found/,
      );
      assert.equal(existsSync(join(outDir, "validation-export.json")), false);
      assert.equal(existsSync(join(outDir, "evidence-closure-receipt.json")), false);
    });
  });
});

test("Stage 5H API export redacts bearer token from CLI errors", async () => {
  const secret = "super-secret-token";
  const captured = await captureConsole(() => main([
    "--api-base-url",
    "https://clinic.example.invalid",
    "--api-token",
    secret,
    "--visit-id",
    "visit-001",
    "--confirm-real-production-aggregate",
    PRODUCTION_AGGREGATE_CONFIRMATION,
  ], {}, async () => {
    throw new Error(`transport failed with ${secret}`);
  }));

  assert.equal(captured.status, 1);
  assert.match(captured.stderr, /\[redacted\]/);
  assert.doesNotMatch(captured.stderr, new RegExp(secret));
});

test("Stage 5H API export redaction helper replaces all secret occurrences", () => {
  assert.equal(redactSecrets("one token two token", ["token"]), "one [redacted] two [redacted]");
});
