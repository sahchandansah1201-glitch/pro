import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  parseLiveRds3E2EArgs,
  runLiveRds3E2E,
  validateRds3Receipt,
} from "./run-production-rds3-import-live-e2e.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000421";
const ASSET_ID = "10000000-0000-4000-8000-000000000921";

function receipt() {
  return {
    schemaVersion: 1,
    status: "imported",
    assetId: ASSET_ID,
    checksumSha256: "a".repeat(64),
    correlationId: "rds3-test-correlation",
    captureSource: "device_bridge",
    importedAt: "2026-07-10T10:00:00.000Z",
  };
}

test("live RDS-3 parser requires read-only acceptance inputs", () => {
  const parsed = parseLiveRds3E2EArgs([
    "--base-url", "https://pro.example.test",
    "--doctor-credentials-file", "/tmp/doctor.txt",
    "--assistant-credentials-file", "/tmp/assistant.txt",
    "--receipt-file", "/tmp/receipt.json",
    "--visit-id", VISIT_ID,
  ], {});
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.visitId, VISIT_ID);
  assert.equal(parsed.doctorCredentialsFile, "/tmp/doctor.txt");
  assert.equal(parsed.assistantCredentialsFile, "/tmp/assistant.txt");
});

test("live RDS-3 receipt rejects protected fields", () => {
  assert.equal(validateRds3Receipt(receipt()).assetId, ASSET_ID);
  assert.throws(
    () => validateRds3Receipt({ ...receipt(), visitId: VISIT_ID }),
    /forbidden protected field/,
  );
});

test("live RDS-3 runner spawns the read-only Playwright journey", () => {
  const dir = mkdtempSync(join(tmpdir(), "rds3-live-runner-"));
  try {
    const doctorCredentialsFile = join(dir, "doctor-credentials.txt");
    const assistantCredentialsFile = join(dir, "assistant-credentials.txt");
    const receiptFile = join(dir, "receipt.json");
    writeFileSync(doctorCredentialsFile, "Email: doctor@example.test\nPassword: local-test-password\n");
    writeFileSync(assistantCredentialsFile, "Email: assistant@example.test\nPassword: local-test-password\n");
    writeFileSync(receiptFile, JSON.stringify(receipt()));
    const calls = [];
    const code = runLiveRds3E2E([
      "--base-url", "https://pro.example.test",
      "--doctor-credentials-file", doctorCredentialsFile,
      "--assistant-credentials-file", assistantCredentialsFile,
      "--receipt-file", receiptFile,
      "--visit-id", VISIT_ID,
      "--ignore-deploy-status",
    ], {
      cwd: process.cwd(),
      spawn(cmd, args, options) {
        calls.push({ cmd, args, env: options.env });
        return { status: 0 };
      },
    });
    assert.equal(code, 0);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].args.includes("e2e/production-rds3-import-live.pw.ts"));
    assert.equal(calls[0].env.STAGE4M_RDS3_VISIT_ID, VISIT_ID);
    assert.equal(calls[0].env.STAGE4M_RDS3_RECEIPT_FILE, receiptFile);
    assert.equal(calls[0].env.STAGE4M_RDS3_DOCTOR_CREDENTIALS_FILE, doctorCredentialsFile);
    assert.equal(calls[0].env.STAGE4M_RDS3_ASSISTANT_CREDENTIALS_FILE, assistantCredentialsFile);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
