#!/usr/bin/env node
// Stage 6V · production release archive retention cycle final closure receipt.
// Builds an offline, redacted receipt package for the Stage 6U release archive
// retention cycle final closure. The command reads repository evidence only, performs no
// network calls, and does not approve or verify a live go-live/archive outcome.
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
  buildProductionReleaseArchiveRetentionCycleFinalClosure,
  readReleaseArchiveRetentionCycleFinalClosureManifest,
  validateReleaseArchiveRetentionCycleFinalClosureManifest,
} from "./stage6u-production-release-archive-retention-cycle-final-closure.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6v-production-release-archive-retention-cycle-final-closure-receipt.md";
const DEFAULT_JSON_PATH = "test-results/stage6v-production-release-archive-retention-cycle-final-closure-receipt.json";
const DEFAULT_NOW = "2026-05-19T15:30:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6u_release_archive_retention_cycle_final_closure",
  "stage6u_release_archive_retention_cycle_final_closure_generator",
  "stage6t_release_archive_retention_cycle_closure_receipt",
  "stage6s_release_archive_retention_cycle_closure",
  "stage6r_release_archive_retention_cycle_index_receipt",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "stage6u_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "archive_retention_cycle_final_closure_reference",
  "archive_retention_cycle_closure_receipt_reference",
  "archive_retention_cycle_closure_reference",
  "archive_retention_cycle_index_receipt_reference",
  "external_archive_retention_cycle_final_closure_receipt_reference",
  "final_archive_retention_cycle_final_closure_outcome_reference",
  "retention_cycle_owner_final_closure_receipt_reference",
  "retention_review_window_final_closure_receipt_reference",
  "production_boundary",
  "next_cycle_final_closure_receipt_entrypoints",
];

const REQUIRED_RECEIPT_FIELD_KEYS = [
  "archive_retention_cycle_final_closure_receipt_id_reference",
  "archive_retention_cycle_final_closure_id_reference",
  "archive_retention_cycle_closure_receipt_id_reference",
  "archive_retention_cycle_owner_final_closure_receipt_reference",
  "retention_review_window_final_closure_receipt_reference",
  "disposal_hold_watch_final_closure_receipt_reference",
  "retention_exception_register_final_closure_receipt_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6u_ready",
  "stage6u_report",
  "stage6v_report",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "external_final_closure_receipt_records_stay_external",
  "external_cycle_final_closure_receipt_owner_recorded",
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

export class Stage6VReleaseArchiveRetentionCycleFinalClosureReceiptError extends Error {
  constructor(details = []) {
    super("Stage 6V production release archive retention cycle final closure receipt failed validation.");
    this.name = "Stage6VReleaseArchiveRetentionCycleFinalClosureReceiptError";
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
        details.push({ field: path, message: `Archive retention cycle final closure receipt contains forbidden value: ${code}.` });
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
    releaseArchiveRetentionCycleFinalClosureReceiptBundledInRepository: true,
    releaseArchiveRetentionCycleFinalClosureBundledInRepository: true,
    releaseArchiveReconciliationReceiptBundledInRepository: true,
    releaseArchiveReconciliationBundledInRepository: true,
    archiveHandoffReceiptBundledInRepository: true,
    externalArchiveReceiptStoredOutsideGit: true,
    releaseArchiveContentsStoredOutsideGit: true,
    externalArchiveReconciliationStoredOutsideGit: true,
    externalArchiveReconciliationReceiptStoredOutsideGit: true,
    externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit: true,
    externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit: true,
    archiveReceiptOutcomeKnownToRepository: false,
    archiveReconciliationOutcomeKnownToRepository: false,
    archiveRetentionCycleFinalClosureOutcomeKnownToRepository: false,
    archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository: false,
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
    details.push({ field: `receiptInputs.${index}`, message: "receipt input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `receiptInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `receiptInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `receiptInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `receiptInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `receiptSections.${index}`, message: "receipt section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `receiptSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `receiptSections.${index}.label`, message: "label is required." });
  return {
    key,
    label,
    required: section.required !== false,
    storeOutsideGit: section.storeOutsideGit === true,
  };
}

function normalizeReceiptField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalReceiptFields.${index}`, message: "receipt field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalReceiptFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalReceiptFields.${index}.label`, message: "label is required." });
  for (const property of ["required", "redacted", "storeOutsideGit"]) {
    if (field[property] !== true) {
      details.push({ field: `externalReceiptFields.${index}.${property}`, message: "Expected true." });
    }
  }
  return {
    key,
    label,
    required: field.required === true,
    redacted: field.redacted === true,
    storeOutsideGit: field.storeOutsideGit === true,
  };
}

function normalizeGate(gate, index, details) {
  if (!isPlainObject(gate)) {
    details.push({ field: `receiptGates.${index}`, message: "receipt gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `receiptGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `receiptGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `receiptGates.${index}.command`, message: "command is required." });
  return { key, label, command, required: gate.required !== false };
}

function requireKeys(items, requiredKeys, field, details) {
  const keys = new Set(items.map((item) => item?.key).filter(Boolean));
  for (const key of requiredKeys) {
    if (!keys.has(key)) details.push({ field, message: `${field} missing required key: ${key}.` });
  }
}

function validatePolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "receiptPolicy", message: "receiptPolicy is required." });
    return;
  }
  if (!Array.isArray(policy.repositoryStores) || policy.repositoryStores.length === 0) {
    details.push({ field: "receiptPolicy.repositoryStores", message: "repositoryStores must be non-empty." });
  }
  if (!Array.isArray(policy.repositoryMustNotStore) || policy.repositoryMustNotStore.length === 0) {
    details.push({ field: "receiptPolicy.repositoryMustNotStore", message: "repositoryMustNotStore must be non-empty." });
  }
  if (policy.goLiveDecisionBundledInRepository !== false) {
    details.push({ field: "receiptPolicy.goLiveDecisionBundledInRepository", message: "Expected false." });
  }
  if (policy.liveServerVerifiedByRepository !== false) {
    details.push({ field: "receiptPolicy.liveServerVerifiedByRepository", message: "Expected false." });
  }
  if (!cleanString(policy.retentionCycleFinalClosureReceiptOwner)) {
    details.push({ field: "receiptPolicy.retentionCycleFinalClosureReceiptOwner", message: "retentionCycleFinalClosureReceiptOwner is required." });
  }
}

export function readReleaseArchiveRetentionCycleFinalClosureReceiptManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveRetentionCycleFinalClosureReceiptManifest(rawManifest) {
  const details = [];
  if (!isPlainObject(rawManifest)) {
    throw new Stage6VReleaseArchiveRetentionCycleFinalClosureReceiptError([{ field: "manifest", message: "manifest must be an object." }]);
  }
  const manifest = { ...rawManifest };
  if (manifest.stage !== "6V") details.push({ field: "stage", message: "Expected 6V." });
  if (manifest.packageId !== "stage6v-production-release-archive-retention-cycle-final-closure-receipt") {
    details.push({ field: "packageId", message: "Unexpected packageId." });
  }
  manifest.releaseArchiveRetentionCycleFinalClosureManifest = validateSafeRelativePath(
    manifest.releaseArchiveRetentionCycleFinalClosureManifest,
    "releaseArchiveRetentionCycleFinalClosureManifest",
    details,
  );
  validateBoundary(manifest.productBoundary, details);
  manifest.receiptInputs = Array.isArray(manifest.receiptInputs)
    ? manifest.receiptInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  manifest.receiptSections = Array.isArray(manifest.receiptSections)
    ? manifest.receiptSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  manifest.externalReceiptFields = Array.isArray(manifest.externalReceiptFields)
    ? manifest.externalReceiptFields.map((item, index) => normalizeReceiptField(item, index, details)).filter(Boolean)
    : [];
  manifest.receiptGates = Array.isArray(manifest.receiptGates)
    ? manifest.receiptGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(manifest.receiptInputs, REQUIRED_INPUT_KEYS, "receiptInputs", details);
  requireKeys(manifest.receiptSections, REQUIRED_SECTION_KEYS, "receiptSections", details);
  requireKeys(manifest.externalReceiptFields, REQUIRED_RECEIPT_FIELD_KEYS, "externalReceiptFields", details);
  requireKeys(manifest.receiptGates, REQUIRED_GATE_KEYS, "receiptGates", details);
  validatePolicy(manifest.receiptPolicy, details);
  scanValue(manifest, "manifest", details);
  if (details.length > 0) throw new Stage6VReleaseArchiveRetentionCycleFinalClosureReceiptError(details);
  return manifest;
}

export function detectReleaseArchiveRetentionCycleFinalClosureReceiptLeaks(value) {
  const details = [];
  scanValue(value, "value", details);
  return [...new Set(details.map((item) => item.message.replace(/^.*forbidden value: /, "").replace(/\.$/, "")))];
}

function statusForInput(root, input) {
  return {
    ...input,
    present: existsSync(resolve(root, input.path)),
  };
}

export function buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt({
  manifest = readReleaseArchiveRetentionCycleFinalClosureReceiptManifest(),
  root = REPO_ROOT,
  generatedAt = DEFAULT_NOW,
} = {}) {
  const validated = validateReleaseArchiveRetentionCycleFinalClosureReceiptManifest(manifest);
  const closureManifest = validateReleaseArchiveRetentionCycleFinalClosureManifest(
    readReleaseArchiveRetentionCycleFinalClosureManifest(validated.releaseArchiveRetentionCycleFinalClosureManifest),
  );
  const finalClosure = buildProductionReleaseArchiveRetentionCycleFinalClosure({
    manifest: closureManifest,
    root,
    generatedAt: closureManifest.generatedAt,
  });
  const inputs = validated.receiptInputs.map((input) => statusForInput(root, input));
  const missingRequiredInputs = inputs.filter((input) => input.required && !input.present);
  const externalReceiptFieldCount = validated.externalReceiptFields.length;
  const externalReceiptFieldsStoredOutsideGit = validated.externalReceiptFields.every(
    (field) => field.storeOutsideGit,
  );
  const leakFindings = detectReleaseArchiveRetentionCycleFinalClosureReceiptLeaks(validated);
  const readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt =
    finalClosure.status === "ready" &&
    finalClosure.readyForExternalReleaseArchiveRetentionCycleFinalClosure === true &&
    missingRequiredInputs.length === 0 &&
    externalReceiptFieldsStoredOutsideGit &&
    leakFindings.length === 0;

  return {
    stage: "6V",
    packageId: validated.packageId,
    generatedAt,
    status: readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt ? "ready" : "blocked",
    readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt,
    releaseArchiveRetentionCycleFinalClosure: {
      status: finalClosure.status,
      readyForExternalReleaseArchiveRetentionCycleFinalClosure:
        finalClosure.readyForExternalReleaseArchiveRetentionCycleFinalClosure,
      externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit:
        finalClosure.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit,
      archiveRetentionCycleFinalClosureOutcomeKnownToRepository:
        finalClosure.archiveRetentionCycleFinalClosureOutcomeKnownToRepository,
    },
    releaseArchiveRetentionCycleFinalClosureReceiptStoredInGit: true,
    releaseArchiveRetentionCycleFinalClosureStoredInGit: true,
    releaseArchiveReconciliationReceiptStoredInGit: true,
    releaseArchiveReconciliationStoredInGit: true,
    releaseArchiveIndexStoredInGit: true,
    archiveHandoffReceiptStoredInGit: true,
    releaseArchiveContentsStoredOutsideGit: validated.productBoundary.releaseArchiveContentsStoredOutsideGit,
    externalArchiveReceiptStoredOutsideGit: validated.productBoundary.externalArchiveReceiptStoredOutsideGit,
    externalArchiveReconciliationStoredOutsideGit: validated.productBoundary.externalArchiveReconciliationStoredOutsideGit,
    externalArchiveReconciliationReceiptStoredOutsideGit:
      validated.productBoundary.externalArchiveReconciliationReceiptStoredOutsideGit,
    externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit,
    externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit,
    archiveReceiptOutcomeKnownToRepository: validated.productBoundary.archiveReceiptOutcomeKnownToRepository,
    archiveReconciliationOutcomeKnownToRepository: validated.productBoundary.archiveReconciliationOutcomeKnownToRepository,
    archiveRetentionCycleFinalClosureOutcomeKnownToRepository: validated.productBoundary.archiveRetentionCycleFinalClosureOutcomeKnownToRepository,
    archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository:
      validated.productBoundary.archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveArchiveVerifiedByThisReport: false,
    externalReceiptFieldCount,
    externalReceiptFieldsStoredOutsideGit,
    receiptInputs: inputs,
    missingRequiredInputs: missingRequiredInputs.map((input) => input.key),
    receiptSections: validated.receiptSections,
    receiptGates: validated.receiptGates,
    productBoundary: validated.productBoundary,
    receiptPolicy: validated.receiptPolicy,
    leakFindings,
  };
}

export function renderProductionReleaseArchiveRetentionCycleFinalClosureReceiptMarkdown(report) {
  const lines = [
    "# Stage 6V production release archive retention cycle final closure receipt",
    "",
    `- Generated at: \`${report.generatedAt}\``,
    `- Status: \`${report.status}\``,
    `- Ready for external release archive retention cycle final closure receipt: \`${report.readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt}\``,
    `- Stage 6U archive retention cycle final closure status: \`${report.releaseArchiveRetentionCycleFinalClosure.status}\``,
    `- Ready for external archive retention cycle final closure: \`${report.releaseArchiveRetentionCycleFinalClosure.readyForExternalReleaseArchiveRetentionCycleFinalClosure}\``,
    `- Release archive retention cycle final closure receipt stored in git: \`${report.releaseArchiveRetentionCycleFinalClosureReceiptStoredInGit}\``,
    `- Release archive retention cycle final closure stored in git: \`${report.releaseArchiveRetentionCycleFinalClosureStoredInGit}\``,
    `- Release archive reconciliation receipt stored in git: \`${report.releaseArchiveReconciliationReceiptStoredInGit}\``,
    `- Release archive reconciliation stored in git: \`${report.releaseArchiveReconciliationStoredInGit}\``,
    `- Release archive index stored in git: \`${report.releaseArchiveIndexStoredInGit}\``,
    `- Archive handoff receipt stored in git: \`${report.archiveHandoffReceiptStoredInGit}\``,
    `- Release archive contents stored outside git: \`${report.releaseArchiveContentsStoredOutsideGit}\``,
    `- External archive receipt stored outside git: \`${report.externalArchiveReceiptStoredOutsideGit}\``,
    `- External archive reconciliation stored outside git: \`${report.externalArchiveReconciliationStoredOutsideGit}\``,
    `- External archive reconciliation receipt stored outside git: \`${report.externalArchiveReconciliationReceiptStoredOutsideGit}\``,
    `- External archive retention cycle final closure records stored outside git: \`${report.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit}\``,
    `- External archive retention cycle final closure receipt stored outside git: \`${report.externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit}\``,
    `- Archive receipt outcome known to repository: \`${report.archiveReceiptOutcomeKnownToRepository}\``,
    `- Archive reconciliation outcome known to repository: \`${report.archiveReconciliationOutcomeKnownToRepository}\``,
    `- Archive retention cycle final closure outcome known to repository: \`${report.archiveRetentionCycleFinalClosureOutcomeKnownToRepository}\``,
    `- Archive retention cycle final closure receipt outcome known to repository: \`${report.archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live archive verified by this report: \`${report.liveArchiveVerifiedByThisReport}\``,
    `- Leak findings: \`${report.leakFindings.length}\``,
    "",
    "## Receipt inputs",
    "",
  ];
  for (const input of report.receiptInputs) {
    lines.push(`- ${input.present ? "ok" : "missing"} \`${input.path}\` (${input.key})`);
  }
  lines.push("", "## External receipt fields", "");
  lines.push(`- Count: \`${report.externalReceiptFieldCount}\``);
  lines.push(`- Stored outside git: \`${report.externalReceiptFieldsStoredOutsideGit}\``);
  lines.push("", "## Receipt gates", "");
  for (const gate of report.receiptGates) {
    lines.push(`- \`${gate.command}\` — ${gate.label}`);
  }
  lines.push("", "## Product boundary", "");
  lines.push("- Managed runtime/database dependency: none");
  lines.push(`- Runtime calls external systems: \`${report.productBoundary.productRuntimeCallsExternalSystems}\``);
  lines.push(`- Demo fallback in production: \`${report.productBoundary.demoFallbackInProduction}\``);
  lines.push("", "## Repository policy", "");
  lines.push("- The repository stores the retention cycle final closure receipt schema, redacted field names, gates, and safe pointers.");
  lines.push("- The repository does not store the retention cycle final closure receipt outcome, archive receipt values, reconciliation values, raw archive contents, logs, metrics, credentials, backup contents, or patient-identifying content.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6VArgs(argv = process.argv.slice(2)) {
  const parsed = {
    dryRun: false,
    manifest: DEFAULT_MANIFEST,
    summaryPath: null,
    jsonOut: null,
    now: DEFAULT_NOW,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--manifest") {
      parsed.manifest = argv[++index];
      if (!parsed.manifest) throw new Error("--manifest requires a path");
      continue;
    }
    if (arg === "--summary") {
      parsed.summaryPath = argv[++index];
      if (!parsed.summaryPath) throw new Error("--summary requires a path");
      continue;
    }
    if (arg === "--json-out") {
      parsed.jsonOut = argv[++index];
      if (!parsed.jsonOut) throw new Error("--json-out requires a path");
      continue;
    }
    if (arg === "--now") {
      parsed.now = argv[++index];
      if (!parsed.now) throw new Error("--now requires an ISO timestamp");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function runStage6VProductionReleaseArchiveRetentionCycleFinalClosureReceipt(options = {}) {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureReceiptManifest(options.manifest ?? DEFAULT_MANIFEST);
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt({
    manifest,
    root: options.root ?? REPO_ROOT,
    generatedAt: options.generatedAt ?? options.now ?? DEFAULT_NOW,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleFinalClosureReceiptMarkdown(report);
  if (options.summaryPath) writeOutput(options.summaryPath, markdown);
  if (options.jsonOut) writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (options.dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage6VArgs(argv);
    const result = runStage6VProductionReleaseArchiveRetentionCycleFinalClosureReceipt({
      manifest: args.manifest,
      summaryPath: args.summaryPath,
      jsonOut: args.jsonOut,
      generatedAt: args.now,
      dryRun: args.dryRun,
    });
    if (!args.dryRun && !args.summaryPath && !args.jsonOut) process.stdout.write(`${result.markdown}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[stage6v-production-release-archive-retention-cycle-final-closure-receipt] failed: ${error.message}`);
    if (error?.details) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
