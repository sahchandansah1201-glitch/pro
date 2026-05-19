#!/usr/bin/env node
// Stage 6Q · production release archive retention cycle index.
// Builds an offline, redacted index for the next release archive retention
// cycle on top of the Stage 6P retention register receipt. The command reads
// repository evidence only, performs no network calls, and does not store live
// archive retention cycle values.
// Guard marker: no network calls.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProductionReleaseArchiveRetentionRegisterReceipt,
  readReleaseArchiveRetentionRegisterReceiptManifest,
  validateReleaseArchiveRetentionRegisterReceiptManifest,
} from "./stage6p-production-release-archive-retention-register-receipt.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-retention-cycle-index.stage6q.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6q-production-release-archive-retention-cycle-index.md";
const DEFAULT_JSON_PATH = "test-results/stage6q-production-release-archive-retention-cycle-index.json";
const DEFAULT_NOW = "2026-05-19T13:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6p_release_archive_retention_register_receipt",
  "stage6p_release_archive_retention_register_receipt_generator",
  "stage6o_release_archive_retention_register",
  "stage6i_release_archive_index",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "stage6p_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "archive_index_reference",
  "archive_retention_register_reference",
  "archive_retention_register_receipt_reference",
  "external_archive_retention_cycle_index_reference",
  "retention_review_cadence_reference",
  "disposal_hold_watch_reference",
  "retention_owner_roster_reference",
  "retention_exception_register_reference",
  "production_boundary",
  "next_cycle_entrypoints",
];

const REQUIRED_CYCLE_FIELD_KEYS = [
  "archive_retention_cycle_index_id_reference",
  "next_retention_review_window_reference",
  "retention_cycle_owner_reference",
  "disposal_hold_watch_reference",
  "retention_exception_register_reference",
  "archive_disposition_authority_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6p_ready",
  "stage6p_report",
  "stage6q_report",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "external_cycle_records_stay_external",
  "external_cycle_owner_recorded",
];

const LEAK_PATTERNS = [
  { code: "access token", pattern: new RegExp("access" + "[_-]?token", "i") },
  { code: "bearer token", pattern: /authorization:\s*bearer\s+(?!<SELF_HOSTED_BEARER_TOKEN>)/i },
  { code: "cookie", pattern: /\bcookie\s*:/i },
  { code: "password", pattern: /password\s*[:=]\s*[^<\s]/i },
  { code: "storage path", pattern: new RegExp("storage" + "_object_path", "i") },
  { code: "signed url", pattern: new RegExp("signed" + "[_-]?url", "i") },
  { code: "managed api read", pattern: new RegExp("api-" + "read", "i") },
  { code: "managed api write", pattern: new RegExp("api-" + "write", "i") },
  { code: "managed function marker", pattern: new RegExp("edge" + " function", "i") },
  { code: "managed env", pattern: new RegExp("SUP" + "ABASE_") },
  { code: "patient identity", pattern: new RegExp("patient" + "[_-]?full[_-]?name|fullName", "i") },
  { code: "external url", pattern: /https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/)|github\.com\/sahchandansah1201-glitch\/pro)/i },
];

export class Stage6QReleaseArchiveRetentionCycleIndexError extends Error {
  constructor(details = []) {
    super("Stage 6Q production release archive retention cycle index failed validation.");
    this.name = "Stage6QReleaseArchiveRetentionCycleIndexError";
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
  const absolutePath = resolve(REPO_ROOT, path);
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

function scanValue(value, path, details) {
  if (value == null) return;
  if (typeof value === "string") {
    for (const { code, pattern } of LEAK_PATTERNS) {
      if (pattern.test(value)) {
        details.push({ field: path, message: `Archive retention cycle index contains forbidden value: ${code}.` });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, `${path}.${index}`, details));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      scanValue(key, `${path}.${key}`, details);
      scanValue(item, `${path}.${key}`, details);
    }
  }
}

function validateBoundary(boundary, details) {
  if (!isPlainObject(boundary)) {
    details.push({ field: "productBoundary", message: "productBoundary is required." });
    return;
  }
  const expected = {
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
    productRuntimeCallsExternalSystems: false,
    demoFallbackInProduction: false,
    releaseArchiveRetentionCycleIndexBundledInRepository: true,
    releaseArchiveRetentionRegisterReceiptBundledInRepository: true,
    releaseArchiveRetentionRegisterBundledInRepository: true,
    releaseArchiveReconciliationReceiptBundledInRepository: true,
    releaseArchiveReconciliationBundledInRepository: true,
    archiveHandoffReceiptBundledInRepository: true,
    externalArchiveReceiptStoredOutsideGit: true,
    releaseArchiveContentsStoredOutsideGit: true,
    externalArchiveReconciliationStoredOutsideGit: true,
    externalArchiveReconciliationReceiptStoredOutsideGit: true,
    externalArchiveRetentionRecordsStoredOutsideGit: true,
    externalArchiveRetentionRegisterReceiptStoredOutsideGit: true,
    externalArchiveRetentionCycleRecordsStoredOutsideGit: true,
    archiveReceiptOutcomeKnownToRepository: false,
    archiveReconciliationOutcomeKnownToRepository: false,
    archiveRetentionOutcomeKnownToRepository: false,
    archiveRetentionRegisterReceiptOutcomeKnownToRepository: false,
    archiveRetentionCycleOutcomeKnownToRepository: false,
    liveServerGoLiveVerifiedByRepository: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (boundary[key] !== value) {
      details.push({ field: `productBoundary.${key}`, message: `Expected ${String(value)}.` });
    }
  }
  for (const key of ["deployment", "frontend", "backend", "database", "objectStorage", "worker"]) {
    if (!cleanString(boundary[key])) details.push({ field: `productBoundary.${key}`, message: `${key} is required.` });
  }
}

function normalizeInput(input, index, details) {
  if (!isPlainObject(input)) {
    details.push({ field: `cycleInputs.${index}`, message: "cycle input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `cycleInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `cycleInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `cycleInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `cycleInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `cycleSections.${index}`, message: "cycle section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `cycleSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `cycleSections.${index}.label`, message: "label is required." });
  return {
    key,
    label,
    required: section.required !== false,
    storeOutsideGit: section.storeOutsideGit === true,
  };
}

function normalizeExternalField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalCycleFields.${index}`, message: "external cycle field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalCycleFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalCycleFields.${index}.label`, message: "label is required." });
  if (field.redacted !== true) {
    details.push({ field: `externalCycleFields.${index}.redacted`, message: "external cycle field must be redacted." });
  }
  if (field.storeOutsideGit !== true) {
    details.push({
      field: `externalCycleFields.${index}.storeOutsideGit`,
      message: "external cycle field must be stored outside git.",
    });
  }
  return {
    key,
    label,
    required: field.required !== false,
    redacted: field.redacted === true,
    storeOutsideGit: field.storeOutsideGit === true,
  };
}

function normalizeGate(gate, index, details) {
  if (!isPlainObject(gate)) {
    details.push({ field: `cycleGates.${index}`, message: "cycle gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `cycleGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `cycleGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `cycleGates.${index}.command`, message: "command is required." });
  return { key, label, command, required: gate.required !== false };
}

function requireKeys(items, keys, field, details) {
  const available = new Set(items.map((item) => item?.key).filter(Boolean));
  for (const key of keys) {
    if (!available.has(key)) details.push({ field, message: `${field} missing required key: ${key}` });
  }
}

function validateCyclePolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "cyclePolicy", message: "cyclePolicy is required." });
    return;
  }
  for (const field of ["repositoryStores", "repositoryMustNotStore"]) {
    if (!Array.isArray(policy[field]) || policy[field].length === 0) {
      details.push({ field: `cyclePolicy.${field}`, message: `${field} must be a non-empty array.` });
    }
  }
  if (policy.goLiveDecisionBundledInRepository !== false) {
    details.push({ field: "cyclePolicy.goLiveDecisionBundledInRepository", message: "go-live decision must stay outside git." });
  }
  if (policy.liveServerVerifiedByRepository !== false) {
    details.push({ field: "cyclePolicy.liveServerVerifiedByRepository", message: "live server verification must stay outside git." });
  }
  if (policy.nextStageHypothesis !== "Stage 6R") {
    details.push({ field: "cyclePolicy.nextStageHypothesis", message: "nextStageHypothesis must be Stage 6R." });
  }
}

export function readReleaseArchiveRetentionCycleIndexManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveRetentionCycleIndexManifest(manifest) {
  const details = [];
  if (!isPlainObject(manifest)) {
    throw new Stage6QReleaseArchiveRetentionCycleIndexError([{ field: "manifest", message: "Manifest must be an object." }]);
  }
  if (manifest.stage !== "6Q") details.push({ field: "stage", message: "stage must be 6Q." });
  if (manifest.packageId !== "stage6q-production-release-archive-retention-cycle-index") {
    details.push({ field: "packageId", message: "Unexpected Stage 6Q package id." });
  }
  validateSafeRelativePath(
    manifest.releaseArchiveRetentionRegisterReceiptManifest,
    "releaseArchiveRetentionRegisterReceiptManifest",
    details,
  );
  validateBoundary(manifest.productBoundary, details);
  const cycleInputs = Array.isArray(manifest.cycleInputs)
    ? manifest.cycleInputs.map((input, index) => normalizeInput(input, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(manifest.cycleInputs)) details.push({ field: "cycleInputs", message: "cycleInputs must be an array." });
  requireKeys(cycleInputs, REQUIRED_INPUT_KEYS, "cycleInputs", details);
  const cycleSections = Array.isArray(manifest.cycleSections)
    ? manifest.cycleSections.map((section, index) => normalizeSection(section, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(manifest.cycleSections)) details.push({ field: "cycleSections", message: "cycleSections must be an array." });
  requireKeys(cycleSections, REQUIRED_SECTION_KEYS, "cycleSections", details);
  const externalCycleFields = Array.isArray(manifest.externalCycleFields)
    ? manifest.externalCycleFields.map((field, index) => normalizeExternalField(field, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(manifest.externalCycleFields)) {
    details.push({ field: "externalCycleFields", message: "externalCycleFields must be an array." });
  }
  requireKeys(externalCycleFields, REQUIRED_CYCLE_FIELD_KEYS, "externalCycleFields", details);
  const cycleGates = Array.isArray(manifest.cycleGates)
    ? manifest.cycleGates.map((gate, index) => normalizeGate(gate, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(manifest.cycleGates)) details.push({ field: "cycleGates", message: "cycleGates must be an array." });
  requireKeys(cycleGates, REQUIRED_GATE_KEYS, "cycleGates", details);
  validateCyclePolicy(manifest.cyclePolicy, details);
  scanValue(manifest, "manifest", details);
  if (details.length > 0) throw new Stage6QReleaseArchiveRetentionCycleIndexError(details);
  return { ...manifest, cycleInputs, cycleSections, externalCycleFields, cycleGates };
}

export function detectReleaseArchiveRetentionCycleIndexLeaks(value) {
  const findings = [];
  if (typeof value !== "string") return findings;
  for (const { code, pattern } of LEAK_PATTERNS) {
    if (pattern.test(value)) findings.push(code);
  }
  return findings;
}

function inputPresence(inputs, root) {
  return inputs.map((input) => ({
    ...input,
    present: existsSync(resolve(root, input.path)),
  }));
}

export function buildProductionReleaseArchiveRetentionCycleIndex({
  manifest = readReleaseArchiveRetentionCycleIndexManifest(),
  root = REPO_ROOT,
  generatedAt = DEFAULT_NOW,
} = {}) {
  const normalized = validateReleaseArchiveRetentionCycleIndexManifest(manifest);
  const retentionRegisterReceiptManifest = validateReleaseArchiveRetentionRegisterReceiptManifest(
    readReleaseArchiveRetentionRegisterReceiptManifest(normalized.releaseArchiveRetentionRegisterReceiptManifest),
  );
  const retentionRegisterReceipt = buildProductionReleaseArchiveRetentionRegisterReceipt({
    manifest: retentionRegisterReceiptManifest,
    root,
    generatedAt: retentionRegisterReceiptManifest.generatedAt,
  });
  const cycleInputs = inputPresence(normalized.cycleInputs, root);
  const missingInputs = cycleInputs.filter((input) => input.required && !input.present);
  const leakFindings = detectReleaseArchiveRetentionCycleIndexLeaks(JSON.stringify(normalized));
  const readyForExternalReleaseArchiveRetentionCycleIndex =
    retentionRegisterReceipt.status === "ready" &&
    retentionRegisterReceipt.readyForExternalReleaseArchiveRetentionRegisterReceipt === true &&
    missingInputs.length === 0 &&
    normalized.externalCycleFields.every((field) => field.storeOutsideGit === true && field.redacted === true) &&
    leakFindings.length === 0;

  return {
    stage: "6Q",
    packageId: normalized.packageId,
    generatedAt,
    status: readyForExternalReleaseArchiveRetentionCycleIndex ? "ready" : "blocked",
    readyForExternalReleaseArchiveRetentionCycleIndex,
    releaseArchiveRetentionRegisterReceipt: {
      status: retentionRegisterReceipt.status,
      readyForExternalReleaseArchiveRetentionRegisterReceipt:
        retentionRegisterReceipt.readyForExternalReleaseArchiveRetentionRegisterReceipt === true,
    },
    releaseArchiveRetentionCycleIndexStoredInGit: normalized.productBoundary.releaseArchiveRetentionCycleIndexBundledInRepository === true,
    releaseArchiveRetentionRegisterReceiptStoredInGit:
      normalized.productBoundary.releaseArchiveRetentionRegisterReceiptBundledInRepository === true,
    releaseArchiveRetentionRegisterStoredInGit: normalized.productBoundary.releaseArchiveRetentionRegisterBundledInRepository === true,
    releaseArchiveReconciliationReceiptStoredInGit:
      normalized.productBoundary.releaseArchiveReconciliationReceiptBundledInRepository === true,
    releaseArchiveReconciliationStoredInGit:
      normalized.productBoundary.releaseArchiveReconciliationBundledInRepository === true,
    releaseArchiveIndexStoredInGit: true,
    archiveHandoffReceiptStoredInGit: normalized.productBoundary.archiveHandoffReceiptBundledInRepository === true,
    releaseArchiveContentsStoredOutsideGit: normalized.productBoundary.releaseArchiveContentsStoredOutsideGit === true,
    externalArchiveReceiptStoredOutsideGit: normalized.productBoundary.externalArchiveReceiptStoredOutsideGit === true,
    externalArchiveReconciliationStoredOutsideGit: normalized.productBoundary.externalArchiveReconciliationStoredOutsideGit === true,
    externalArchiveReconciliationReceiptStoredOutsideGit:
      normalized.productBoundary.externalArchiveReconciliationReceiptStoredOutsideGit === true,
    externalArchiveRetentionRecordsStoredOutsideGit:
      normalized.productBoundary.externalArchiveRetentionRecordsStoredOutsideGit === true,
    externalArchiveRetentionRegisterReceiptStoredOutsideGit:
      normalized.productBoundary.externalArchiveRetentionRegisterReceiptStoredOutsideGit === true,
    externalArchiveRetentionCycleRecordsStoredOutsideGit:
      normalized.productBoundary.externalArchiveRetentionCycleRecordsStoredOutsideGit === true,
    archiveReceiptOutcomeKnownToRepository: normalized.productBoundary.archiveReceiptOutcomeKnownToRepository === true,
    archiveReconciliationOutcomeKnownToRepository: normalized.productBoundary.archiveReconciliationOutcomeKnownToRepository === true,
    archiveRetentionOutcomeKnownToRepository: normalized.productBoundary.archiveRetentionOutcomeKnownToRepository === true,
    archiveRetentionRegisterReceiptOutcomeKnownToRepository:
      normalized.productBoundary.archiveRetentionRegisterReceiptOutcomeKnownToRepository === true,
    archiveRetentionCycleOutcomeKnownToRepository: normalized.productBoundary.archiveRetentionCycleOutcomeKnownToRepository === true,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveArchiveVerifiedByThisReport: false,
    cycleInputs,
    missingInputs,
    cycleSections: normalized.cycleSections,
    externalCycleFields: normalized.externalCycleFields,
    cycleGates: normalized.cycleGates,
    productBoundary: normalized.productBoundary,
    cyclePolicy: normalized.cyclePolicy,
    leakFindings,
  };
}

export function renderProductionReleaseArchiveRetentionCycleIndexMarkdown(report) {
  const lines = [
    "# Stage 6Q production release archive retention cycle index",
    "",
    `- Generated at: \`${report.generatedAt}\``,
    `- Status: \`${report.status}\``,
    `- Ready for external release archive retention cycle index: \`${report.readyForExternalReleaseArchiveRetentionCycleIndex}\``,
    `- Stage 6P retention register receipt status: \`${report.releaseArchiveRetentionRegisterReceipt.status}\``,
    `- Ready for external retention register receipt: \`${report.releaseArchiveRetentionRegisterReceipt.readyForExternalReleaseArchiveRetentionRegisterReceipt}\``,
    `- Release archive retention cycle index stored in git: \`${report.releaseArchiveRetentionCycleIndexStoredInGit}\``,
    `- Release archive retention register receipt stored in git: \`${report.releaseArchiveRetentionRegisterReceiptStoredInGit}\``,
    `- Release archive retention register stored in git: \`${report.releaseArchiveRetentionRegisterStoredInGit}\``,
    `- Release archive reconciliation receipt stored in git: \`${report.releaseArchiveReconciliationReceiptStoredInGit}\``,
    `- Release archive reconciliation stored in git: \`${report.releaseArchiveReconciliationStoredInGit}\``,
    `- Release archive index stored in git: \`${report.releaseArchiveIndexStoredInGit}\``,
    `- Archive handoff receipt stored in git: \`${report.archiveHandoffReceiptStoredInGit}\``,
    `- Release archive contents stored outside git: \`${report.releaseArchiveContentsStoredOutsideGit}\``,
    `- External archive receipt stored outside git: \`${report.externalArchiveReceiptStoredOutsideGit}\``,
    `- External archive reconciliation stored outside git: \`${report.externalArchiveReconciliationStoredOutsideGit}\``,
    `- External archive reconciliation receipt stored outside git: \`${report.externalArchiveReconciliationReceiptStoredOutsideGit}\``,
    `- External archive retention records stored outside git: \`${report.externalArchiveRetentionRecordsStoredOutsideGit}\``,
    `- External archive retention register receipt stored outside git: \`${report.externalArchiveRetentionRegisterReceiptStoredOutsideGit}\``,
    `- External archive retention cycle records stored outside git: \`${report.externalArchiveRetentionCycleRecordsStoredOutsideGit}\``,
    `- Archive receipt outcome known to repository: \`${report.archiveReceiptOutcomeKnownToRepository}\``,
    `- Archive reconciliation outcome known to repository: \`${report.archiveReconciliationOutcomeKnownToRepository}\``,
    `- Archive retention outcome known to repository: \`${report.archiveRetentionOutcomeKnownToRepository}\``,
    `- Archive retention register receipt outcome known to repository: \`${report.archiveRetentionRegisterReceiptOutcomeKnownToRepository}\``,
    `- Archive retention cycle outcome known to repository: \`${report.archiveRetentionCycleOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live archive verified by this report: \`${report.liveArchiveVerifiedByThisReport}\``,
    `- Leak findings: \`${report.leakFindings.length}\``,
    "",
    "## Cycle inputs",
    "",
  ];
  for (const input of report.cycleInputs) {
    lines.push(`- ${input.present ? "ok" : "missing"} \`${input.path}\` (${input.key})`);
  }
  lines.push("", "## External cycle fields", "");
  lines.push(`- Count: \`${report.externalCycleFields.length}\``);
  lines.push(`- Stored outside git: \`${report.externalCycleFields.every((field) => field.storeOutsideGit === true)}\``);
  lines.push("", "## Cycle gates", "");
  for (const gate of report.cycleGates) {
    lines.push(`- \`${gate.command}\` — ${gate.label}`);
  }
  lines.push("", "## Product boundary", "");
  lines.push(`- Managed runtime/database dependency: ${report.productBoundary.managedRuntimeDependency}`);
  lines.push(`- Runtime calls external systems: \`${report.productBoundary.productRuntimeCallsExternalSystems}\``);
  lines.push(`- Demo fallback in production: \`${report.productBoundary.demoFallbackInProduction}\``);
  lines.push("", "## Repository policy", "");
  lines.push("- The repository stores the retention cycle index schema, redacted field names, gates, and safe pointers.");
  lines.push("- The repository does not store retention cycle values, review windows, owner rosters, disposal holds, exception registers, live logs, metrics, credentials, backup contents, archive contents, or patient-identifying content.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6QArgs(argv = process.argv.slice(2)) {
  const parsed = {
    dryRun: false,
    manifest: DEFAULT_MANIFEST,
    summaryPath: DEFAULT_SUMMARY_PATH,
    jsonOut: DEFAULT_JSON_PATH,
    now: DEFAULT_NOW,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (["--manifest", "--summary", "--json-out", "--now"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === "--manifest") parsed.manifest = value;
      if (arg === "--summary") parsed.summaryPath = value;
      if (arg === "--json-out") parsed.jsonOut = value;
      if (arg === "--now") parsed.now = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

export function runStage6QProductionReleaseArchiveRetentionCycleIndex({
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt = DEFAULT_NOW,
  dryRun = false,
} = {}) {
  const report = buildProductionReleaseArchiveRetentionCycleIndex({
    manifest: readReleaseArchiveRetentionCycleIndexManifest(manifestPath),
    root: REPO_ROOT,
    generatedAt,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleIndexMarkdown(report);
  if (dryRun) process.stdout.write(`${markdown}\n`);
  if (summaryPath) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, markdown);
  }
  if (jsonOut) {
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }
  return { ok: report.status === "ready", report, markdown };
}

export function main() {
  try {
    const args = parseStage6QArgs();
    const result = runStage6QProductionReleaseArchiveRetentionCycleIndex({
      manifestPath: args.manifest,
      summaryPath: args.summaryPath,
      jsonOut: args.jsonOut,
      generatedAt: args.now,
      dryRun: args.dryRun,
    });
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[stage6q] ${error.message}`);
    if (Array.isArray(error.details)) {
      for (const detail of error.details) {
        console.error(`- ${detail.field}: ${detail.message}`);
      }
    }
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
