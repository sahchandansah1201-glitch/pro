import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage8A8CAdapterError,
  buildStage5QImportPayloadFromCrmExport,
  buildStage8A8CCrmAdapterPlan,
  normalizeCrmInboundRecords,
  renderStage8A8CCrmInboundAdapterDryRun,
} from "./stage8a-8c-crm-inbound-adapter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCRIPT = join(__dirname, "stage8a-8c-crm-inbound-adapter.mjs");
const EXPORT_PATH = join(ROOT, "deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json");
const MAPPING_PATH = join(ROOT, "deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json");
const EXPECTED_PAYLOAD_PATH = join(ROOT, "deploy/self-hosted/integrations/booking-import.stage8b.example.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("Stage 8A-8C maps safe CRM records to the Stage 5Q payload", () => {
  const exportData = readJson(EXPORT_PATH);
  const mapping = readJson(MAPPING_PATH);
  const expected = readJson(EXPECTED_PAYLOAD_PATH);
  const { payload, audit } = buildStage5QImportPayloadFromCrmExport(exportData, mapping);

  assert.deepEqual(payload, expected);
  assert.equal(audit.recordCount, 2);
  assert.equal(audit.acceptedCount, 2);
  assert.equal(audit.rejectedCount, 0);
  assert.equal(audit.bookingRequestCount, 1);
  assert.equal(audit.availableSlotCount, 1);
  assert.equal(audit.storedRawExternalPayload, false);
  assert.equal(audit.networkCallsExternalSystems, false);
  assert.equal(audit.managedRuntimeDependency, "none");
});

test("Stage 8A-8C rejects raw CRM values before normalization", () => {
  const mapping = readJson(MAPPING_PATH);
  assert.throws(
    () =>
      normalizeCrmInboundRecords(
        {
          exportId: "unsafe",
          records: [
            {
              recordType: "booking_request",
              externalId: "unsafe-1",
              patientCode: "DP-2026-0001",
              preferredFrom: "2026-06-04T09:00:00.000Z",
              fullName: "Raw Patient Name",
              sourceUrl: "https://crm.example.invalid/request/unsafe-1",
            },
          ],
        },
        mapping,
      ),
    (error) =>
      error instanceof Stage8A8CAdapterError &&
      error.details.some((detail) => detail.field.includes("fullName")) &&
      error.details.some((detail) => detail.field.includes("sourceUrl")),
  );
});

test("Stage 8A-8C audit report is count-only and redacted", () => {
  const { audit } = buildStage5QImportPayloadFromCrmExport(readJson(EXPORT_PATH), readJson(MAPPING_PATH));
  const report = renderStage8A8CCrmInboundAdapterDryRun({ audit, outputPath: "test-results/out.json" });
  assert.match(report, /Stage 8A-8C CRM inbound adapter/);
  assert.match(report, /Input records: 2/);
  assert.match(report, /Runtime calls to CRM\/ad systems: false/);
  assert.doesNotMatch(report, /DP-2026-0001/);
  assert.doesNotMatch(report, /crm-request-2001/);
  assert.doesNotMatch(report, /Bearer|access_token|signed_url|storage_object_path/i);
});

test("Stage 8A-8C plan exposes the self-hosted boundary", () => {
  const plan = buildStage8A8CCrmAdapterPlan();
  assert.equal(plan.stage, "8A-8C");
  assert.equal(plan.outputContract, "/api/v1/integrations/booking-imports");
  assert.equal(plan.networkCalls, false);
  assert.equal(plan.storesRawExternalPayload, false);
  assert.equal(plan.managedRuntimeDependency, "none");
  assert.equal(plan.managedDatabaseDependency, "none");
});

test("Stage 8A-8C CLI dry-run exits 0 and writes optional outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage8a-8c-"));
  const output = join(dir, "booking-import.json");
  const audit = join(dir, "audit.md");
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT,
      "--input",
      EXPORT_PATH,
      "--mapping",
      MAPPING_PATH,
      "--output",
      output,
      "--audit-output",
      audit,
      "--dry-run",
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 8A-8C CRM inbound adapter/);
  assert.equal(existsSync(output), true);
  assert.equal(existsSync(audit), true);
  assert.deepEqual(readJson(output), readJson(EXPECTED_PAYLOAD_PATH));
  assert.doesNotMatch(readFileSync(audit, "utf8"), /DP-2026-0001|crm-request-2001/);
});

test("Stage 8A-8C CLI rejects unsafe local export files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage8a-unsafe-"));
  const input = join(dir, "unsafe.json");
  writeFileSync(
    input,
    JSON.stringify({
      exportId: "unsafe",
      records: [
        {
          recordType: "booking_request",
          externalId: "unsafe-1",
          patientCode: "DP-2026-0001",
          preferredFrom: "2026-06-04T09:00:00.000Z",
          accessToken: "secret-token",
        },
      ],
    }),
  );
  const result = spawnSync(process.execPath, [SCRIPT, "--input", input, "--mapping", MAPPING_PATH], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe values/i);
  assert.doesNotMatch(result.stderr, /secret-token/);
});
