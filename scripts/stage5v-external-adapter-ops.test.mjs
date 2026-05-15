import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  Stage5VOpsError,
  buildExternalAdapterOpsReport,
  readStatusSnapshot,
  renderExternalAdapterOpsMarkdown,
  validateStatusSnapshot,
} from "./stage5v-external-adapter-ops.mjs";
import { validateExternalAdapterPayload } from "./stage5u-external-adapter-pack.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";

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

const status = {
  sourceSystem: "clinic_crm",
  recentBatchCount: 2,
  rejectedLast24h: 0,
  duplicateLast24h: 1,
  openBookingRequestCount: 3,
  availableSlotCount: 4,
  storedRawPayload: false,
  runtimeCallsExternalSystems: false,
  hardeningVersion: "stage5t",
  latestBySource: [],
};

test("Stage 5V validates safe status snapshots", () => {
  const validated = validateStatusSnapshot(status);
  assert.equal(validated.recentBatchCount, 2);
  assert.equal(validated.storedRawPayload, false);
  assert.equal(validated.runtimeCallsExternalSystems, false);
});

test("Stage 5V rejects unsafe or non-hardened status snapshots", () => {
  for (const unsafe of [
    { ...status, storedRawPayload: true },
    { ...status, runtimeCallsExternalSystems: true },
    { ...status, hardeningVersion: "stage5q" },
    { ...status, latestBySource: [{ note: "https://crm.example.invalid" }] },
  ]) {
    assert.throws(() => validateStatusSnapshot(unsafe), Stage5VOpsError);
  }
});

test("Stage 5V builds operator report gates and warnings", () => {
  const report = buildExternalAdapterOpsReport({ payload, status });
  assert.equal(report.stage, "5V");
  assert.equal(report.gates.readyForOperatorReview, true);
  assert.equal(report.warnings.length, 0);

  const warning = buildExternalAdapterOpsReport({
    payload,
    status: validateStatusSnapshot({ ...status, duplicateLast24h: 21 }),
  });
  assert.equal(warning.gates.readyForOperatorReview, false);
  assert.match(warning.warnings[0], /Duplicate items/);
});

test("Stage 5V renders markdown without raw secrets or external runtime data", () => {
  const report = buildExternalAdapterOpsReport({ payload, status });
  const out = renderExternalAdapterOpsMarkdown(report);
  assert.match(out, /Stage 5V external adapter operations report/);
  assert.match(out, /Operator checklist/);
  assert.match(out, /Runtime calls to CRM\/ad systems: false/);
  assert.doesNotMatch(out, /access_token|storage_object_path|signed_url|crm.example/);
});

test("Stage 5V reads bundled status snapshot", () => {
  const bundled = validateStatusSnapshot(readStatusSnapshot());
  assert.equal(bundled.hardeningVersion, "stage5t");
});

test("Stage 5V CLI dry-run writes a local report file", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5v-"));
  const input = join(dir, "payload.json");
  const statusFile = join(dir, "status.json");
  const output = join(dir, "report.md");
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

  const result = spawnSync(process.execPath, [
    "scripts/stage5v-external-adapter-ops.mjs",
    "--input",
    input,
    "--status-file",
    statusFile,
    "--output",
    output,
    "--dry-run",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(output), true);
  assert.match(readFileSync(output, "utf8"), /Ready for operator review: yes/);
});
