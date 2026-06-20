import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildProductionClinicalEvidenceBundle } from "./build-stage5h-production-clinical-evidence-bundle.mjs";
import { validateProductionClinicalEvidenceClosure } from "./check-stage5h-production-clinical-evidence-closure.mjs";

const FIXTURE_PATH = "fixtures/stage5h/production-clinical-evidence-closure.ready.json";
const SCRIPT_PATH = "scripts/build-stage5h-production-clinical-evidence-bundle.mjs";

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

function withTempJson(payload, run) {
  const dir = mkdtempSync(join(tmpdir(), "stage5h-builder-"));
  const sourcePath = join(dir, "source.json");
  const outPath = join(dir, "bundle.json");
  writeFileSync(sourcePath, JSON.stringify(payload, null, 2));
  try {
    return run({ sourcePath, outPath });
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

test("Stage 5H evidence bundle builder maps a validation export to closure schema", () => {
  const bundle = buildProductionClinicalEvidenceBundle(productionSource());
  assert.equal(bundle.schemaVersion, "stage5h-production-clinical-evidence-closure/v1");
  assert.equal(bundle.evidenceScope.source, "production_clinic_operations");
  assert.equal(bundle.timelineRolloutProductionDatasetEvidence.realClinicWindowCount, 12);
  const validation = validateProductionClinicalEvidenceClosure(bundle, { strictProduction: true });
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});

test("Stage 5H evidence bundle builder accepts nested data.validation exports", () => {
  const source = productionSource();
  const bundle = buildProductionClinicalEvidenceBundle({
    evidenceScope: source.evidenceScope,
    data: {
      validation: source.validation,
    },
  });
  assert.equal(bundle.timelineRolloutProductionReviewerEvidence.status, "ready_for_production_reviewer_evidence");
});

test("Stage 5H evidence bundle builder CLI writes a strict production bundle", () => {
  withTempJson(productionSource(), ({ sourcePath, outPath }) => {
    const result = runCli(["--strict-production", "--source", sourcePath, "--out", outPath]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(outPath), true);
    const bundle = JSON.parse(readFileSync(outPath, "utf8"));
    assert.equal(bundle.evidenceScope.sampleContract, false);
    assert.equal(bundle.timelineRolloutProductionReviewerRollbackEvidence.rollbackReadyProductionCount, 2);
  });
});

test("Stage 5H evidence bundle builder rejects exports without evidence scope", () => {
  const source = productionSource();
  withTempJson(source.validation, ({ sourcePath }) => {
    const result = runCli(["--source", sourcePath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must include evidenceScope/);
  });
});

test("Stage 5H evidence bundle builder rejects incomplete production exports", () => {
  const source = productionSource();
  source.validation.timelineRolloutLongitudinalClinicalValidation.governanceReviewCount = 0;
  withTempJson(source, ({ sourcePath }) => {
    const result = runCli(["--strict-production", "--source", sourcePath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /governanceReviewCount must be a positive number/);
  });
});

test("Stage 5H evidence bundle builder rejects protected keys from production exports", () => {
  const source = productionSource();
  source.validation.timelineRolloutProductionDatasetEvidence.signedUrl = "https://example.invalid/file";
  withTempJson(source, ({ sourcePath }) => {
    const result = runCli(["--strict-production", "--source", sourcePath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Forbidden protected or clinical keys found/);
    assert.match(result.stderr, /signedUrl/);
  });
});
