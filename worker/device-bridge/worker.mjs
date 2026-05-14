#!/usr/bin/env node
// Stage 4T · local Device Bridge worker runtime.
// Runs outside the browser and talks only to the self-hosted backend Stage 4S API.

import { hostname } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_LIMIT = 10;
const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_VERSION = "stage4t-local-worker";
const TOKEN_REDACTION_PATTERN = /(DEVICE_BRIDGE_WORKER_TOKEN=|Bearer\s+)[^\s]+/gi;

export class DeviceBridgeWorkerRuntimeError extends Error {
  constructor(message, { code = "worker_runtime_error", status = 1, details = null } = {}) {
    super(message);
    this.name = "DeviceBridgeWorkerRuntimeError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parsePositiveInt(value, fallback, max = 10_000) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function boolFlag(args, name) {
  return args.includes(name);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  return String(args[index + 1] || "");
}

export function redactWorkerText(value = "") {
  return String(value)
    .replace(TOKEN_REDACTION_PATTERN, "$1[redacted]")
    .replace(/(token|secret|password|cookie)=([^&\s]+)/gi, "$1=[redacted]");
}

export function parseDeviceBridgeWorkerArgs(argv = [], env = process.env) {
  const args = [...argv];
  const mode = boolFlag(args, "--loop") ? "loop" : "once";
  return {
    baseUrl: cleanBaseUrl(optionValue(args, "--base-url") || env.SELF_HOSTED_API_BASE_URL),
    token: optionValue(args, "--token") || env.DEVICE_BRIDGE_WORKER_TOKEN || "",
    clinicId: optionValue(args, "--clinic-id") || env.DEVICE_BRIDGE_CLINIC_ID || "",
    bridgeCode: optionValue(args, "--bridge-code") || env.DEVICE_BRIDGE_CODE || "",
    hostName: optionValue(args, "--host-name") || env.DEVICE_BRIDGE_HOST_NAME || hostname(),
    version: optionValue(args, "--version") || env.DEVICE_BRIDGE_WORKER_VERSION || DEFAULT_VERSION,
    lanStatus: optionValue(args, "--lan-status") || env.DEVICE_BRIDGE_LAN_STATUS || "online",
    limit: parsePositiveInt(optionValue(args, "--limit") || env.DEVICE_BRIDGE_POLL_LIMIT, DEFAULT_LIMIT, 50),
    intervalMs: parsePositiveInt(
      optionValue(args, "--interval-ms") || env.DEVICE_BRIDGE_POLL_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
      60_000,
    ),
    dryRun: boolFlag(args, "--dry-run"),
    mode,
  };
}

export function validateDeviceBridgeWorkerConfig(config = {}) {
  const errors = [];
  if (!config.baseUrl) errors.push("SELF_HOSTED_API_BASE_URL or --base-url is required.");
  if (!config.token || String(config.token).length < 16) {
    errors.push("DEVICE_BRIDGE_WORKER_TOKEN or --token must be at least 16 characters.");
  }
  if (!config.clinicId) errors.push("DEVICE_BRIDGE_CLINIC_ID or --clinic-id is required.");
  if (!config.bridgeCode) errors.push("DEVICE_BRIDGE_CODE or --bridge-code is required.");
  if (errors.length > 0) {
    throw new DeviceBridgeWorkerRuntimeError("Device Bridge worker configuration is invalid.", {
      code: "invalid_worker_config",
      status: 2,
      details: errors,
    });
  }
  return true;
}

export function renderDeviceBridgeWorkerDryRun(config = {}) {
  const lines = [
    "[device-bridge-worker] dry run",
    `- mode: ${config.mode || "once"}`,
    `- baseUrl: ${config.baseUrl || "[missing]"}`,
    `- clinicId: ${config.clinicId || "[missing]"}`,
    `- bridgeCode: ${config.bridgeCode || "[missing]"}`,
    `- hostName: ${config.hostName || "[missing]"}`,
    `- version: ${config.version || DEFAULT_VERSION}`,
    `- poll limit: ${config.limit || DEFAULT_LIMIT}`,
    `- intervalMs: ${config.intervalMs || DEFAULT_INTERVAL_MS}`,
    "- endpoints:",
    "  - POST /api/v1/device-bridge-worker/heartbeat",
    "  - GET /api/v1/device-bridge-worker/commands",
    "  - PATCH /api/v1/device-bridge-worker/commands/{commandId}",
    "- token: [redacted]",
  ];
  return redactWorkerText(lines.join("\n"));
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new DeviceBridgeWorkerRuntimeError("Backend returned non-JSON response.", {
      code: "invalid_backend_response",
      status: response.status || 502,
    });
  }
}

export function createDeviceBridgeWorkerClient({
  baseUrl,
  token,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new DeviceBridgeWorkerRuntimeError("fetch is unavailable in this Node.js runtime.", {
      code: "fetch_unavailable",
      status: 2,
    });
  }
  const root = cleanBaseUrl(baseUrl);
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  async function request(path, { method = "GET", body = null } = {}) {
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const json = await parseJsonResponse(response);
    if (!response.ok) {
      throw new DeviceBridgeWorkerRuntimeError(
        json?.error?.message || `Backend request failed with ${response.status}.`,
        {
          code: json?.error?.code || "backend_request_failed",
          status: response.status,
          details: json?.error?.details || null,
        },
      );
    }
    return json;
  }

  return {
    async heartbeat(config) {
      return request("/api/v1/device-bridge-worker/heartbeat", {
        method: "POST",
        body: {
          clinicId: config.clinicId,
          bridgeCode: config.bridgeCode,
          hostName: config.hostName,
          version: config.version,
          lanStatus: config.lanStatus,
          workerStatus: "online",
          metadata: {
            runtime: "node",
            stage: "4T",
          },
        },
      });
    },

    async listCommands(config) {
      const params = new URLSearchParams({
        clinicId: config.clinicId,
        bridgeCode: config.bridgeCode,
        limit: String(config.limit || DEFAULT_LIMIT),
      });
      return request(`/api/v1/device-bridge-worker/commands?${params.toString()}`);
    },

    async updateCommand(config, commandId, status, message, result = {}) {
      return request(`/api/v1/device-bridge-worker/commands/${encodeURIComponent(commandId)}`, {
        method: "PATCH",
        body: {
          clinicId: config.clinicId,
          bridgeCode: config.bridgeCode,
          status,
          message,
          result,
        },
      });
    },
  };
}

export function createNoopDeviceBridgeAdapter() {
  return {
    async execute(command = {}) {
      const commandType = String(command.commandType || "");
      if (commandType === "bridge_health_check") {
        return {
          status: "completed",
          message: "Bridge worker process is running.",
          result: {
            executor: "stage4t-noop-adapter",
            hardwareAccess: false,
            commandType,
          },
        };
      }
      return {
        status: "failed",
        message: "No hardware adapter is configured for this command.",
        result: {
          executor: "stage4t-noop-adapter",
          hardwareAccess: false,
          commandType,
          reason: "adapter_missing",
        },
      };
    },
  };
}

export async function runDeviceBridgeWorkerOnce({
  config,
  client = createDeviceBridgeWorkerClient(config),
  adapter = createNoopDeviceBridgeAdapter(),
  logger = () => undefined,
} = {}) {
  validateDeviceBridgeWorkerConfig(config);
  await client.heartbeat(config);
  const commandResponse = await client.listCommands(config);
  const commands = Array.isArray(commandResponse.items) ? commandResponse.items : [];
  const summary = {
    stage: "4T",
    mode: "once",
    bridgeCode: config.bridgeCode,
    polled: commands.length,
    acknowledged: 0,
    completed: 0,
    failed: 0,
  };

  for (const command of commands) {
    await client.updateCommand(config, command.id, "acknowledged", "Worker accepted command.", {
      workerVersion: config.version,
    });
    summary.acknowledged += 1;
    try {
      const result = await adapter.execute(command, config);
      const status = result?.status === "failed" ? "failed" : "completed";
      await client.updateCommand(
        config,
        command.id,
        status,
        result?.message || (status === "completed" ? "Command completed." : "Command failed."),
        result?.result || {},
      );
      summary[status] += 1;
    } catch (error) {
      await client.updateCommand(config, command.id, "failed", "Worker execution failed.", {
        error: String(error?.message || error).slice(0, 240),
      });
      summary.failed += 1;
    }
  }

  logger(redactWorkerText(`[device-bridge-worker] polled=${summary.polled} completed=${summary.completed} failed=${summary.failed}`));
  return summary;
}

export async function runDeviceBridgeWorkerLoop({
  config,
  client = createDeviceBridgeWorkerClient(config),
  adapter = createNoopDeviceBridgeAdapter(),
  logger = (line) => console.log(line),
  signal = null,
} = {}) {
  validateDeviceBridgeWorkerConfig(config);
  while (!signal?.aborted) {
    await runDeviceBridgeWorkerOnce({ config, client, adapter, logger });
    if (signal?.aborted) break;
    await sleep(config.intervalMs || DEFAULT_INTERVAL_MS, undefined, { signal }).catch((error) => {
      if (error?.name !== "AbortError") throw error;
    });
  }
}

async function main() {
  const config = parseDeviceBridgeWorkerArgs(process.argv.slice(2), process.env);
  if (config.dryRun) {
    console.log(renderDeviceBridgeWorkerDryRun(config));
    return;
  }
  validateDeviceBridgeWorkerConfig(config);
  if (config.mode === "loop") {
    await runDeviceBridgeWorkerLoop({ config });
    return;
  }
  const summary = await runDeviceBridgeWorkerOnce({ config, logger: (line) => console.log(line) });
  console.log(redactWorkerText(JSON.stringify(summary)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const details = Array.isArray(error?.details) ? ` ${error.details.join(" ")}` : "";
    console.error(redactWorkerText(`[device-bridge-worker] ${error?.message || error}${details}`));
    process.exit(error?.status && Number.isFinite(error.status) ? error.status : 1);
  });
}
