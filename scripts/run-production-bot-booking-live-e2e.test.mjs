import assert from "node:assert/strict";
import { test } from "node:test";

import { deployStatusBlocksLiveE2E } from "./run-production-admin-management-live-e2e.mjs";
import {
  parseLiveBotBookingE2EArgs,
  runLiveBotBookingE2E,
} from "./run-production-bot-booking-live-e2e.mjs";
import { CREATE_TEST_CLINIC_CONFIRMATION } from "./stage4m-admin-management-api-smoke.mjs";

test("live bot booking e2e parser requires explicit production mutation confirmation", () => {
  const missing = parseLiveBotBookingE2EArgs([
    "--base-url",
    "https://pro.example.test",
  ], {});

  assert.ok(missing.errors.some((error) => error.includes(CREATE_TEST_CLINIC_CONFIRMATION)));

  const confirmed = parseLiveBotBookingE2EArgs([
    "--base-url",
    "https://pro.example.test",
    "--confirm-create-test-clinic",
    CREATE_TEST_CLINIC_CONFIRMATION,
  ], {});

  assert.deepEqual(confirmed.errors, []);
  assert.equal(confirmed.baseUrl, "https://pro.example.test");
});

test("live bot booking e2e blocks when Stage 4M deployment is still running", () => {
  const blocker = deployStatusBlocksLiveE2E({
    deployStatusFile: "/tmp/status.json",
    exists: () => true,
    readFile: () => JSON.stringify({ status: "running", runId: "run-bot-booking-001" }),
  });

  assert.match(blocker, /deployment is still running.*run-bot-booking-001/);
});

test("live bot booking e2e runner spawns Playwright when deploy is ready", () => {
  const calls = [];
  const code = runLiveBotBookingE2E([
    "--base-url",
    "https://pro.example.test",
    "--ignore-deploy-status",
    "--confirm-create-test-clinic",
    CREATE_TEST_CLINIC_CONFIRMATION,
  ], {
    cwd: process.cwd(),
    spawn(cmd, args, options) {
      calls.push({ cmd, args, env: options.env });
      return { status: 0 };
    },
  });

  assert.equal(code, 0);
  assert.equal(calls.length, 1);
  assert.match(calls[0].cmd, /npx/);
  assert.ok(calls[0].args.includes("e2e/production-bot-booking-live.pw.ts"));
  assert.equal(calls[0].env.STAGE4M_LIVE_BOT_BOOKING_BASE_URL, "https://pro.example.test");
});
