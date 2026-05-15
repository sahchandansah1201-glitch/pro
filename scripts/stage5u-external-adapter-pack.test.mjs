import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  Stage5UValidationError,
  buildExternalAdapterCurl,
  readPayloadFile,
  renderExternalAdapterDryRun,
  summarizeExternalAdapterPayload,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000101";

const validPayload = {
  clinicId: CLINIC_ID,
  sourceSystem: "clinic_crm",
  sourceReference: "clinic-crm-safe-export",
  idempotencyKey: "clinic-crm-2026-05-15T0900Z",
  items: [
    {
      kind: "booking_request",
      externalId: "crm-request-0001",
      patientCode: "DP-2026-0001",
      preferredFrom: "2026-06-01T09:00:00.000Z",
      preferredTo: "2026-06-01T10:00:00.000Z",
    },
    {
      kind: "available_slot",
      externalId: "crm-slot-0001",
      doctorUserId: DOCTOR_ID,
      startedAt: "2026-06-01T11:00:00.000Z",
      durationMinutes: 30,
    },
  ],
};

test("Stage 5U validates the example payload and summarizes sanitized counts", () => {
  const payload = validateExternalAdapterPayload(validPayload);
  const summary = summarizeExternalAdapterPayload(payload);
  assert.equal(summary.stage, "5U");
  assert.equal(summary.endpoint, "/api/v1/integrations/booking-imports");
  assert.equal(summary.itemCount, 2);
  assert.equal(summary.bookingRequestCount, 1);
  assert.equal(summary.availableSlotCount, 1);
  assert.equal(summary.storedRawPayload, false);
  assert.equal(summary.runtimeCallsExternalSystems, false);
});

test("Stage 5U rejects raw URLs, tokens, storage paths, and managed-runtime markers", () => {
  for (const unsafe of [
    "https://crm.example.invalid/export",
    "Authorization: Bearer secret",
    "access_token=secret",
    "storage_object_path=bucket/key",
    "signed_url=something",
    "api-read",
    "api-write",
    "edge function",
    "SUPABASE_URL",
  ]) {
    assert.throws(
      () => validateExternalAdapterPayload({
        ...validPayload,
        sourceReference: unsafe,
      }),
      (error) => {
        assert.ok(error instanceof Stage5UValidationError);
        assert.match(JSON.stringify(error.details), /Raw external URLs/);
        return true;
      },
    );
  }
});

test("Stage 5U rejects invalid source, missing items, dates, and duration", () => {
  assert.throws(
    () => validateExternalAdapterPayload({ sourceSystem: "remote_crm", items: [] }),
    Stage5UValidationError,
  );
  assert.throws(
    () => validateExternalAdapterPayload({
      clinicId: CLINIC_ID,
      sourceSystem: "clinic_crm",
      items: [{
        kind: "available_slot",
        externalId: "slot-1",
        startedAt: "not-a-date",
        durationMinutes: 2,
      }],
    }),
    Stage5UValidationError,
  );
});

test("Stage 5U dry-run renders local curl guidance without making network calls", () => {
  const payload = validateExternalAdapterPayload(validPayload);
  const out = renderExternalAdapterDryRun({
    payload,
    apiBaseUrl: "http://localhost:8080",
    payloadPath: "payload.json",
  });
  assert.match(out, /dry-run only; no network calls were made/);
  assert.match(out, /\/api\/v1\/integrations\/booking-imports/);
  assert.match(out, /curl -X POST/);
  assert.match(out, /SELF_HOSTED_BEARER_TOKEN/);
  assert.doesNotMatch(out, /secret|access_token|storage_object_path|signed_url/);
});

test("Stage 5U builds a copyable local curl command", () => {
  const out = buildExternalAdapterCurl({
    apiBaseUrl: "http://localhost:8080/",
    payloadPath: "deploy/self-hosted/integrations/booking-import.stage5u.example.json",
  });
  assert.match(out, /^curl -X POST/);
  assert.match(out, /http:\/\/localhost:8080\/api\/v1\/integrations\/booking-imports/);
  assert.match(out, /--data-binary/);
});

test("Stage 5U CLI dry-run exits 0 for a valid local file", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5u-"));
  const input = join(dir, "payload.json");
  writeFileSync(input, JSON.stringify(validPayload, null, 2));
  const result = spawnSync(process.execPath, [
    "scripts/stage5u-external-adapter-pack.mjs",
    "--input",
    input,
    "--dry-run",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 5U external adapter delivery pack/);
  assert.match(result.stdout, /Runtime calls to CRM\/ad systems: false/);
});

test("Stage 5U reads JSON payload files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5u-json-"));
  const input = join(dir, "payload.json");
  writeFileSync(input, JSON.stringify(validPayload));
  assert.equal(readPayloadFile(input).sourceSystem, "clinic_crm");
});
