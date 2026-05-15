#!/usr/bin/env node
// Stage 5Y · external adapter reconciliation package.
// Reconciles sanitized adapter payload items against local operator outcomes.
// It performs no network calls and never controls CRM/ad services directly.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Stage5UValidationError,
  readPayloadFile,
  summarizeExternalAdapterPayload,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";
import {
  Stage5VOpsError,
  readStatusSnapshot,
  validateStatusSnapshot,
} from "./stage5v-external-adapter-ops.mjs";
import {
  Stage5XAuditError,
  buildExternalAdapterAuditBundle,
  detectAuditBundleLeaks,
  readAuditManifest,
  validateAuditManifest,
} from "./stage5x-external-adapter-audit-package.mjs";
import {
  Stage5WIncidentError,
  readIncidentPolicy,
  validateIncidentPolicy,
} from "./stage5w-external-adapter-incident-runbook.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/integrations/adapter-reconciliation-manifest.stage5y.example.json";
const DEFAULT_NOW = "2026-05-15T10:30:00.000Z";
const OUTCOME_STATES = new Set(["accepted", "booked", "rejected", "duplicate", "pending"]);
const OUTCOME_KINDS = new Set(["booking_request", "available_slot"]);

const LEAK_PATTERNS = [
  { code: "access token", pattern: /access[_-]?token/i },
  { code: "bearer token", pattern: /authorization:\s*bearer\s+(?!<SELF_HOSTED_BEARER_TOKEN>)/i },
  { code: "storage path", pattern: new RegExp("storage" + "_object_path", "i") },
  { code: "signed url", pattern: new RegExp("signed" + "[_-]?url", "i") },
  { code: "external url", pattern: /https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/i },
  { code: "api read marker", pattern: new RegExp("api-" + "read", "i") },
  { code: "api write marker", pattern: new RegExp("api-" + "write", "i") },
  { code: "edge-function marker", pattern: new RegExp("edge" + " function", "i") },
  { code: "managed env", pattern: new RegExp("SUP" + "ABASE_") },
  { code: "patient identity", pattern: /patient[_-]?full[_-]?name|fullName/i },
];

export class Stage5YReconciliationError extends Error {
  constructor(details = []) {
    super("Stage 5Y external adapter reconciliation package failed validation.");
    this.name = "Stage5YReconciliationError";
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
  if (!existsSync(absolutePath)) throw new Error(`File not found: ${path}`);
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`File must contain valid JSON: ${path}: ${error.message}`);
  }
}

function validateSafeRelativePath(value, field, details) {
  const cleaned = cleanString(value);
  if (!cleaned) {
    details.push({ field, message: `${field} is required.` });
    return "";
  }
  if (cleaned.startsWith("/") || cleaned.includes("..") || /[\r\n]/.test(cleaned)) {
    details.push({ field, message: `${field} must be a safe relative path.` });
  }
  return cleaned;
}

function validateBooleanFalse(value, field, details) {
  if (value !== false) details.push({ field, message: `${field} must be false.` });
}

function validateNone(value, field, details) {
  if (String(value || "") !== "none") details.push({ field, message: `${field} must be none.` });
}

function scanManifestValue(value, path, details) {
  if (value == null) return;
  if (typeof value === "string") {
    for (const { code, pattern } of LEAK_PATTERNS) {
      if (pattern.test(value)) {
        details.push({ field: path, message: `Reconciliation manifest contains forbidden value: ${code}.` });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanManifestValue(item, `${path}.${index}`, details));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      scanManifestValue(key, `${path}.${key}`, details);
      scanManifestValue(item, `${path}.${key}`, details);
    }
  }
}

function normalizeOutcome(item, index, details) {
  if (!isPlainObject(item)) {
    details.push({ field: `outcomes.${index}`, message: "Outcome must be an object." });
    return null;
  }
  const outcome = {
    externalId: cleanString(item.externalId),
    kind: cleanString(item.kind),
    state: cleanString(item.state),
    localRecord: cleanString(item.localRecord) || "local-record",
  };
  if (!outcome.externalId) details.push({ field: `outcomes.${index}.externalId`, message: "externalId is required." });
  if (!OUTCOME_KINDS.has(outcome.kind)) {
    details.push({ field: `outcomes.${index}.kind`, message: "kind must be booking_request or available_slot." });
  }
  if (!OUTCOME_STATES.has(outcome.state)) {
    details.push({ field: `outcomes.${index}.state`, message: "state must be accepted, booked, rejected, duplicate, or pending." });
  }
  return outcome;
}

export function readReconciliationManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReconciliationManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage5YReconciliationError([{ field: "manifest", message: "Reconciliation manifest must be a JSON object." }]);
  }
  const details = [];
  scanManifestValue(input, "manifest", details);
  const outcomes = Array.isArray(input.outcomes)
    ? input.outcomes.map((item, index) => normalizeOutcome(item, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(input.outcomes) || input.outcomes.length === 0) {
    details.push({ field: "outcomes", message: "At least one outcome is required." });
  }
  const manifest = {
    sourceSystem: cleanString(input.sourceSystem) || "other",
    caseId: cleanString(input.caseId) || "stage5y-reconciliation",
    generatedAt: cleanString(input.generatedAt) || DEFAULT_NOW,
    payloadFile: validateSafeRelativePath(input.payloadFile, "payloadFile", details),
    statusFile: validateSafeRelativePath(input.statusFile, "statusFile", details),
    auditManifestFile: validateSafeRelativePath(input.auditManifestFile, "auditManifestFile", details),
    outputDir: validateSafeRelativePath(input.outputDir, "outputDir", details),
    outcomes,
    productRuntimeCallsExternalSystems: false,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
  };
  validateBooleanFalse(input.productRuntimeCallsExternalSystems, "productRuntimeCallsExternalSystems", details);
  validateNone(input.managedRuntimeDependency, "managedRuntimeDependency", details);
  validateNone(input.managedDatabaseDependency, "managedDatabaseDependency", details);
  const generatedAt = new Date(manifest.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  if (details.length > 0) throw new Stage5YReconciliationError(details);
  return manifest;
}

export function detectReconciliationLeaks(text) {
  const localLeaks = [];
  for (const { code, pattern } of LEAK_PATTERNS) {
    if (pattern.test(text)) localLeaks.push(code);
  }
  const auditLeaks = detectAuditBundleLeaks(text).map((code) => code.replace(/-/g, " "));
  return [...new Set([...localLeaks, ...auditLeaks])];
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function countByState(records) {
  return records.reduce((counts, item) => {
    counts[item.state] = (counts[item.state] || 0) + 1;
    return counts;
  }, {
    accepted: 0,
    booked: 0,
    rejected: 0,
    duplicate: 0,
    pending: 0,
  });
}

function buildLedger({ payload, outcomes }) {
  const payloadItems = new Map(payload.items.map((item) => [item.externalId, item]));
  const seen = new Set();
  const duplicateOutcomes = new Set();
  const outcomeByExternalId = new Map();
  for (const outcome of outcomes) {
    if (seen.has(outcome.externalId)) duplicateOutcomes.add(outcome.externalId);
    seen.add(outcome.externalId);
    outcomeByExternalId.set(outcome.externalId, outcome);
  }
  const records = payload.items.map((item) => {
    const outcome = outcomeByExternalId.get(item.externalId);
    return {
      externalId: item.externalId,
      kind: item.kind,
      state: outcome?.state || "pending",
      localRecord: outcome?.localRecord || null,
      matched: Boolean(outcome),
      kindMatches: outcome ? outcome.kind === item.kind : true,
    };
  });
  const unexpectedOutcomes = outcomes
    .filter((outcome) => !payloadItems.has(outcome.externalId))
    .map((outcome) => ({
      externalId: outcome.externalId,
      kind: outcome.kind,
      state: outcome.state,
      localRecord: outcome.localRecord,
    }));
  return {
    records,
    duplicateOutcomeExternalIds: [...duplicateOutcomes],
    unexpectedOutcomes,
  };
}

export function buildExternalAdapterReconciliationPackage({
  manifest,
  payload,
  status,
  auditManifest,
  auditBundle,
  now = DEFAULT_NOW,
} = {}) {
  const payloadSummary = summarizeExternalAdapterPayload(payload);
  const ledger = buildLedger({ payload, outcomes: manifest.outcomes });
  const counts = countByState(ledger.records);
  const kindMismatchCount = ledger.records.filter((item) => !item.kindMatches).length;
  const pendingCount = ledger.records.filter((item) => item.state === "pending").length;
  const completeness = {
    allPayloadItemsAccountedFor: pendingCount === 0,
    noUnexpectedOutcomes: ledger.unexpectedOutcomes.length === 0,
    noDuplicateOutcomes: ledger.duplicateOutcomeExternalIds.length === 0,
    noKindMismatches: kindMismatchCount === 0,
    auditBundleComplete: auditBundle.gates.evidenceComplete === true,
    auditBundleClean: auditBundle.gates.noLeaksDetected === true,
  };
  const packageSummary = {
    stage: "5Y",
    caseId: manifest.caseId,
    sourceSystem: manifest.sourceSystem,
    generatedAt: now,
    payloadFile: manifest.payloadFile,
    statusFile: manifest.statusFile,
    auditManifestFile: manifest.auditManifestFile,
    payload: {
      itemCount: payloadSummary.itemCount,
      bookingRequestCount: payloadSummary.bookingRequestCount,
      availableSlotCount: payloadSummary.availableSlotCount,
    },
    outcomes: {
      acceptedCount: counts.accepted,
      bookedCount: counts.booked,
      rejectedCount: counts.rejected,
      duplicateCount: counts.duplicate,
      pendingCount,
      unexpectedOutcomeCount: ledger.unexpectedOutcomes.length,
      duplicateOutcomeCount: ledger.duplicateOutcomeExternalIds.length,
      kindMismatchCount,
    },
    statusSnapshot: {
      rejectedLast24h: status.rejectedLast24h,
      duplicateLast24h: status.duplicateLast24h,
      openBookingRequestCount: status.openBookingRequestCount,
      availableSlotCount: status.availableSlotCount,
      runtimeCallsExternalSystems: false,
      storedRawPayload: false,
      hardeningVersion: status.hardeningVersion,
    },
    audit: {
      caseId: auditManifest.caseId,
      evidenceComplete: auditBundle.gates.evidenceComplete,
      noLeaksDetected: auditBundle.gates.noLeaksDetected,
    },
    completeness,
    readyForOperatorSignoff: Object.values(completeness).every(Boolean),
    productRuntimeCallsExternalSystems: false,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
  };
  const files = [
    {
      key: "reconciliation-summary",
      file: "reconciliation-summary.json",
      contentType: "application/json",
      content: stableJson(packageSummary),
    },
    {
      key: "reconciliation-ledger",
      file: "reconciliation-ledger.json",
      contentType: "application/json",
      content: stableJson({
        stage: "5Y",
        caseId: manifest.caseId,
        records: ledger.records,
        unexpectedOutcomes: ledger.unexpectedOutcomes,
        duplicateOutcomeExternalIds: ledger.duplicateOutcomeExternalIds,
      }),
    },
    {
      key: "reconciliation-report",
      file: "reconciliation-report.md",
      contentType: "text/markdown",
      content: renderReconciliationReportMarkdown(packageSummary, ledger),
    },
  ];
  const leaks = detectReconciliationLeaks(files.map((item) => item.content).join("\n"));
  packageSummary.completeness.noLeaksDetected = leaks.length === 0;
  packageSummary.readyForOperatorSignoff = packageSummary.readyForOperatorSignoff && leaks.length === 0;
  return {
    ...packageSummary,
    files,
    leaks,
  };
}

export function renderReconciliationReportMarkdown(summary, ledger) {
  const lines = [
    "## Stage 5Y external adapter reconciliation report",
    "",
    "- Mode: offline reconciliation; no network calls were made.",
    `- Case: \`${summary.caseId}\``,
    `- Source system: \`${summary.sourceSystem}\``,
    `- Generated at: \`${summary.generatedAt}\``,
    "- Product runtime calls to CRM/ad systems: false",
    "- Managed runtime dependency: none",
    "- Managed database dependency: none",
    "",
    "### Payload coverage",
    "",
    `- Payload items: ${summary.payload.itemCount}`,
    `- Booking requests: ${summary.payload.bookingRequestCount}`,
    `- Available slots: ${summary.payload.availableSlotCount}`,
    "",
    "### Outcome counts",
    "",
    `- Accepted: ${summary.outcomes.acceptedCount}`,
    `- Booked: ${summary.outcomes.bookedCount}`,
    `- Rejected: ${summary.outcomes.rejectedCount}`,
    `- Duplicate: ${summary.outcomes.duplicateCount}`,
    `- Pending: ${summary.outcomes.pendingCount}`,
    `- Unexpected outcomes: ${summary.outcomes.unexpectedOutcomeCount}`,
    `- Duplicate outcome rows: ${summary.outcomes.duplicateOutcomeCount}`,
    `- Kind mismatches: ${summary.outcomes.kindMismatchCount}`,
    "",
    "### Gates",
    "",
  ];
  for (const [key, value] of Object.entries(summary.completeness)) {
    lines.push(`- ${key}: ${value ? "yes" : "no"}`);
  }
  lines.push(
    `- readyForOperatorSignoff: ${summary.readyForOperatorSignoff ? "yes" : "no"}`,
    "",
    "### Ledger",
    "",
  );
  for (const record of ledger.records) {
    lines.push(`- ${record.externalId}: ${record.kind} -> ${record.state}`);
  }
  if (ledger.unexpectedOutcomes.length > 0) {
    lines.push("", "### Unexpected outcomes", "");
    for (const outcome of ledger.unexpectedOutcomes) {
      lines.push(`- ${outcome.externalId}: ${outcome.kind} -> ${outcome.state}`);
    }
  }
  lines.push(
    "",
    "### Boundary",
    "",
    "- CRM/ad adapters remain outside product runtime.",
    "- The self-hosted backend owns accepted local state.",
    "- Attach this report with the Stage 5X audit bundle for operator signoff.",
  );
  return `${lines.join("\n")}\n`;
}

function writePackage(outputDir, pkg) {
  const absoluteOutputDir = resolve(outputDir);
  mkdirSync(absoluteOutputDir, { recursive: true });
  for (const file of pkg.files) {
    writeFileSync(join(absoluteOutputDir, file.file), file.content);
  }
}

export function parseArgs(argv = []) {
  const parsed = {
    manifest: DEFAULT_MANIFEST,
    outputDir: null,
    now: null,
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
    if (["--manifest", "--output-dir", "--now"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      const key = {
        "--manifest": "manifest",
        "--output-dir": "outputDir",
        "--now": "now",
      }[arg];
      parsed[key] = value;
      index += 1;
      continue;
    }
    let matchedPrefix = false;
    for (const [prefix, key] of [
      ["--manifest=", "manifest"],
      ["--output-dir=", "outputDir"],
      ["--now=", "now"],
    ]) {
      if (arg.startsWith(prefix)) {
        parsed[key] = arg.slice(prefix.length);
        matchedPrefix = true;
        break;
      }
    }
    if (matchedPrefix) continue;
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function renderCliSummary(pkg) {
  const lines = [
    "[stage5y-external-adapter-reconciliation-package] OK",
    `case=${pkg.caseId}`,
    `files=${pkg.files.length}`,
    `readyForOperatorSignoff=${pkg.readyForOperatorSignoff}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const manifest = validateReconciliationManifest(readReconciliationManifest(args.manifest));
    const payload = validateExternalAdapterPayload(readPayloadFile(manifest.payloadFile));
    const status = validateStatusSnapshot(readStatusSnapshot(manifest.statusFile));
    const auditManifest = validateAuditManifest(readAuditManifest(manifest.auditManifestFile));
    const policy = validateIncidentPolicy(readIncidentPolicy(auditManifest.policyFile));
    const auditPayload = validateExternalAdapterPayload(readPayloadFile(auditManifest.payloadFile));
    const auditStatus = validateStatusSnapshot(readStatusSnapshot(auditManifest.statusFile));
    const auditBundle = buildExternalAdapterAuditBundle({
      manifest: auditManifest,
      payload: auditPayload,
      status: auditStatus,
      policy,
      now: auditManifest.generatedAt,
    });
    const pkg = buildExternalAdapterReconciliationPackage({
      manifest,
      payload,
      status,
      auditManifest,
      auditBundle,
      now: args.now || manifest.generatedAt,
    });
    if (pkg.leaks.length > 0) {
      throw new Stage5YReconciliationError(pkg.leaks.map((code) => ({
        field: "package",
        message: `Reconciliation output contains forbidden value: ${code}.`,
      })));
    }
    const outputDir = args.outputDir || manifest.outputDir;
    if (outputDir) writePackage(outputDir, pkg);
    process.stdout.write(args.json ? stableJson({
      stage: pkg.stage,
      caseId: pkg.caseId,
      files: pkg.files.map((item) => item.file),
      readyForOperatorSignoff: pkg.readyForOperatorSignoff,
      completeness: pkg.completeness,
    }) : renderCliSummary(pkg));
    return 0;
  } catch (error) {
    if (
      error instanceof Stage5UValidationError ||
      error instanceof Stage5VOpsError ||
      error instanceof Stage5WIncidentError ||
      error instanceof Stage5XAuditError ||
      error instanceof Stage5YReconciliationError
    ) {
      console.error("[stage5y-external-adapter-reconciliation-package] validation failed");
      for (const detail of error.details || []) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage5y-external-adapter-reconciliation-package] ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
