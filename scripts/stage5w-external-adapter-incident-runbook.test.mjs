import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  Stage5WIncidentError,
  buildAdapterControlManifest,
  classifyExternalAdapterIncident,
  readIncidentPolicy,
  renderIncidentRunbookMarkdown,
  validateIncidentPolicy,
} from "./stage5w-external-adapter-incident-runbook.mjs";
import { validateExternalAdapterPayload } from "./stage5u-external-adapter-pack.mjs";
import { validateStatusSnapshot } from "./stage5v-external-adapter-ops.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const NOW = "2026-05-15T10:00:00.000Z";

const payload = validateExternalAdapterPayload({
  clinicId: CLINIC_ID,
  sourceSystem: "clinic_crm",
  sourceReference: "safe-export",
  idempotencyKey: "safe-export-1",
  items: [{
    kind: "booking_request",
    externalId: "request-1",
    patientCode: "DP-2026-0001",
    preferredFrom: "2026-06-01T09:00:00.000Z",
  }],
});

const status = validateStatusSnapshot({
  sourceSystem: "clinic_crm",
  recentBatchCount: 2,
  rejectedLast24h: 0,
  duplicateLast24h: 1,
  openBookingRequestCount: 3,
  availableSlotCount: 4,
  storedRawPayload: false,
  runtimeCallsExternalSystems: false,
  hardeningVersion: "stage5t",
  latestBySource: [{ sourceSystem: "clinic_crm", lastImportedAt: "2026-05-15T09:00:00.000Z" }],
});

const policy = validateIncidentPolicy({
  sourceSystem: "clinic_crm",
  rejectedItemLimit: 0,
  duplicateItemLimit: 20,
  staleAfterMinutes: 180,
  pauseOnRejectedItems: true,
  pauseOnStaleImport: true,
  controlFilePath: "var/self-hosted/integrations/clinic-crm.adapter-control.json",
  escalation: { owner: "operator-desk", handoff: "clinic-admin", requiredEvidence: ["stage5v-operator-report"] },
});

test("Stage 5W validates bundled incident policy", () => {
  const bundled = validateIncidentPolicy(readIncidentPolicy());
  assert.equal(bundled.sourceSystem, "clinic_crm");
  assert.equal(bundled.controlFilePath.startsWith("var/self-hosted/integrations/"), true);
});

test("Stage 5W classifies healthy adapter state as running", () => {
  const classification = classifyExternalAdapterIncident({ payload, status, policy, now: NOW });
  assert.equal(classification.stage, "5W");
  assert.equal(classification.severity, "ok");
  assert.equal(classification.stateRecommendation, "running");
  assert.equal(classification.latestImportAgeMinutes, 60);
  assert.equal(classification.productRuntimeCallsExternalSystems, false);
});

test("Stage 5W recommends pause for rejected items and stale imports", () => {
  const incident = classifyExternalAdapterIncident({
    payload,
    policy,
    now: NOW,
    status: validateStatusSnapshot({
      ...status,
      rejectedLast24h: 3,
      latestBySource: [{ lastImportedAt: "2026-05-15T05:00:00.000Z" }],
    }),
  });
  assert.equal(incident.severity, "critical");
  assert.equal(incident.stateRecommendation, "paused");
  assert.deepEqual(incident.reasons.map((reason) => reason.code), ["rejected_items", "stale_import"]);
});

test("Stage 5W treats duplicate spikes as warning without mandatory pause", () => {
  const incident = classifyExternalAdapterIncident({
    payload,
    policy,
    now: NOW,
    status: validateStatusSnapshot({ ...status, duplicateLast24h: 40 }),
  });
  assert.equal(incident.severity, "warning");
  assert.equal(incident.stateRecommendation, "running");
  assert.deepEqual(incident.reasons.map((reason) => reason.code), ["duplicate_spike"]);
});

test("Stage 5W rejects unsafe policy fields", () => {
  for (const unsafe of [
    { ...policy, controlFilePath: "tmp/adapter-control.json" },
    { ...policy, escalation: { owner: "https://crm.example.invalid" } },
    { ...policy, escalation: { owner: "access_token=secret" } },
  ]) {
    assert.throws(() => validateIncidentPolicy(unsafe), Stage5WIncidentError);
  }
});

test("Stage 5W renders incident runbook without raw secrets", () => {
  const classification = classifyExternalAdapterIncident({ payload, status, policy, now: NOW });
  const out = renderIncidentRunbookMarkdown(classification);
  assert.match(out, /Stage 5W external adapter incident runbook/);
  assert.match(out, /Pause\/resume protocol/);
  assert.match(out, /adapter-control manifest/);
  assert.doesNotMatch(out, /access_token|storage_object_path|signed_url|crm.example/);
});

test("Stage 5W builds local adapter-control manifest", () => {
  const classification = classifyExternalAdapterIncident({ payload, status, policy, now: NOW });
  const manifest = buildAdapterControlManifest(classification);
  assert.equal(manifest.state, "running");
  assert.equal(manifest.operatorOwnedAdapter, true);
  assert.equal(manifest.productRuntimeCallsExternalSystems, false);
});

test("Stage 5W CLI dry-run writes report and control manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5w-"));
  const input = join(dir, "payload.json");
  const statusFile = join(dir, "status.json");
  const policyFile = join(dir, "policy.json");
  const output = join(dir, "incident.md");
  const controlOutput = join(dir, "control.json");

  writeFileSync(input, JSON.stringify({
    clinicId: CLINIC_ID,
    sourceSystem: "clinic_crm",
    items: [{
      kind: "booking_request",
      externalId: "request-1",
      patientCode: "DP-2026-0001",
      preferredFrom: "2026-06-01T09:00:00.000Z",
    }],
  }, null, 2));
  writeFileSync(statusFile, JSON.stringify(status, null, 2));
  writeFileSync(policyFile, JSON.stringify(policy, null, 2));

  const result = spawnSync(process.execPath, [
    "scripts/stage5w-external-adapter-incident-runbook.mjs",
    "--input",
    input,
    "--status-file",
    statusFile,
    "--policy-file",
    policyFile,
    "--now",
    NOW,
    "--output",
    output,
    "--control-output",
    controlOutput,
    "--dry-run",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(output), true);
  assert.equal(existsSync(controlOutput), true);
  assert.match(readFileSync(output, "utf8"), /Severity: `ok`/);
  assert.equal(JSON.parse(readFileSync(controlOutput, "utf8")).state, "running");
});
