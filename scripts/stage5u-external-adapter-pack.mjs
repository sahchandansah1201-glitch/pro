#!/usr/bin/env node
// Stage 5U · external adapter delivery pack.
// Validates sanitized CRM/ad export payloads offline and prints local
// self-hosted import instructions. This script performs no network calls.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_INPUT = "deploy/self-hosted/integrations/booking-import.stage5u.example.json";
const DEFAULT_API_BASE_URL = "http://localhost:8080";
const ENDPOINT_PATH = "/api/v1/integrations/booking-imports";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_SYSTEM_VALUES = new Set(["clinic_crm", "ads", "site", "manual", "other"]);
const ITEM_KIND_VALUES = new Set(["booking_request", "available_slot"]);
const MAX_ITEMS = 100;
const MAX_REASON_LENGTH = 500;
const MAX_REFERENCE_LENGTH = 120;
const MAX_IDEMPOTENCY_KEY_LENGTH = 160;
const FORBIDDEN_VALUE_PATTERNS = [
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

export class Stage5UValidationError extends Error {
  constructor(details = []) {
    super("Stage 5U external adapter payload failed validation.");
    this.name = "Stage5UValidationError";
    this.details = details;
  }
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function validateUuid(value, field, details, { required = false } = {}) {
  if (!value) {
    if (required) details.push({ field, message: `${field} is required.` });
    return;
  }
  if (!UUID_PATTERN.test(String(value))) {
    details.push({ field, message: `${field} must be a UUID.` });
  }
}

function validateIsoDateTime(value, field, details, { required = false } = {}) {
  if (!value) {
    if (required) details.push({ field, message: `${field} is required.` });
    return;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    details.push({ field, message: `${field} must be an ISO date-time.` });
  }
}

function validateDuration(value, field, details) {
  if (value == null) return;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 5 || number > 720) {
    details.push({ field, message: `${field} must be an integer between 5 and 720.` });
  }
}

function scanForForbiddenValues(value, path, details) {
  if (value == null) return;
  if (typeof value === "string") {
    for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        details.push({
          field: path,
          message: "Raw external URLs, tokens, storage paths, and managed-runtime markers are not allowed.",
        });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForForbiddenValues(item, `${path}.${index}`, details));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      scanForForbiddenValues(key, `${path}.${key}`, details);
      scanForForbiddenValues(item, `${path}.${key}`, details);
    }
  }
}

function normalizeImportItem(item, index, details) {
  if (!isPlainObject(item)) {
    details.push({ field: `items.${index}`, message: "Import item must be an object." });
    return null;
  }

  const kind = cleanString(item.kind);
  const normalized = {
    kind,
    externalId: cleanString(item.externalId),
    patientCode: cleanString(item.patientCode),
    preferredFrom: cleanString(item.preferredFrom),
    preferredTo: cleanString(item.preferredTo),
    reason: cleanString(item.reason),
    doctorUserId: cleanString(item.doctorUserId),
    startedAt: cleanString(item.startedAt),
    durationMinutes: item.durationMinutes == null ? null : Number(item.durationMinutes),
  };

  if (!kind || !ITEM_KIND_VALUES.has(kind)) {
    details.push({ field: `items.${index}.kind`, message: "Kind must be booking_request or available_slot." });
  }
  if (!normalized.externalId) {
    details.push({ field: `items.${index}.externalId`, message: "External ID is required." });
  }

  if (kind === "booking_request") {
    if (!normalized.patientCode) {
      details.push({ field: `items.${index}.patientCode`, message: "Patient code is required for booking imports." });
    }
    validateIsoDateTime(normalized.preferredFrom, `items.${index}.preferredFrom`, details, { required: true });
    validateIsoDateTime(normalized.preferredTo, `items.${index}.preferredTo`, details);
  }

  if (kind === "available_slot") {
    validateUuid(normalized.doctorUserId, `items.${index}.doctorUserId`, details);
    validateIsoDateTime(normalized.startedAt, `items.${index}.startedAt`, details, { required: true });
    validateDuration(normalized.durationMinutes, `items.${index}.durationMinutes`, details);
  }

  if (normalized.reason && normalized.reason.length > MAX_REASON_LENGTH) {
    details.push({ field: `items.${index}.reason`, message: "Reason is too long." });
  }

  return normalized;
}

export function validateExternalAdapterPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage5UValidationError([{ field: "body", message: "JSON object is required." }]);
  }

  const details = [];
  const sourceSystem = cleanString(input.sourceSystem) || "other";
  const payload = {
    clinicId: cleanString(input.clinicId),
    sourceSystem,
    sourceReference: cleanString(input.sourceReference),
    idempotencyKey: cleanString(input.idempotencyKey),
    items: [],
  };

  scanForForbiddenValues(input, "body", details);
  validateUuid(payload.clinicId, "clinicId", details, { required: true });

  if (!SOURCE_SYSTEM_VALUES.has(sourceSystem)) {
    details.push({ field: "sourceSystem", message: "Source system is not supported." });
  }
  if (payload.sourceReference && payload.sourceReference.length > MAX_REFERENCE_LENGTH) {
    details.push({ field: "sourceReference", message: "Source reference is too long." });
  }
  if (payload.idempotencyKey && payload.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    details.push({ field: "idempotencyKey", message: "Idempotency key is too long." });
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    details.push({ field: "items", message: "At least one import item is required." });
  } else if (input.items.length > MAX_ITEMS) {
    details.push({ field: "items", message: `At most ${MAX_ITEMS} import items are allowed.` });
  } else {
    payload.items = input.items
      .map((item, index) => normalizeImportItem(item, index, details))
      .filter(Boolean);
  }

  if (details.length > 0) throw new Stage5UValidationError(details);
  return payload;
}

export function readPayloadFile(path = DEFAULT_INPUT) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Input file not found: ${path}`);
  }
  const text = readFileSync(absolutePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Input file must contain valid JSON: ${error.message}`);
  }
}

export function summarizeExternalAdapterPayload(payload) {
  const itemCount = payload.items.length;
  const bookingRequestCount = payload.items.filter((item) => item.kind === "booking_request").length;
  const availableSlotCount = payload.items.filter((item) => item.kind === "available_slot").length;
  return {
    stage: "5U",
    endpoint: ENDPOINT_PATH,
    sourceSystem: payload.sourceSystem,
    sourceReference: payload.sourceReference,
    itemCount,
    bookingRequestCount,
    availableSlotCount,
    idempotencyKeyProvided: Boolean(payload.idempotencyKey),
    storedRawPayload: false,
    runtimeCallsExternalSystems: false,
  };
}

function normalizeApiBaseUrl(value = DEFAULT_API_BASE_URL) {
  const cleaned = String(value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
  return cleaned || DEFAULT_API_BASE_URL;
}

export function buildExternalAdapterCurl({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  payloadPath = DEFAULT_INPUT,
} = {}) {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  return [
    "curl",
    "-X POST",
    `"${baseUrl}${ENDPOINT_PATH}"`,
    "-H \"Content-Type: application/json\"",
    "-H \"Authorization: Bearer <SELF_HOSTED_BEARER_TOKEN>\"",
    `--data-binary "@${payloadPath}"`,
  ].join(" ");
}

export function renderExternalAdapterDryRun({
  payload,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  payloadPath = DEFAULT_INPUT,
} = {}) {
  const summary = summarizeExternalAdapterPayload(payload);
  const lines = [
    "## Stage 5U external adapter delivery pack",
    "",
    "- Mode: dry-run only; no network calls were made.",
    `- Endpoint: \`${summary.endpoint}\``,
    `- Source system: \`${summary.sourceSystem}\``,
    `- Items: ${summary.itemCount}`,
    `- Booking requests: ${summary.bookingRequestCount}`,
    `- Available slots: ${summary.availableSlotCount}`,
    `- Idempotency key: ${summary.idempotencyKeyProvided ? "present" : "missing"}`,
    "- Stored raw payload: false",
    "- Runtime calls to CRM/ad systems: false",
    "",
    "### Local self-hosted import command",
    "",
    "```bash",
    buildExternalAdapterCurl({ apiBaseUrl, payloadPath }),
    "```",
  ];
  return lines.join("\n");
}

export function parseArgs(argv = []) {
  const parsed = {
    input: DEFAULT_INPUT,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    dryRun: false,
    json: false,
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
    if (arg === "--input") {
      const value = argv[index + 1];
      if (!value) throw new Error("--input requires a path");
      parsed.input = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--input=")) {
      parsed.input = arg.slice("--input=".length);
      continue;
    }
    if (arg === "--api-base-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--api-base-url requires a URL");
      parsed.apiBaseUrl = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--api-base-url=")) {
      parsed.apiBaseUrl = arg.slice("--api-base-url=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const payload = validateExternalAdapterPayload(readPayloadFile(args.input));
    const summary = summarizeExternalAdapterPayload(payload);
    if (args.json) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      return 0;
    }
    process.stdout.write(`${renderExternalAdapterDryRun({
      payload,
      apiBaseUrl: args.apiBaseUrl,
      payloadPath: args.input,
    })}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Stage5UValidationError) {
      console.error("[stage5u-external-adapter-pack] validation failed");
      for (const detail of error.details) {
        console.error(`- ${detail.field}: ${detail.message}`);
      }
      return 1;
    }
    console.error(`[stage5u-external-adapter-pack] ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
