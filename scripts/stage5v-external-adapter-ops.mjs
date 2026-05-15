#!/usr/bin/env node
// Stage 5V · external adapter operations pack.
// Builds a safe local operator report around Stage 5U payload validation and
// Stage 5T status snapshots. It performs no network calls.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Stage5UValidationError,
  buildExternalAdapterCurl,
  readPayloadFile,
  summarizeExternalAdapterPayload,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";

const DEFAULT_INPUT = "deploy/self-hosted/integrations/booking-import.stage5u.example.json";
const DEFAULT_STATUS_FILE = "deploy/self-hosted/integrations/booking-import-status.stage5v.example.json";
const DEFAULT_API_BASE_URL = "http://localhost:8080";
const MAX_DUPLICATE_WARN = 20;
const MAX_REJECTED_WARN = 0;

const STATUS_FORBIDDEN_PATTERNS = [
  /access[_-]?token/i,
  /authorization:\s*bearer/i,
  new RegExp("storage" + "_object_path", "i"),
  new RegExp("signed" + "[_-]?url", "i"),
  /https?:\/\//i,
  new RegExp("api-" + "read", "i"),
  new RegExp("api-" + "write", "i"),
  new RegExp("edge" + " function", "i"),
  new RegExp("SUP" + "ABASE_"),
];

export class Stage5VOpsError extends Error {
  constructor(details = []) {
    super("Stage 5V external adapter operations report failed validation.");
    this.name = "Stage5VOpsError";
    this.details = details;
  }
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function scanStatusSnapshot(value, path, details) {
  if (value == null) return;
  if (typeof value === "string") {
    for (const pattern of STATUS_FORBIDDEN_PATTERNS) {
      if (pattern.test(value)) {
        details.push({
          field: path,
          message: "Status snapshot must not contain raw URLs, tokens, storage paths, or managed-runtime markers.",
        });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanStatusSnapshot(item, `${path}.${index}`, details));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      scanStatusSnapshot(key, `${path}.${key}`, details);
      scanStatusSnapshot(item, `${path}.${key}`, details);
    }
  }
}

function readJsonFile(path) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`File must contain valid JSON: ${path}: ${error.message}`);
  }
}

export function readStatusSnapshot(path = DEFAULT_STATUS_FILE) {
  return readJsonFile(path);
}

export function validateStatusSnapshot(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage5VOpsError([{ field: "status", message: "Status snapshot must be a JSON object." }]);
  }
  const details = [];
  scanStatusSnapshot(input, "status", details);
  for (const field of [
    "recentBatchCount",
    "rejectedLast24h",
    "duplicateLast24h",
    "openBookingRequestCount",
    "availableSlotCount",
  ]) {
    const value = Number(input[field]);
    if (!Number.isInteger(value) || value < 0) {
      details.push({ field, message: `${field} must be a non-negative integer.` });
    }
  }
  if (input.storedRawPayload !== false) {
    details.push({ field: "storedRawPayload", message: "storedRawPayload must be false." });
  }
  if (input.runtimeCallsExternalSystems !== false) {
    details.push({ field: "runtimeCallsExternalSystems", message: "runtimeCallsExternalSystems must be false." });
  }
  if (String(input.hardeningVersion || "") !== "stage5t") {
    details.push({ field: "hardeningVersion", message: "hardeningVersion must be stage5t." });
  }
  if (details.length > 0) throw new Stage5VOpsError(details);

  return {
    sourceSystem: String(input.sourceSystem || "all"),
    recentBatchCount: Number(input.recentBatchCount),
    rejectedLast24h: Number(input.rejectedLast24h),
    duplicateLast24h: Number(input.duplicateLast24h),
    openBookingRequestCount: Number(input.openBookingRequestCount),
    availableSlotCount: Number(input.availableSlotCount),
    storedRawPayload: false,
    runtimeCallsExternalSystems: false,
    hardeningVersion: "stage5t",
    latestBySource: Array.isArray(input.latestBySource) ? input.latestBySource.slice(0, 5) : [],
  };
}

export function buildExternalAdapterOpsReport({
  payload,
  status,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  payloadPath = DEFAULT_INPUT,
} = {}) {
  const payloadSummary = summarizeExternalAdapterPayload(payload);
  const warnings = [];
  if (status.rejectedLast24h > MAX_REJECTED_WARN) {
    warnings.push(`Rejected items in last 24h: ${status.rejectedLast24h}`);
  }
  if (status.duplicateLast24h > MAX_DUPLICATE_WARN) {
    warnings.push(`Duplicate items in last 24h: ${status.duplicateLast24h}`);
  }
  if (status.storedRawPayload !== false) warnings.push("Raw payload storage is not false.");
  if (status.runtimeCallsExternalSystems !== false) warnings.push("Runtime calls to external systems are not false.");

  return {
    stage: "5V",
    mode: "dry-run",
    endpoint: payloadSummary.endpoint,
    sourceSystem: payloadSummary.sourceSystem,
    itemCount: payloadSummary.itemCount,
    bookingRequestCount: payloadSummary.bookingRequestCount,
    availableSlotCount: payloadSummary.availableSlotCount,
    idempotencyKeyProvided: payloadSummary.idempotencyKeyProvided,
    status: {
      recentBatchCount: status.recentBatchCount,
      rejectedLast24h: status.rejectedLast24h,
      duplicateLast24h: status.duplicateLast24h,
      openBookingRequestCount: status.openBookingRequestCount,
      availableSlotCount: status.availableSlotCount,
      storedRawPayload: status.storedRawPayload,
      runtimeCallsExternalSystems: status.runtimeCallsExternalSystems,
      hardeningVersion: status.hardeningVersion,
    },
    gates: {
      payloadValid: true,
      statusSnapshotValid: true,
      noExternalRuntimeCalls: true,
      rawPayloadStorageDisabled: true,
      readyForOperatorReview: warnings.length === 0,
    },
    warnings,
    curl: buildExternalAdapterCurl({ apiBaseUrl, payloadPath }),
  };
}

export function renderExternalAdapterOpsMarkdown(report) {
  const lines = [
    "## Stage 5V external adapter operations report",
    "",
    "- Mode: dry-run only; no network calls were made.",
    `- Endpoint: \`${report.endpoint}\``,
    `- Source system: \`${report.sourceSystem}\``,
    `- Payload items: ${report.itemCount}`,
    `- Booking requests: ${report.bookingRequestCount}`,
    `- Available slots: ${report.availableSlotCount}`,
    `- Idempotency key: ${report.idempotencyKeyProvided ? "present" : "missing"}`,
    "",
    "### Status snapshot",
    "",
    `- Recent batches: ${report.status.recentBatchCount}`,
    `- Rejected last 24h: ${report.status.rejectedLast24h}`,
    `- Duplicates last 24h: ${report.status.duplicateLast24h}`,
    `- Open booking requests: ${report.status.openBookingRequestCount}`,
    `- Available slots: ${report.status.availableSlotCount}`,
    `- Stored raw payload: ${report.status.storedRawPayload}`,
    `- Runtime calls to CRM/ad systems: ${report.status.runtimeCallsExternalSystems}`,
    `- Hardening: ${report.status.hardeningVersion}`,
    "",
    "### Gates",
    "",
    `- Payload valid: ${report.gates.payloadValid ? "yes" : "no"}`,
    `- Status snapshot valid: ${report.gates.statusSnapshotValid ? "yes" : "no"}`,
    `- No external runtime calls: ${report.gates.noExternalRuntimeCalls ? "yes" : "no"}`,
    `- Raw payload storage disabled: ${report.gates.rawPayloadStorageDisabled ? "yes" : "no"}`,
    `- Ready for operator review: ${report.gates.readyForOperatorReview ? "yes" : "no"}`,
    "",
    "### Operator checklist",
    "",
    "- Confirm source export file was produced by an operator-owned adapter.",
    "- Confirm payload was validated locally before import.",
    "- Import into the self-hosted backend only after replacing the bearer token placeholder.",
    "- Review rejected and duplicate counters after import.",
    "- Escalate any rejected items before confirming slots or booking requests.",
    "",
    "### Local import command",
    "",
    "```bash",
    report.curl,
    "```",
  ];
  if (report.warnings.length > 0) {
    lines.splice(33, 0, "", "### Warnings", "", ...report.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join("\n");
}

export function parseArgs(argv = []) {
  const parsed = {
    input: DEFAULT_INPUT,
    statusFile: DEFAULT_STATUS_FILE,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    output: null,
    json: false,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--input" || arg === "--status-file" || arg === "--api-base-url" || arg === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      const key = {
        "--input": "input",
        "--status-file": "statusFile",
        "--api-base-url": "apiBaseUrl",
        "--output": "output",
      }[arg];
      parsed[key] = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--input=")) {
      parsed.input = arg.slice("--input=".length);
      continue;
    }
    if (arg.startsWith("--status-file=")) {
      parsed.statusFile = arg.slice("--status-file=".length);
      continue;
    }
    if (arg.startsWith("--api-base-url=")) {
      parsed.apiBaseUrl = arg.slice("--api-base-url=".length);
      continue;
    }
    if (arg.startsWith("--output=")) {
      parsed.output = arg.slice("--output=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function writeOutput(path, text) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), text);
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const payload = validateExternalAdapterPayload(readPayloadFile(args.input));
    const status = validateStatusSnapshot(readStatusSnapshot(args.statusFile));
    const report = buildExternalAdapterOpsReport({
      payload,
      status,
      apiBaseUrl: args.apiBaseUrl,
      payloadPath: args.input,
    });
    const output = args.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : `${renderExternalAdapterOpsMarkdown(report)}\n`;
    if (args.output) writeOutput(args.output, output);
    process.stdout.write(output);
    return 0;
  } catch (error) {
    if (error instanceof Stage5UValidationError || error instanceof Stage5VOpsError) {
      const details = error.details || [];
      console.error("[stage5v-external-adapter-ops] validation failed");
      for (const detail of details) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage5v-external-adapter-ops] ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
