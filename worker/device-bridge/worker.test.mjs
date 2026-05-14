import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  createDeviceBridgeWorkerClient,
  parseDeviceBridgeWorkerArgs,
  redactWorkerText,
  renderDeviceBridgeWorkerDryRun,
  runDeviceBridgeWorkerOnce,
  validateDeviceBridgeWorkerConfig,
} from "./worker.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "worker.mjs");
const BASE_CONFIG = {
  baseUrl: "http://127.0.0.1:3001",
  token: "stage4t-worker-token",
  clinicId: "10000000-0000-4000-8000-000000000001",
  bridgeCode: "br-live-01",
  hostName: "bridge-host",
  version: "stage4t-test",
  lanStatus: "online",
  limit: 10,
  intervalMs: 1000,
  mode: "once",
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("parses config from args/env and dry-run redacts worker token", () => {
  const config = parseDeviceBridgeWorkerArgs(
    ["--dry-run", "--base-url", "http://backend:3001/", "--limit", "3"],
    {
      DEVICE_BRIDGE_WORKER_TOKEN: "stage4t-worker-token",
      DEVICE_BRIDGE_CLINIC_ID: BASE_CONFIG.clinicId,
      DEVICE_BRIDGE_CODE: "br-live-01",
    },
  );
  const dryRun = renderDeviceBridgeWorkerDryRun(config);

  assert.equal(config.baseUrl, "http://backend:3001");
  assert.equal(config.limit, 3);
  assert.equal(config.dryRun, true);
  assert.match(dryRun, /POST \/api\/v1\/device-bridge-worker\/heartbeat/);
  assert.doesNotMatch(dryRun, /stage4t-worker-token/);
  assert.match(redactWorkerText("Bearer stage4t-worker-token"), /Bearer \[redacted\]/);
});

test("validates required runtime config", () => {
  assert.equal(validateDeviceBridgeWorkerConfig(BASE_CONFIG), true);
  assert.throws(
    () => validateDeviceBridgeWorkerConfig({ ...BASE_CONFIG, token: "short" }),
    /configuration is invalid/,
  );
});

test("client calls Stage 4S endpoints with bearer token", async () => {
  const calls = [];
  const client = createDeviceBridgeWorkerClient({
    baseUrl: BASE_CONFIG.baseUrl,
    token: BASE_CONFIG.token,
    async fetchImpl(url, init) {
      calls.push({ url, init });
      if (url.endsWith("/heartbeat")) return jsonResponse({ ok: true });
      if (url.includes("/commands?")) return jsonResponse({ items: [] });
      return jsonResponse({ command: { id: "cmd-1", status: "completed" } });
    },
  });

  await client.heartbeat(BASE_CONFIG);
  await client.listCommands(BASE_CONFIG);
  await client.updateCommand(BASE_CONFIG, "10000000-0000-4000-8000-000000000901", "completed", "done");

  assert.equal(calls.length, 3);
  assert.equal(calls[0].init.method, "POST");
  assert.match(calls[0].init.headers.authorization, /^Bearer /);
  assert.ok(calls[1].url.includes("clinicId=10000000-0000-4000-8000-000000000001"));
  assert.ok(calls[2].url.endsWith("/api/v1/device-bridge-worker/commands/10000000-0000-4000-8000-000000000901"));
});

test("run once heartbeats, polls, acknowledges, and records completed/failed results", async () => {
  const events = [];
  const client = {
    async heartbeat() {
      events.push("heartbeat");
      return {};
    },
    async listCommands() {
      events.push("poll");
      return {
        items: [
          { id: "cmd-health", commandType: "bridge_health_check" },
          { id: "cmd-calibration", commandType: "device_calibration_request" },
        ],
      };
    },
    async updateCommand(_config, commandId, status) {
      events.push(`${commandId}:${status}`);
      return {};
    },
  };

  const summary = await runDeviceBridgeWorkerOnce({ config: BASE_CONFIG, client });

  assert.deepEqual(events, [
    "heartbeat",
    "poll",
    "cmd-health:acknowledged",
    "cmd-health:completed",
    "cmd-calibration:acknowledged",
    "cmd-calibration:failed",
  ]);
  assert.equal(summary.polled, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.failed, 1);
});

test("cli dry-run exits 0 without leaking env token", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
    env: {
      ...process.env,
      SELF_HOSTED_API_BASE_URL: "http://127.0.0.1:3001",
      DEVICE_BRIDGE_WORKER_TOKEN: "stage4t-worker-token",
      DEVICE_BRIDGE_CLINIC_ID: BASE_CONFIG.clinicId,
      DEVICE_BRIDGE_CODE: BASE_CONFIG.bridgeCode,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[device-bridge-worker\] dry run/);
  assert.doesNotMatch(result.stdout, /stage4t-worker-token/);
});
