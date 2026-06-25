import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseLiveAdminE2EArgs,
  runLiveAdminE2E,
} from "./run-production-admin-management-live-e2e.mjs";
import { CREATE_TEST_CLINIC_CONFIRMATION } from "./stage4m-admin-management-api-smoke.mjs";

test("live admin e2e parser requires explicit production mutation confirmation", () => {
  const missing = parseLiveAdminE2EArgs([
    "--base-url",
    "https://pro.example.test",
    "--credentials-file",
    "/root/credentials.txt",
  ], {});

  assert.ok(missing.errors.some((error) => error.includes(CREATE_TEST_CLINIC_CONFIRMATION)));

  const confirmed = parseLiveAdminE2EArgs([
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

test("live admin e2e runner refuses to start when credentials file is missing", () => {
  const code = runLiveAdminE2E([
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
