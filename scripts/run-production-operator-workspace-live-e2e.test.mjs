import assert from "node:assert/strict";
import { test } from "node:test";

import { deployStatusBlocksLiveE2E } from "./run-production-admin-management-live-e2e.mjs";
import {
  parseLiveOperatorE2EArgs,
  runLiveOperatorE2E,
} from "./run-production-operator-workspace-live-e2e.mjs";
import { CREATE_TEST_CLINIC_CONFIRMATION } from "./stage4m-admin-management-api-smoke.mjs";

test("live operator e2e parser requires explicit production mutation confirmation", () => {
  const missing = parseLiveOperatorE2EArgs([
    "--base-url",
    "https://pro.example.test",
    "--credentials-file",
    "/root/credentials.txt",
  ], {});

  assert.ok(missing.errors.some((error) => error.includes(CREATE_TEST_CLINIC_CONFIRMATION)));

  const confirmed = parseLiveOperatorE2EArgs([
    "--base-url",
    "https://pro.example.test",
    "--credentials-file",
    "/root/credentials.txt",
    "--confirm-create-test-clinic",
    CREATE_TEST_CLINIC_CONFIRMATION,
  ], {});

  assert.deepEqual(confirmed.errors, []);
  assert.equal(confirmed.baseUrl, "https://pro.example.test");
  assert.equal(confirmed.credentialsFile, "/root/credentials.txt");
});

test("live operator e2e runner refuses to start when credentials file is missing", () => {
  const code = runLiveOperatorE2E([
    "--base-url",
    "https://pro.example.test",
    "--credentials-file",
    "/definitely/missing/credentials.txt",
    "--confirm-create-test-clinic",
    CREATE_TEST_CLINIC_CONFIRMATION,
  ], {
    cwd: process.cwd(),
    spawn: () => {
      throw new Error("spawn must not be called without credentials file");
    },
  });

  assert.equal(code, 2);
});

test("live operator e2e blocks when Stage 4M deployment is still running", () => {
  const blocker = deployStatusBlocksLiveE2E({
    deployStatusFile: "/tmp/status.json",
    exists: () => true,
    readFile: () => JSON.stringify({ status: "running", runId: "run-operator-001" }),
  });

  assert.match(blocker, /deployment is still running.*run-operator-001/);
});
