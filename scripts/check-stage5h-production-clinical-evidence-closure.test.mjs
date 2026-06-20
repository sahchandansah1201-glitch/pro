import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { validateProductionClinicalEvidenceClosure } from "./check-stage5h-production-clinical-evidence-closure.mjs";

const FIXTURE_PATH = "fixtures/stage5h/production-clinical-evidence-closure.ready.json";
const SCRIPT_PATH = "scripts/check-stage5h-production-clinical-evidence-closure.mjs";

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

function withTempEvidence(bundle, run) {
  const dir = mkdtempSync(join(tmpdir(), "stage5h-evidence-"));
  const filePath = join(dir, "evidence.json");
  writeFileSync(filePath, JSON.stringify(bundle, null, 2));
  try {
    return run(filePath);
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

test("Stage 5H production clinical evidence closure validates the contract fixture", () => {
  const fixture = loadFixture();
  const result = validateProductionClinicalEvidenceClosure(fixture);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedSections, 5);
  assert.deepEqual(result.sdMfCoverage, ["SD-MF-025", "SD-MF-026"]);
});

test("Stage 5H production clinical evidence closure CLI exits zero for the fixture", () => {
  const result = runCli();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage5h-production-clinical-evidence-closure/);
  assert.match(result.stdout, /Strict production certification requires/);
});

test("Stage 5H production clinical evidence closure rejects missing real aggregate counts", () => {
  const fixture = loadFixture();
  fixture.timelineRolloutProductionDatasetEvidence.realClinicWindowCount = 0;
  withTempEvidence(fixture, (filePath) => {
    const result = runCli(["--fixture", filePath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /realClinicWindowCount must be a positive number/);
  });
});

test("Stage 5H production clinical evidence closure rejects unresolved work", () => {
  const fixture = loadFixture();
  fixture.timelineRolloutProductionReviewerEvidence.unresolvedProductionReviewerEvidenceCount = 1;
  withTempEvidence(fixture, (filePath) => {
    const result = runCli(["--fixture", filePath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unresolvedProductionReviewerEvidenceCount must be 0/);
  });
});

test("Stage 5H production clinical evidence closure rejects enabled boundary flags", () => {
  const fixture = loadFixture();
  fixture.timelineRolloutLongitudinalClinicalValidation.clinicalOutputGenerated = true;
  withTempEvidence(fixture, (filePath) => {
    const result = runCli(["--fixture", filePath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /clinicalOutputGenerated must be false/);
  });
});

test("Stage 5H production clinical evidence closure rejects protected or clinical keys", () => {
  const fixture = loadFixture();
  fixture.timelineRolloutProductionReviewerGovernance.pairKey = "pair-001";
  withTempEvidence(fixture, (filePath) => {
    const result = runCli(["--fixture", filePath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Forbidden protected or clinical keys found/);
    assert.match(result.stderr, /pairKey/);
  });
});

test("Stage 5H production clinical evidence closure strict mode rejects contract fixtures", () => {
  const result = runCli(["--strict-production"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /strict production mode rejects sampleContract=true/);
});

test("Stage 5H production clinical evidence closure strict mode accepts a production aggregate bundle", () => {
  const fixture = loadFixture();
  fixture.evidenceScope.source = "production_clinic_operations";
  fixture.evidenceScope.sampleContract = false;
  withTempEvidence(fixture, (filePath) => {
    const result = runCli(["--strict-production", "--fixture", filePath]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /mode=strict-production/);
  });
});
