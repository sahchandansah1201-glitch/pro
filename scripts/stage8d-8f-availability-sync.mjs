#!/usr/bin/env node
// Stage 8D-8F · Appointment availability sync and booking confirmation planner.
// Reads a local, redacted snapshot only. It never calls CRM/ad systems or the
// self-hosted backend. Operators use the output to resolve conflicts before
// confirming bookings through the existing Stage 5S endpoint.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEFAULT_INPUT = "deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json";
const DEFAULT_OUTPUT = "test-results/stage8d-8f-availability-sync-report.json";
const DEFAULT_AUDIT = "test-results/stage8d-8f-availability-sync-audit.md";

const UUIDISH = /^[A-Za-z0-9._:-]{3,120}$/;
const SAFE_SOURCE_SYSTEMS = new Set(["clinic_crm", "ads", "site", "manual", "other"]);
const OPEN_REQUEST_STATUSES = new Set(["requested", "reviewing"]);
const AVAILABLE_SLOT_STATUSES = new Set(["available"]);
const UNSAFE_KEY_PATTERN = /\b(email|phone|fullName|patientName|accessToken|token|password|secret|signedUrl|storageObjectPath|sourceUrl|rawPayload)\b/i;
const UNSAFE_VALUE_PATTERNS = [
  /https?:\/\//i,
  /\bBearer\s+[A-Za-z0-9._-]+/i,
  /\baccess[_-]?token\b/i,
  /\bsigned[_-]?url\b/i,
  /\bstorage[_-]?object[_-]?path\b/i,
  /\bSUPABASE_[A-Z0-9_]+\b/,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\+\d[\d\s().-]{8,}\d/,
  /\b\d{3}[\s().-]\d{3}[\s().-]\d{4}\b/,
];

export class Stage8D8FAvailabilitySyncError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "Stage8D8FAvailabilitySyncError";
    this.details = details;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanRef(value, field, details) {
  const text = String(value ?? "").trim();
  if (!text || !UUIDISH.test(text)) {
    details.push({ field, reason: "safe_reference_required" });
    return "";
  }
  return text;
}

function cleanStatus(value, fallback) {
  return String(value ?? fallback).trim() || fallback;
}

function cleanDate(value, field, details) {
  const text = String(value ?? "").trim();
  if (!text) {
    details.push({ field, reason: "date_required" });
    return null;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    details.push({ field, reason: "invalid_date" });
    return null;
  }
  return date.toISOString();
}

function cleanOptionalDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberInRange(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function findUnsafeValues(value, path = "snapshot", findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findUnsafeValues(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isRecord(value)) {
    if (typeof value === "string") {
      for (const pattern of UNSAFE_VALUE_PATTERNS) {
        if (pattern.test(value)) {
          findings.push({ field: path, reason: "unsafe_value" });
          break;
        }
      }
    }
    return findings;
  }
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (UNSAFE_KEY_PATTERN.test(key)) {
      findings.push({ field: nestedPath, reason: "unsafe_field" });
    }
    findUnsafeValues(nested, nestedPath, findings);
  }
  return findings;
}

function assertSafeSnapshot(input) {
  const findings = findUnsafeValues(input);
  if (findings.length > 0) {
    throw new Stage8D8FAvailabilitySyncError("Availability sync snapshot contains unsafe values.", findings);
  }
}

function normalizeImportStatus(value = {}) {
  const input = isRecord(value) ? value : {};
  return {
    recentBatchCount: numberInRange(input.recentBatchCount, 0, 0, 100000),
    rejectedLast24h: numberInRange(input.rejectedLast24h, 0, 0, 100000),
    duplicateLast24h: numberInRange(input.duplicateLast24h, 0, 0, 100000),
    latestImportAt: cleanOptionalDate(input.latestImportAt),
    openBookingRequestCount: numberInRange(input.openBookingRequestCount, 0, 0, 100000),
    availableSlotCount: numberInRange(input.availableSlotCount, 0, 0, 100000),
    storedRawPayload: Boolean(input.storedRawPayload),
    runtimeCallsExternalSystems: Boolean(input.runtimeCallsExternalSystems),
  };
}

export function normalizeAvailabilitySyncSnapshot(input = {}) {
  if (!isRecord(input)) {
    throw new Stage8D8FAvailabilitySyncError("Availability sync snapshot must be a JSON object.", [
      { field: "snapshot", reason: "object_required" },
    ]);
  }
  assertSafeSnapshot(input);
  const details = [];
  const snapshot = {
    snapshotId: cleanRef(input.snapshotId ?? "availability-sync-snapshot", "snapshotId", details),
    generatedAt: cleanOptionalDate(input.generatedAt) || new Date(0).toISOString(),
    source: String(input.source ?? "local_postgresql_export"),
    importStatus: normalizeImportStatus(input.importStatus),
    bookingRequests: [],
    availableSlots: [],
  };
  const bookingRequests = Array.isArray(input.bookingRequests) ? input.bookingRequests : [];
  const availableSlots = Array.isArray(input.availableSlots) ? input.availableSlots : [];

  snapshot.bookingRequests = bookingRequests.slice(0, 500).map((item, index) => {
    const row = isRecord(item) ? item : {};
    return {
      requestRef: cleanRef(row.requestRef, `bookingRequests[${index}].requestRef`, details),
      clinicRef: cleanRef(row.clinicRef, `bookingRequests[${index}].clinicRef`, details),
      preferredFrom: cleanDate(row.preferredFrom, `bookingRequests[${index}].preferredFrom`, details),
      preferredTo: cleanDate(row.preferredTo, `bookingRequests[${index}].preferredTo`, details),
      status: cleanStatus(row.status, "requested"),
    };
  }).filter((item) => item.requestRef && item.clinicRef && item.preferredFrom && item.preferredTo);

  snapshot.availableSlots = availableSlots.slice(0, 1000).map((item, index) => {
    const row = isRecord(item) ? item : {};
    const sourceSystem = String(row.sourceSystem ?? "other");
    if (!SAFE_SOURCE_SYSTEMS.has(sourceSystem)) {
      details.push({ field: `availableSlots[${index}].sourceSystem`, reason: "invalid_source_system" });
    }
    return {
      slotRef: cleanRef(row.slotRef, `availableSlots[${index}].slotRef`, details),
      clinicRef: cleanRef(row.clinicRef, `availableSlots[${index}].clinicRef`, details),
      doctorRef: cleanRef(row.doctorRef ?? "doctor-unassigned", `availableSlots[${index}].doctorRef`, details),
      sourceSystem: SAFE_SOURCE_SYSTEMS.has(sourceSystem) ? sourceSystem : "other",
      sourceSlotRef: cleanRef(row.sourceSlotRef ?? row.slotRef, `availableSlots[${index}].sourceSlotRef`, details),
      startedAt: cleanDate(row.startedAt, `availableSlots[${index}].startedAt`, details),
      durationMinutes: numberInRange(row.durationMinutes, 30, 5, 240),
      status: cleanStatus(row.status, "available"),
    };
  }).filter((item) => item.slotRef && item.clinicRef && item.doctorRef && item.sourceSlotRef && item.startedAt);

  if (details.length > 0) {
    throw new Stage8D8FAvailabilitySyncError("Availability sync snapshot failed validation.", details);
  }
  return snapshot;
}

function toMs(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function slotEndMs(slot) {
  return toMs(slot.startedAt) + slot.durationMinutes * 60_000;
}

function requestWindowMatchesSlot(request, slot, nowMs) {
  if (request.clinicRef !== slot.clinicRef) return false;
  if (!OPEN_REQUEST_STATUSES.has(request.status)) return false;
  if (!AVAILABLE_SLOT_STATUSES.has(slot.status)) return false;
  const start = toMs(slot.startedAt);
  return start >= nowMs && start >= toMs(request.preferredFrom) && start <= toMs(request.preferredTo);
}

function addIssue(issues, type, severity, count, message) {
  if (count > 0) issues.push({ type, severity, count, message });
}

export function buildAvailabilitySyncReport(snapshotInput, { now = "2026-05-21T12:00:00.000Z" } = {}) {
  const snapshot = normalizeAvailabilitySyncSnapshot(snapshotInput);
  const nowMs = toMs(now);
  const openRequests = snapshot.bookingRequests.filter((request) => OPEN_REQUEST_STATUSES.has(request.status));
  const availableSlots = snapshot.availableSlots.filter((slot) => AVAILABLE_SLOT_STATUSES.has(slot.status));
  const issues = [];

  const staleSlots = availableSlots.filter((slot) => toMs(slot.startedAt) < nowMs);
  addIssue(issues, "stale_slots", "warning", staleSlots.length, "Local slot cache contains availability windows in the past.");

  const duplicateSourceKeys = new Map();
  for (const slot of availableSlots) {
    const key = `${slot.clinicRef}:${slot.sourceSystem}:${slot.sourceSlotRef}`;
    duplicateSourceKeys.set(key, (duplicateSourceKeys.get(key) || 0) + 1);
  }
  const duplicateSourceSlots = [...duplicateSourceKeys.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  addIssue(issues, "duplicate_source_slots", "blocking", duplicateSourceSlots, "Source availability contains duplicate slot references.");

  let overlappingSlots = 0;
  const comparableSlots = [...availableSlots].sort((a, b) => toMs(a.startedAt) - toMs(b.startedAt));
  for (let i = 0; i < comparableSlots.length; i += 1) {
    const current = comparableSlots[i];
    for (let j = i + 1; j < comparableSlots.length; j += 1) {
      const next = comparableSlots[j];
      if (current.clinicRef !== next.clinicRef || current.doctorRef !== next.doctorRef) continue;
      if (toMs(next.startedAt) >= slotEndMs(current)) break;
      overlappingSlots += 1;
    }
  }
  addIssue(issues, "overlapping_slots", "blocking", overlappingSlots, "A doctor has overlapping local availability windows.");

  const usedSlots = new Set();
  const confirmationCandidates = [];
  const unmatchedRequests = [];
  for (const request of openRequests) {
    const slot = availableSlots.find((candidate) => !usedSlots.has(candidate.slotRef) && requestWindowMatchesSlot(request, candidate, nowMs));
    if (!slot) {
      unmatchedRequests.push(request);
      continue;
    }
    usedSlots.add(slot.slotRef);
    confirmationCandidates.push({
      requestRef: request.requestRef,
      slotRef: slot.slotRef,
      reason: "preferred_window_match",
    });
  }
  addIssue(issues, "requests_without_matching_slot", "warning", unmatchedRequests.length, "Open booking requests have no compatible local available slot.");
  addIssue(issues, "import_rejections_last_24h", "warning", snapshot.importStatus.rejectedLast24h, "Recent imports rejected items; review import audit before confirmation.");
  addIssue(issues, "import_duplicates_last_24h", "warning", snapshot.importStatus.duplicateLast24h, "Recent imports contained duplicates; review conflict policy before confirmation.");
  addIssue(issues, "raw_payload_storage_enabled", "blocking", snapshot.importStatus.storedRawPayload ? 1 : 0, "Raw external payload storage must stay disabled.");
  addIssue(issues, "external_runtime_calls_enabled", "blocking", snapshot.importStatus.runtimeCallsExternalSystems ? 1 : 0, "Runtime calls to CRM/ad systems must stay disabled.");

  const blockingCount = issues.filter((issue) => issue.severity === "blocking").reduce((sum, issue) => sum + issue.count, 0);
  const warningCount = issues.filter((issue) => issue.severity === "warning").reduce((sum, issue) => sum + issue.count, 0);
  const status = blockingCount > 0 ? "blocked" : warningCount > 0 ? "attention" : "ready";

  return {
    stage: "8D-8F",
    status,
    snapshotId: snapshot.snapshotId,
    counts: {
      bookingRequests: snapshot.bookingRequests.length,
      openBookingRequests: openRequests.length,
      availableSlots: availableSlots.length,
      confirmationCandidates: confirmationCandidates.length,
      conflicts: issues.reduce((sum, issue) => sum + issue.count, 0),
    },
    conflictSummary: issues.map((issue) => ({
      type: issue.type,
      severity: issue.severity,
      count: issue.count,
      message: issue.message,
    })),
    confirmationCandidates,
    productBoundary: {
      networkCalls: false,
      storesRawExternalPayload: false,
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
    },
  };
}

export function renderAvailabilitySyncReport(report) {
  const lines = [
    "# Stage 8D-8F Availability Sync",
    "",
    `- Status: \`${report.status}\``,
    `- Snapshot: \`${report.snapshotId}\``,
    "- Mode: local dry-run; no network calls were made.",
    "- Confirmation writes directly: false",
    "- Managed runtime/database dependency: none/none",
    "",
    "## Counts",
    "",
    `- Booking requests: ${report.counts.bookingRequests}`,
    `- Open booking requests: ${report.counts.openBookingRequests}`,
    `- Available slots: ${report.counts.availableSlots}`,
    `- Confirmation candidates: ${report.counts.confirmationCandidates}`,
    `- Conflicts: ${report.counts.conflicts}`,
    "",
    "## Conflict summary",
    "",
  ];
  if (report.conflictSummary.length === 0) {
    lines.push("- none");
  } else {
    for (const issue of report.conflictSummary) {
      lines.push(`- ${issue.severity} \`${issue.type}\`: ${issue.count}`);
    }
  }
  lines.push("", "## Confirmation candidates", "");
  if (report.confirmationCandidates.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of report.confirmationCandidates) {
      lines.push(`- ${candidate.requestRef} -> ${candidate.slotRef} (${candidate.reason})`);
    }
  }
  lines.push("", "## Privacy", "", "- Report contains safe internal refs and counts only.");
  return lines.join("\n");
}

export function parseStage8D8FArgs(argv = process.argv.slice(2)) {
  const args = {
    input: DEFAULT_INPUT,
    output: null,
    auditOutput: null,
    dryRun: false,
    json: false,
    now: "2026-05-21T12:00:00.000Z",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") args.input = argv[++i];
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--audit-output") args.auditOutput = argv[++i];
    else if (arg === "--now") args.now = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--json") args.json = true;
    else throw new Stage8D8FAvailabilitySyncError(`Unknown argument: ${arg}`);
  }
  return args;
}

export function runStage8D8FAvailabilitySync(options = {}) {
  const inputPath = resolve(ROOT, options.input || DEFAULT_INPUT);
  if (!existsSync(inputPath)) {
    throw new Stage8D8FAvailabilitySyncError(`Input file not found: ${options.input || DEFAULT_INPUT}`);
  }
  const report = buildAvailabilitySyncReport(readJson(inputPath), { now: options.now });
  if (options.output) writeJson(resolve(ROOT, options.output), report);
  if (options.auditOutput) writeText(resolve(ROOT, options.auditOutput), renderAvailabilitySyncReport(report));
  return {
    report,
    text: options.json ? `${JSON.stringify(report, null, 2)}\n` : renderAvailabilitySyncReport(report),
  };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage8D8FArgs(argv);
    const result = runStage8D8FAvailabilitySync(args);
    process.stdout.write(result.text.endsWith("\n") ? result.text : `${result.text}\n`);
  } catch (error) {
    if (error instanceof Stage8D8FAvailabilitySyncError) {
      console.error(`[stage8d-8f] ${error.message}`);
      if (error.details?.length) {
        for (const detail of error.details.slice(0, 10)) {
          console.error(`- ${detail.field}: ${detail.reason}`);
        }
      }
      process.exit(1);
    }
    throw error;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
