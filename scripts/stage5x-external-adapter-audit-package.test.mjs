import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildExternalAdapterAuditBundle,
  detectAuditBundleLeaks,
  readAuditManifest,
  validateAuditManifest,
} from "./stage5x-external-adapter-audit-package.mjs";
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

const NOW = "2026-05-15T10:15:00.000Z";

function buildFixtureBundle() {
  const manifest = validateAuditManifest(readAuditManifest());
  const payload = validateExternalAdapterPayload(readPayloadFile(manifest.payloadFile));
  const status = validateStatusSnapshot(readStatusSnapshot(manifest.statusFile));
  const policy = validateIncidentPolicy(readIncidentPolicy(manifest.policyFile));
  return buildExternalAdapterAuditBundle({ manifest, payload, status, policy, now: NOW });
}

test("Stage 5X validates bundled audit manifest", () => {
  const manifest = validateAuditManifest(readAuditManifest());
  assert.equal(manifest.sourceSystem, "clinic_crm");
  assert.equal(manifest.productRuntimeCallsExternalSystems, false);
  assert.equal(manifest.managedRuntimeDependency, "none");
  assert.equal(manifest.requiredEvidence.includes("incident-runbook"), true);
});

test("Stage 5X builds a complete six-file audit bundle", () => {
  const bundle = buildFixtureBundle();
  assert.equal(bundle.stage, "5X");
  assert.equal(bundle.evidenceFiles.length, 5);
  assert.equal(bundle.indexFile.file, "audit-index.md");
  assert.equal(bundle.gates.evidenceComplete, true);
  assert.equal(bundle.gates.noLeaksDetected, true);
  assert.deepEqual(bundle.completeness.map((item) => item.present), [true, true, true, true, true]);
});

test("Stage 5X leak scanner blocks unsafe audit content", () => {
  const unsafe = [
    "Authorization: Bearer real-token",
    "https://crm.example.invalid/raw",
    "storage_object_path=bucket/raw",
    "patient_full_name=Ivan Demo",
  ].join("\n");
  assert.deepEqual(detectAuditBundleLeaks(unsafe), [
    "bearer-token",
    "storage-path",
    "external-url",
    "patient-identity",
  ]);
  assert.deepEqual(detectAuditBundleLeaks("Authorization: Bearer <SELF_HOSTED_BEARER_TOKEN>\nhttp://localhost:8080"), []);
});

test("Stage 5X CLI dry-run writes the complete local bundle", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5x-"));
  const result = spawnSync(process.execPath, [
    "scripts/stage5x-external-adapter-audit-package.mjs",
    "--manifest",
    "deploy/self-hosted/integrations/adapter-audit-manifest.stage5x.example.json",
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
    "payload-summary.json",
    "status-snapshot.json",
    "ops-report.md",
    "incident-runbook.md",
    "adapter-control-manifest.json",
    "audit-index.md",
  ]) {
    assert.equal(existsSync(join(dir, file)), true, file);
  }
  assert.match(readFileSync(join(dir, "audit-index.md"), "utf8"), /Stage 5X external adapter audit package/);
});

test("Stage 5X CLI JSON mode returns sanitized gate summary", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5x-json-"));
  const result = spawnSync(process.execPath, [
    "scripts/stage5x-external-adapter-audit-package.mjs",
    "--manifest",
    "deploy/self-hosted/integrations/adapter-audit-manifest.stage5x.example.json",
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
  assert.equal(parsed.stage, "5X");
  assert.equal(parsed.gates.noLeaksDetected, true);
  assert.deepEqual(parsed.evidenceFiles.sort(), [
    "adapter-control-manifest.json",
    "audit-index.md",
    "incident-runbook.md",
    "ops-report.md",
    "payload-summary.json",
    "status-snapshot.json",
  ].sort());
});
