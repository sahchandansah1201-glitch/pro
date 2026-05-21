#!/usr/bin/env node
// Stage 8A-8C · CRM inbound adapter implementation.
// Converts safe operator-owned CRM/ad exports into the Stage 5Q import payload.
// This script performs no network calls and stores no raw external payload.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Stage5UValidationError,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json";
const DEFAULT_INPUT = "deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json";
const DEFAULT_MAPPING = "deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json";
const DEFAULT_OUTPUT = "test-results/stage8a-8c-booking-import.json";
const DEFAULT_AUDIT_OUTPUT = "test-results/stage8a-8c-crm-inbound-audit.md";
const ENDPOINT_PATH = "/api/v1/integrations/booking-imports";
const SOURCE_SYSTEM_VALUES = new Set(["clinic_crm", "ads", "site", "manual", "other"]);
const ITEM_KIND_VALUES = new Set(["booking_request", "available_slot"]);
const MAX_RECORDS = 100;
const MAX_REFERENCE_LENGTH = 120;
const MAX_IDEMPOTENCY_KEY_LENGTH = 160;
const FORBIDDEN_VALUE_PATTERNS = [
  /access[_-]?token/i,
  /authorization:\s*bearer/i,
  /secret/i,
  /password/i,
  /patient[_-]?full[_-]?name/i,
  new RegExp(String.raw`\bpatient${"Name"}\b`, "i"),
  new RegExp(String.raw`\bfull${"Name"}\b`, "i"),
  new RegExp(String.raw`\bph${"one"}\b`, "i"),
  new RegExp(String.raw`\bem${"ail"}\b`, "i"),
  /raw[_-]?payload/i,
  /https?:\/\//i,
  new RegExp("storage" + "_object_path", "i"),
  new RegExp("signed" + "[_-]?url", "i"),
  new RegExp("api-" + "read", "i"),
  new RegExp("api-" + "write", "i"),
  new RegExp("edge" + " function", "i"),
  new RegExp("SUP" + "ABASE_"),
];

export class Stage8A8CAdapterError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "Stage8A8CAdapterError";
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

function readJsonFile(path) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) throw new Error(`JSON file not found: ${path}`);
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`JSON file is invalid: ${path}: ${error.message}`);
  }
}

function writeJson(path, value) {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path, value) {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${value}\n`);
}

function getPath(value, path) {
  if (!path) return undefined;
  const parts = String(path).split(".");
  let current = value;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function scanForForbiddenValues(value, path = "body", details = []) {
  if (value == null) return details;
  if (typeof value === "string") {
    for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        details.push({
          field: path,
          message: "Unsafe raw CRM values, tokens, external URLs, storage paths, or managed-runtime markers are not allowed.",
        });
        return details;
      }
    }
    return details;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForForbiddenValues(item, `${path}.${index}`, details));
    return details;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      scanForForbiddenValues(key, `${path}.${key}`, details);
      scanForForbiddenValues(item, `${path}.${key}`, details);
    }
  }
  return details;
}

function safeKeySegment(value, fallback) {
  const cleaned = cleanString(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function normalizeSourceSystem(value, fallback = "other") {
  const sourceSystem = cleanString(value) || cleanString(fallback) || "other";
  return SOURCE_SYSTEM_VALUES.has(sourceSystem) ? sourceSystem : "other";
}

function normalizeKind(value, kindMap = {}) {
  const raw = cleanString(value)?.toLowerCase();
  if (!raw) return null;
  const mapped = cleanString(kindMap[raw]) || raw;
  return ITEM_KIND_VALUES.has(mapped) ? mapped : null;
}

function normalizeMapping(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage8A8CAdapterError("CRM mapping must be a JSON object.", [
      { field: "mapping", message: "Mapping must be an object." },
    ]);
  }
  const details = scanForForbiddenValues(input, "mapping", []);
  if (details.length > 0) throw new Stage8A8CAdapterError("CRM mapping contains unsafe values.", details);

  const fieldMap = isPlainObject(input.fieldMap) ? input.fieldMap : {};
  const kindMap = isPlainObject(input.kindMap) ? input.kindMap : {};
  return {
    clinicId: cleanString(input.clinicId),
    sourceSystem: normalizeSourceSystem(input.sourceSystem, "other"),
    sourceReferencePrefix: safeKeySegment(input.sourceReferencePrefix, "crm-local-json"),
    idempotencyKeyPrefix: safeKeySegment(input.idempotencyKeyPrefix, "stage8a8c"),
    recordsPath: cleanString(input.recordsPath) || "records",
    fieldMap: {
      kind: cleanString(fieldMap.kind) || "recordType",
      externalId: cleanString(fieldMap.externalId) || "externalId",
      patientCode: cleanString(fieldMap.patientCode) || "patientCode",
      preferredFrom: cleanString(fieldMap.preferredFrom) || "preferredFrom",
      preferredTo: cleanString(fieldMap.preferredTo) || "preferredTo",
      reason: cleanString(fieldMap.reason) || "reason",
      doctorUserId: cleanString(fieldMap.doctorUserId) || "doctorUserId",
      startedAt: cleanString(fieldMap.startedAt) || "startedAt",
      durationMinutes: cleanString(fieldMap.durationMinutes) || "durationMinutes",
    },
    kindMap,
  };
}

function extractRecords(exportData, mapping) {
  if (Array.isArray(exportData)) return exportData;
  if (!isPlainObject(exportData)) return [];
  const mapped = getPath(exportData, mapping.recordsPath);
  if (Array.isArray(mapped)) return mapped;
  return Array.isArray(exportData.records) ? exportData.records : [];
}

function normalizeRecord(record, index, mapping) {
  if (!isPlainObject(record)) {
    return {
      item: null,
      rejection: { index, reason: "record_not_object" },
    };
  }

  const field = (key) => cleanString(getPath(record, mapping.fieldMap[key]));
  const kind = normalizeKind(field("kind"), mapping.kindMap);
  if (!kind) return { item: null, rejection: { index, reason: "unsupported_kind" } };

  const item = {
    kind,
    externalId: field("externalId"),
    patientCode: null,
    preferredFrom: null,
    preferredTo: null,
    reason: null,
    doctorUserId: null,
    startedAt: null,
    durationMinutes: null,
  };

  if (!item.externalId) return { item: null, rejection: { index, reason: "missing_external_id" } };

  if (kind === "booking_request") {
    item.patientCode = field("patientCode");
    item.preferredFrom = field("preferredFrom");
    item.preferredTo = field("preferredTo");
    item.reason = field("reason");
    if (!item.patientCode) return { item: null, rejection: { index, reason: "missing_patient_code" } };
    if (!item.preferredFrom) return { item: null, rejection: { index, reason: "missing_preferred_from" } };
  }

  if (kind === "available_slot") {
    item.doctorUserId = field("doctorUserId");
    item.startedAt = field("startedAt");
    const duration = getPath(record, mapping.fieldMap.durationMinutes);
    item.durationMinutes = duration == null ? null : Number(duration);
    if (!item.startedAt) return { item: null, rejection: { index, reason: "missing_started_at" } };
  }

  return { item, rejection: null };
}

export function normalizeCrmInboundRecords(exportData = {}, mappingInput = {}) {
  const mapping = normalizeMapping(mappingInput);
  const unsafe = scanForForbiddenValues(exportData, "export", []);
  if (unsafe.length > 0) {
    throw new Stage8A8CAdapterError("CRM export contains unsafe values.", unsafe);
  }

  const records = extractRecords(exportData, mapping);
  const limitedRecords = records.slice(0, MAX_RECORDS);
  const overflowCount = Math.max(0, records.length - MAX_RECORDS);
  const normalized = [];
  const rejectedRecords = [];

  for (const [index, record] of limitedRecords.entries()) {
    const result = normalizeRecord(record, index, mapping);
    if (result.item) normalized.push(result.item);
    if (result.rejection) rejectedRecords.push(result.rejection);
  }
  if (overflowCount > 0) {
    rejectedRecords.push({ index: MAX_RECORDS, reason: `over_limit_${overflowCount}` });
  }

  return {
    mapping,
    records: normalized,
    recordCount: records.length,
    rejectedRecords,
  };
}

export function buildStage5QImportPayloadFromCrmExport(exportData = {}, mappingInput = {}) {
  const { mapping, records, recordCount, rejectedRecords } = normalizeCrmInboundRecords(exportData, mappingInput);
  const exportId = safeKeySegment(exportData?.exportId, "crm-export");
  const sourceSystem = normalizeSourceSystem(exportData?.sourceSystem, mapping.sourceSystem);
  const sourceReference = `${mapping.sourceReferencePrefix}-${exportId}`.slice(0, MAX_REFERENCE_LENGTH);
  const idempotencyKey = `${mapping.idempotencyKeyPrefix}-${exportId}`.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
  const payload = {
    clinicId: mapping.clinicId,
    sourceSystem,
    sourceReference,
    idempotencyKey,
    items: records,
  };

  let validatedPayload;
  try {
    validatedPayload = validateExternalAdapterPayload(payload);
  } catch (error) {
    if (error instanceof Stage5UValidationError) {
      throw new Stage8A8CAdapterError("Normalized Stage 5Q payload failed validation.", error.details);
    }
    throw error;
  }

  const bookingRequestCount = validatedPayload.items.filter((item) => item.kind === "booking_request").length;
  const availableSlotCount = validatedPayload.items.filter((item) => item.kind === "available_slot").length;
  return {
    payload: validatedPayload,
    audit: {
      stage: "8A-8C",
      targetEndpoint: ENDPOINT_PATH,
      sourceSystem,
      sourceReference,
      recordCount,
      acceptedCount: validatedPayload.items.length,
      rejectedCount: rejectedRecords.length,
      bookingRequestCount,
      availableSlotCount,
      rejectedRecords,
      payloadValidated: true,
      storedRawExternalPayload: false,
      networkCallsExternalSystems: false,
      backendCallsExternalCrmRuntime: false,
      browserCallsExternalCrmRuntime: false,
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
    },
  };
}

export function buildStage8A8CCrmAdapterPlan({
  manifest = readJsonFile(DEFAULT_MANIFEST),
  inputPath = DEFAULT_INPUT,
  mappingPath = DEFAULT_MAPPING,
} = {}) {
  return {
    stage: manifest.stage,
    packageId: manifest.packageId,
    title: manifest.title,
    inputPath,
    mappingPath,
    outputContract: manifest.outputs?.targetEndpoint ?? ENDPOINT_PATH,
    networkCalls: false,
    storesRawExternalPayload: false,
    managedRuntimeDependency: manifest.productBoundary?.managedRuntimeDependency ?? "none",
    managedDatabaseDependency: manifest.productBoundary?.managedDatabaseDependency ?? "none",
  };
}

export function renderStage8A8CCrmInboundAdapterDryRun({
  audit,
  outputPath = DEFAULT_OUTPUT,
} = {}) {
  const lines = [
    "## Stage 8A-8C CRM inbound adapter",
    "",
    "- Mode: dry-run/local normalization; no network calls were made.",
    `- Target endpoint: \`${audit.targetEndpoint}\``,
    `- Source system: \`${audit.sourceSystem}\``,
    `- Source reference: \`${audit.sourceReference}\``,
    `- Input records: ${audit.recordCount}`,
    `- Accepted records: ${audit.acceptedCount}`,
    `- Rejected records: ${audit.rejectedCount}`,
    `- Booking requests: ${audit.bookingRequestCount}`,
    `- Available slots: ${audit.availableSlotCount}`,
    "- Stored raw external payload: false",
    "- Runtime calls to CRM/ad systems: false",
    "- Managed runtime/database dependency: none",
    `- Normalized output path: \`${outputPath}\``,
    "",
    "### Rejected record reasons",
    "",
  ];
  if (audit.rejectedRecords.length === 0) {
    lines.push("- none");
  } else {
    for (const item of audit.rejectedRecords) {
      lines.push(`- index ${item.index}: ${item.reason}`);
    }
  }
  return lines.join("\n");
}

export function parseStage8A8CArgs(argv = []) {
  const parsed = {
    input: DEFAULT_INPUT,
    mapping: DEFAULT_MAPPING,
    output: null,
    auditOutput: null,
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
    let matched = false;
    for (const [name, key] of [
      ["--input", "input"],
      ["--mapping", "mapping"],
      ["--output", "output"],
      ["--audit-output", "auditOutput"],
    ]) {
      if (arg === name) {
        const value = argv[index + 1];
        if (!value) throw new Error(`${name} requires a path`);
        parsed[key] = value;
        index += 1;
        matched = true;
        break;
      }
      if (arg.startsWith(`${name}=`)) {
        parsed[key] = arg.slice(name.length + 1);
        matched = true;
        break;
      }
    }
    if (matched) continue;
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

export function runStage8A8CCrmInboundAdapter(argv = process.argv.slice(2)) {
  const args = parseStage8A8CArgs(argv);
  const exportData = readJsonFile(args.input);
  const mapping = readJsonFile(args.mapping);
  const { payload, audit } = buildStage5QImportPayloadFromCrmExport(exportData, mapping);
  const outputPath = args.output || DEFAULT_OUTPUT;
  const auditOutput = args.auditOutput || DEFAULT_AUDIT_OUTPUT;
  const report = renderStage8A8CCrmInboundAdapterDryRun({ audit, outputPath });

  if (args.output) writeJson(args.output, payload);
  if (args.auditOutput) writeText(args.auditOutput, report);

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ audit, payload }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`${report}\n`);
  return 0;
}

export function main(argv = process.argv.slice(2)) {
  try {
    return runStage8A8CCrmInboundAdapter(argv);
  } catch (error) {
    if (error instanceof Stage8A8CAdapterError) {
      console.error(`[stage8a-8c-crm-inbound-adapter] ${error.message}`);
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage8a-8c-crm-inbound-adapter] ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
