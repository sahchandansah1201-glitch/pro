import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildExternalAdapterProductionHandoff,
  detectHandoffLeaks,
  readHandoffManifest,
  validateHandoffManifest,
} from "./stage5z-external-adapter-production-handoff.mjs";
import {
  readPayloadFile,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";
import {
  readStatusSnapshot,
  validateStatusSnapshot,
} from "./stage5v-external-adapter-ops.mjs";
import {
  readIncidentPolicy,
  validateIncidentPolicy,
} from "./stage5w-external-adapter-incident-runbook.mjs";
import {
  buildExternalAdapterAuditBundle,
  readAuditManifest,
  validateAuditManifest,
} from "./stage5x-external-adapter-audit-package.mjs";
import {
  buildExternalAdapterReconciliationPackage,
  readReconciliationManifest,
  validateReconciliationManifest,
} from "./stage5y-external-adapter-reconciliation-package.mjs";

const NOW = "2026-05-15T10:45:00.000Z";

function buildFixtureHandoff(reconciliationOverrides = {}) {
  const manifest = validateHandoffManifest(readHandoffManifest());
  const payload = validateExternalAdapterPayload(readPayloadFile(manifest.payloadFile));
  const status = validateStatusSnapshot(readStatusSnapshot(manifest.statusFile));
  const policy = validateIncidentPolicy(readIncidentPolicy(manifest.policyFile));
  const auditManifest = validateAuditManifest(readAuditManifest(manifest.auditManifestFile));
  const auditBundle = buildExternalAdapterAuditBundle({
    manifest: auditManifest,
    payload,
    status,
    policy: validateIncidentPolicy(readIncidentPolicy(auditManifest.policyFile)),
    now: auditManifest.generatedAt,
  });
  const reconciliationManifest = validateReconciliationManifest({
    ...readReconciliationManifest(manifest.reconciliationManifestFile),
    ...reconciliationOverrides,
  });
  const reconciliationPackage = buildExternalAdapterReconciliationPackage({
    manifest: reconciliationManifest,
    payload,
    status,
    auditManifest,
    auditBundle,
    now: reconciliationManifest.generatedAt,
  });
  return buildExternalAdapterProductionHandoff({
    manifest,
    payload,
    status,
    policy,
    auditManifest,
    auditBundle,
    reconciliationManifest,
    reconciliationPackage,
    now: NOW,
  });
}

test("Stage 5Z validates bundled production handoff manifest", () => {
  const manifest = validateHandoffManifest(readHandoffManifest());
  assert.equal(manifest.sourceSystem, "clinic_crm");
  assert.equal(manifest.productRuntimeCallsExternalSystems, false);
  assert.equal(manifest.managedRuntimeDependency, "none");
  assert.equal(manifest.requiredPackages.includes("reconciliation-package"), true);
  assert.equal(manifest.operatorSignoff.checklist.length, 5);
});

test("Stage 5Z builds green production handoff from Stage 5U-5Y evidence", () => {
  const handoff = buildFixtureHandoff();
  assert.equal(handoff.stage, "5Z");
  assert.equal(handoff.readyForProductionHandoff, true);
  assert.equal(handoff.packages.deliveryPack.ok, true);
  assert.equal(handoff.packages.operationsReport.ok, true);
  assert.equal(handoff.packages.incidentRunbook.ok, true);
  assert.equal(handoff.packages.auditPackage.ok, true);
  assert.equal(handoff.packages.reconciliationPackage.ok, true);
  assert.deepEqual(handoff.files.map((item) => item.file), [
    "handoff-summary.json",
    "handoff-checklist.json",
    "handoff-summary.md",
  ]);
});

test("Stage 5Z blocks handoff when reconciliation is not signed off", () => {
  const handoff = buildFixtureHandoff({
    outcomes: [{
      externalId: "crm-request-0001",
      kind: "booking_request",
      state: "booked",
      localRecord: "booking-request",
    }],
  });
  assert.equal(handoff.readyForProductionHandoff, false);
  assert.equal(handoff.packages.reconciliationPackage.ok, false);
});

test("Stage 5Z leak scanner blocks unsafe handoff content", () => {
  const leaks = detectHandoffLeaks([
    "Authorization: Bearer real-token",
    "https://crm.example.invalid/raw",
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

test("Stage 5Z CLI dry-run writes production handoff files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5z-"));
  const result = spawnSync(process.execPath, [
    "scripts/stage5z-external-adapter-production-handoff.mjs",
    "--manifest",
    "deploy/self-hosted/integrations/adapter-handoff-manifest.stage5z.example.json",
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
    "handoff-summary.json",
    "handoff-checklist.json",
    "handoff-summary.md",
  ]) {
    assert.equal(existsSync(join(dir, file)), true, file);
  }
  assert.match(readFileSync(join(dir, "handoff-summary.md"), "utf8"), /readyForProductionHandoff: yes/);
});

test("Stage 5Z CLI JSON mode returns handoff readiness summary", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5z-json-"));
  const result = spawnSync(process.execPath, [
    "scripts/stage5z-external-adapter-production-handoff.mjs",
    "--manifest",
    "deploy/self-hosted/integrations/adapter-handoff-manifest.stage5z.example.json",
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
  assert.equal(parsed.stage, "5Z");
  assert.equal(parsed.readyForProductionHandoff, true);
  assert.deepEqual(parsed.files.sort(), [
    "handoff-checklist.json",
    "handoff-summary.json",
    "handoff-summary.md",
  ].sort());
});
