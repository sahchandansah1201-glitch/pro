import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runProductionClinicalEvidenceClosure } from "./run-stage5h-production-clinical-evidence-closure.mjs";

const FIXTURE_PATH = "fixtures/stage5h/production-clinical-evidence-closure.ready.json";
const SCRIPT_PATH = "scripts/run-stage5h-production-clinical-evidence-closure.mjs";

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

function productionSource() {
  const fixture = loadFixture();
  const { evidenceScope, schemaVersion: _schemaVersion, ...validation } = fixture;
  return {
    evidenceScope: {
      ...evidenceScope,
      source: "production_clinic_operations",
      sampleContract: false,
    },
    validation,
  };
}

function withTempSource(payload, run) {
  const dir = mkdtempSync(join(tmpdir(), "stage5h-runner-"));
  const sourcePath = join(dir, "validation-export.json");
  const outDir = join(dir, "receipt");
  writeFileSync(sourcePath, JSON.stringify(payload, null, 2));
  try {
    return run({ sourcePath, outDir });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function runCli(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("Stage 5H closure runner writes a strict production bundle and safe receipt", () => {
  withTempSource(productionSource(), ({ sourcePath, outDir }) => {
    const result = runProductionClinicalEvidenceClosure({ sourcePath, outDir });
    assert.equal(result.ok, true);
    assert.equal(existsSync(result.bundlePath), true);
    assert.equal(existsSync(result.receiptPath), true);

    const receiptText = readFileSync(result.receiptPath, "utf8");
    const receipt = JSON.parse(receiptText);
    assert.equal(receipt.verification.strictProduction, true);
    assert.equal(receipt.verification.ok, true);
    assert.equal(receipt.boundaries.rawSourcePayloadStoredInReceipt, false);
    assert.equal(receipt.source.patientRowsIncluded, false);
    assert.match(receipt.source.sha256, /^[a-f0-9]{64}$/);
    assert.match(receipt.bundle.sha256, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(receiptText, /realClinicWindowCount|productionReviewWindowCount|patientId|signedUrl/);
  });
});

test("Stage 5H closure runner CLI writes output paths", () => {
  withTempSource(productionSource(), ({ sourcePath, outDir }) => {
    const result = runCli(["--source", sourcePath, "--out-dir", outDir]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /evidence-bundle\.json/);
    assert.match(result.stdout, /evidence-closure-receipt\.json/);
    assert.equal(existsSync(join(outDir, "evidence-bundle.json")), true);
    assert.equal(existsSync(join(outDir, "evidence-closure-receipt.json")), true);
  });
});

test("Stage 5H closure runner rejects contract fixtures", () => {
  const fixture = loadFixture();
  withTempSource({
    evidenceScope: fixture.evidenceScope,
    validation: fixture,
  }, ({ sourcePath, outDir }) => {
    const result = runCli(["--source", sourcePath, "--out-dir", outDir]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /strict production mode rejects sampleContract=true/);
    assert.equal(existsSync(join(outDir, "evidence-closure-receipt.json")), false);
  });
});

test("Stage 5H closure runner rejects non-zero blockers", () => {
  const source = productionSource();
  source.validation.timelineRolloutProductionReviewerGovernance.blockerCount = 1;
  withTempSource(source, ({ sourcePath, outDir }) => {
    const result = runCli(["--source", sourcePath, "--out-dir", outDir]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /blockerCount must be 0/);
    assert.equal(existsSync(join(outDir, "evidence-bundle.json")), false);
  });
});

test("Stage 5H closure runner rejects protected keys before writing receipt", () => {
  const source = productionSource();
  source.validation.timelineRolloutProductionReviewerEvidence.credential = "secret";
  withTempSource(source, ({ sourcePath, outDir }) => {
    const result = runCli(["--source", sourcePath, "--out-dir", outDir]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Forbidden protected or clinical keys found/);
    assert.equal(existsSync(join(outDir, "evidence-closure-receipt.json")), false);
  });
});
