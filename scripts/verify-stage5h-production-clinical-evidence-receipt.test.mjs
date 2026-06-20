import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runProductionClinicalEvidenceClosure } from "./run-stage5h-production-clinical-evidence-closure.mjs";
import { verifyProductionClinicalEvidenceReceiptPackage } from "./verify-stage5h-production-clinical-evidence-receipt.mjs";

const FIXTURE_PATH = "fixtures/stage5h/production-clinical-evidence-closure.ready.json";
const SCRIPT_PATH = "scripts/verify-stage5h-production-clinical-evidence-receipt.mjs";

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

function withReceiptPackage(run) {
  const dir = mkdtempSync(join(tmpdir(), "stage5h-receipt-verify-"));
  const sourcePath = join(dir, "validation-export.json");
  writeFileSync(sourcePath, `${JSON.stringify(productionSource(), null, 2)}\n`);
  const result = runProductionClinicalEvidenceClosure({ sourcePath, outDir: dir });
  assert.equal(result.ok, true);
  try {
    return run(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function runCli(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("Stage 5H receipt verifier accepts a strict production closure package", () => {
  withReceiptPackage((dir) => {
    const result = verifyProductionClinicalEvidenceReceiptPackage({ dir });
    assert.equal(result.ok, true, result.errors.join("\n"));
  });
});

test("Stage 5H receipt verifier CLI reports coverage for a valid package", () => {
  withReceiptPackage((dir) => {
    const result = runCli(["--dir", dir]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SD-MF-025, SD-MF-026, SD-MF-028/);
  });
});

test("Stage 5H receipt verifier rejects source hash drift", () => {
  withReceiptPackage((dir) => {
    const sourcePath = join(dir, "validation-export.json");
    const source = readJson(sourcePath);
    source.validation.timelineRolloutProductionDatasetEvidence.realClinicWindowCount = 99;
    writeJson(sourcePath, source);

    const result = verifyProductionClinicalEvidenceReceiptPackage({ dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /receipt\.source\.sha256/);
  });
});

test("Stage 5H receipt verifier rejects bundle hash drift and strict validation failures", () => {
  withReceiptPackage((dir) => {
    const bundlePath = join(dir, "evidence-bundle.json");
    const bundle = readJson(bundlePath);
    bundle.timelineRolloutProductionReviewerEvidence.blockerCount = 1;
    writeJson(bundlePath, bundle);

    const result = verifyProductionClinicalEvidenceReceiptPackage({ dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /receipt\.bundle\.sha256/);
    assert.match(result.errors.join("\n"), /strict bundle validation failed/);
  });
});

test("Stage 5H receipt verifier rejects forbidden raw payload text in receipt", () => {
  withReceiptPackage((dir) => {
    const receiptPath = join(dir, "evidence-closure-receipt.json");
    const receipt = readJson(receiptPath);
    receipt.debug = {
      productionReviewWindowCount: 8,
    };
    writeJson(receiptPath, receipt);

    const result = verifyProductionClinicalEvidenceReceiptPackage({ dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden raw, protected, clinical or aggregate-count text/);
  });
});

test("Stage 5H receipt verifier rejects missing package files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5h-receipt-missing-"));
  try {
    assert.throws(
      () => verifyProductionClinicalEvidenceReceiptPackage({ dir }),
      /Missing receipt package file/,
    );
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("Stage 5H receipt verifier help exits successfully", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verify-stage5h-production-clinical-evidence-receipt/);
});

test("Stage 5H receipt verifier fails from CLI on tampered package", () => {
  withReceiptPackage((dir) => {
    const receiptPath = join(dir, "evidence-closure-receipt.json");
    const receipt = readJson(receiptPath);
    receipt.boundaries.patientDeliveryAllowed = true;
    writeJson(receiptPath, receipt);

    const result = runCli(["--dir", dir]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /receipt\.boundaries/);
    assert.equal(existsSync(receiptPath), true);
  });
});
