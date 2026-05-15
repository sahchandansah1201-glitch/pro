import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildExternalAdapterReconciliationPackage,
  detectReconciliationLeaks,
  readReconciliationManifest,
  validateReconciliationManifest,
} from "./stage5y-external-adapter-reconciliation-package.mjs";
import {
  readPayloadFile,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";
import {
  readStatusSnapshot,
  validateStatusSnapshot,
} from "./stage5v-external-adapter-ops.mjs";
import {
  readAuditManifest,
  validateAuditManifest,
  buildExternalAdapterAuditBundle,
} from "./stage5x-external-adapter-audit-package.mjs";
import {
  readIncidentPolicy,
  validateIncidentPolicy,
} from "./stage5w-external-adapter-incident-runbook.mjs";

const NOW = "2026-05-15T10:30:00.000Z";

function buildFixturePackage(overrides = {}) {
  const manifest = validateReconciliationManifest({
    ...readReconciliationManifest(),
    ...overrides,
  });
  const payload = validateExternalAdapterPayload(readPayloadFile(manifest.payloadFile));
  const status = validateStatusSnapshot(readStatusSnapshot(manifest.statusFile));
  const auditManifest = validateAuditManifest(readAuditManifest(manifest.auditManifestFile));
  const policy = validateIncidentPolicy(readIncidentPolicy(auditManifest.policyFile));
  const auditPayload = validateExternalAdapterPayload(readPayloadFile(auditManifest.payloadFile));
  const auditStatus = validateStatusSnapshot(readStatusSnapshot(auditManifest.statusFile));
  const auditBundle = buildExternalAdapterAuditBundle({
    manifest: auditManifest,
    payload: auditPayload,
    status: auditStatus,
    policy,
    now: auditManifest.generatedAt,
  });
  return buildExternalAdapterReconciliationPackage({
    manifest,
    payload,
    status,
    auditManifest,
    auditBundle,
    now: NOW,
  });
}

test("Stage 5Y validates bundled reconciliation manifest", () => {
  const manifest = validateReconciliationManifest(readReconciliationManifest());
  assert.equal(manifest.sourceSystem, "clinic_crm");
  assert.equal(manifest.productRuntimeCallsExternalSystems, false);
  assert.equal(manifest.managedRuntimeDependency, "none");
  assert.equal(manifest.outcomes.length, 2);
});

test("Stage 5Y builds accepted/booked reconciliation package", () => {
  const pkg = buildFixturePackage();
  assert.equal(pkg.stage, "5Y");
  assert.equal(pkg.readyForOperatorSignoff, true);
  assert.equal(pkg.outcomes.bookedCount, 1);
  assert.equal(pkg.outcomes.acceptedCount, 1);
  assert.equal(pkg.outcomes.pendingCount, 0);
  assert.deepEqual(pkg.files.map((item) => item.file), [
    "reconciliation-summary.json",
    "reconciliation-ledger.json",
    "reconciliation-report.md",
  ]);
});

test("Stage 5Y reports pending and unexpected outcomes", () => {
  const pkg = buildFixturePackage({
    outcomes: [{
      externalId: "crm-request-0001",
      kind: "booking_request",
      state: "booked",
      localRecord: "booking-request",
    }, {
      externalId: "crm-unknown",
      kind: "booking_request",
      state: "accepted",
      localRecord: "booking-request",
    }],
  });
  assert.equal(pkg.readyForOperatorSignoff, false);
  assert.equal(pkg.outcomes.pendingCount, 1);
  assert.equal(pkg.outcomes.unexpectedOutcomeCount, 1);
  assert.equal(pkg.completeness.allPayloadItemsAccountedFor, false);
});

test("Stage 5Y leak scanner blocks unsafe reconciliation content", () => {
  const leaks = detectReconciliationLeaks([
    "Authorization: Bearer real-token",
    "https://ads.example.invalid/raw",
    "storage_object_path=bucket/raw",
    "patient_full_name=Ivan Demo",
  ].join("\n"));
  assert.deepEqual(leaks, [
    "bearer token",
    "storage path",
    "external url",
    "patient identity",
  ]);
});

test("Stage 5Y CLI dry-run writes reconciliation files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5y-"));
  const result = spawnSync(process.execPath, [
    "scripts/stage5y-external-adapter-reconciliation-package.mjs",
    "--manifest",
    "deploy/self-hosted/integrations/adapter-reconciliation-manifest.stage5y.example.json",
    "--output-dir",
    dir,
    "--now",
    NOW,
    "--dry-run",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  for (const file of [
    "reconciliation-summary.json",
    "reconciliation-ledger.json",
    "reconciliation-report.md",
  ]) {
    assert.equal(existsSync(join(dir, file)), true, file);
  }
  assert.match(readFileSync(join(dir, "reconciliation-report.md"), "utf8"), /readyForOperatorSignoff: yes/);
});

test("Stage 5Y CLI JSON mode returns signoff summary", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5y-json-"));
  const result = spawnSync(process.execPath, [
    "scripts/stage5y-external-adapter-reconciliation-package.mjs",
    "--manifest",
    "deploy/self-hosted/integrations/adapter-reconciliation-manifest.stage5y.example.json",
    "--output-dir",
    dir,
    "--now",
    NOW,
    "--json",
    "--dry-run",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.stage, "5Y");
  assert.equal(parsed.readyForOperatorSignoff, true);
  assert.deepEqual(parsed.files.sort(), [
    "reconciliation-ledger.json",
    "reconciliation-report.md",
    "reconciliation-summary.json",
  ].sort());
});
