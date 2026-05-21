import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  Stage8D8FAvailabilitySyncError,
  buildAvailabilitySyncReport,
  normalizeAvailabilitySyncSnapshot,
  renderAvailabilitySyncReport,
} from "./stage8d-8f-availability-sync.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCRIPT = join(__dirname, "stage8d-8f-availability-sync.mjs");
const INPUT_PATH = join(ROOT, "deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json");
const EXPECTED_REPORT_PATH = join(ROOT, "deploy/self-hosted/integrations/availability-sync-report.stage8f.example.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("Stage 8D-8F builds a ready sync report from the safe local snapshot", () => {
  const report = buildAvailabilitySyncReport(readJson(INPUT_PATH));
  assert.deepEqual(report, readJson(EXPECTED_REPORT_PATH));
  assert.equal(report.status, "ready");
  assert.equal(report.counts.confirmationCandidates, 2);
  assert.equal(report.productBoundary.networkCalls, false);
  assert.equal(report.productBoundary.managedRuntimeDependency, "none");
});

test("Stage 8D-8F detects conflicts before confirmation", () => {
  const input = readJson(INPUT_PATH);
  input.availableSlots.push({
    slotRef: "slot-safe-3",
    clinicRef: "clinic-derma-pro",
    doctorRef: "doctor-a",
    sourceSystem: "clinic_crm",
    sourceSlotRef: "source-slot-a",
    startedAt: "2026-06-04T09:40:00.000Z",
    durationMinutes: 30,
    status: "available",
  });
  input.importStatus.duplicateLast24h = 2;
  const report = buildAvailabilitySyncReport(input);
  assert.equal(report.status, "blocked");
  assert.ok(report.conflictSummary.some((issue) => issue.type === "duplicate_source_slots" && issue.severity === "blocking"));
  assert.ok(report.conflictSummary.some((issue) => issue.type === "overlapping_slots" && issue.severity === "blocking"));
  assert.ok(report.conflictSummary.some((issue) => issue.type === "import_duplicates_last_24h" && issue.severity === "warning"));
});

test("Stage 8D-8F rejects unsafe raw snapshot values", () => {
  assert.throws(
    () =>
      normalizeAvailabilitySyncSnapshot({
        snapshotId: "unsafe",
        bookingRequests: [{
          requestRef: "request-safe-1",
          clinicRef: "clinic-derma-pro",
          preferredFrom: "2026-06-04T09:00:00.000Z",
          preferredTo: "2026-06-04T11:00:00.000Z",
          status: "requested",
          fullName: "Raw Patient Name",
          sourceUrl: "https://crm.example.invalid/request/1",
        }],
        availableSlots: [],
      }),
    (error) =>
      error instanceof Stage8D8FAvailabilitySyncError &&
      error.details.some((detail) => detail.field.includes("fullName")) &&
      error.details.some((detail) => detail.field.includes("sourceUrl")),
  );
});

test("Stage 8D-8F report output is safe and count-oriented", () => {
  const report = buildAvailabilitySyncReport(readJson(INPUT_PATH));
  const text = renderAvailabilitySyncReport(report);
  assert.match(text, /Stage 8D-8F Availability Sync/);
  assert.match(text, /Confirmation candidates: 2/);
  assert.doesNotMatch(text, /fullName|email|phone|access_token|signed_url|storage_object_path/i);
});

test("Stage 8D-8F CLI writes JSON and audit outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage8d-8f-"));
  const output = join(dir, "report.json");
  const audit = join(dir, "audit.md");
  const result = spawnSync(
    process.execPath,
    [SCRIPT, "--input", INPUT_PATH, "--output", output, "--audit-output", audit, "--dry-run"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 8D-8F Availability Sync/);
  assert.equal(existsSync(output), true);
  assert.equal(existsSync(audit), true);
  assert.deepEqual(readJson(output), readJson(EXPECTED_REPORT_PATH));
});

test("Stage 8D-8F CLI rejects unsafe snapshots without leaking values", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage8d-unsafe-"));
  const input = join(dir, "unsafe.json");
  writeFileSync(
    input,
    JSON.stringify({
      snapshotId: "unsafe",
      bookingRequests: [{
        requestRef: "request-safe-1",
        clinicRef: "clinic-derma-pro",
        preferredFrom: "2026-06-04T09:00:00.000Z",
        preferredTo: "2026-06-04T11:00:00.000Z",
        status: "requested",
        accessToken: "secret-token",
      }],
      availableSlots: [],
    }),
  );
  const result = spawnSync(process.execPath, [SCRIPT, "--input", input], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe values/i);
  assert.doesNotMatch(result.stderr, /secret-token/);
});
