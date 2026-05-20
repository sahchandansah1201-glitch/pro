#!/usr/bin/env node
// Stage 6W · production release archive retention cycle final closure reconciliation.
// Builds an offline, redacted reconciliation package for checking that the
// Stage 6V retention cycle final closure receipt can be reconciled with the operator-owned external
// archive process. The command reads repository evidence only, performs no network calls,
// and does not approve or verify a live go-live/archive outcome.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt,
  readReleaseArchiveRetentionCycleFinalClosureReceiptManifest,
  validateReleaseArchiveRetentionCycleFinalClosureReceiptManifest,
} from "./stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-retention-cycle-final-closure-reconciliation.stage6w.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.md";
const DEFAULT_JSON_PATH = "test-results/stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.json";
const DEFAULT_NOW = "2026-05-19T16:30:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6v_release_archive_retention_cycle_final_closure_receipt",
  "stage6v_release_archive_retention_cycle_final_closure_receipt_generator",
  "stage6u_release_archive_retention_cycle_final_closure",
  "stage6t_release_archive_retention_cycle_closure_receipt",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "stage6v_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "archive_retention_cycle_final_closure_receipt_reference",
  "archive_retention_cycle_final_closure_reference",
  "external_archive_retention_cycle_final_closure_receipt_reference",
  "final_closure_receipt_reconciliation_reference",
  "retention_cycle_final_closure_reconciliation_owner_reference",
  "retention_review_window_final_closure_reconciliation_reference",
  "disposal_hold_watch_final_closure_reconciliation_reference",
  "retention_exception_register_final_closure_reconciliation_reference",
  "production_boundary",
  "next_cycle_final_closure_reconciliation_entrypoints",
];

const REQUIRED_RECONCILIATION_FIELD_KEYS = [
  "archive_retention_cycle_final_closure_reconciliation_id_reference",
  "archive_retention_cycle_final_closure_receipt_id_reference",
  "archive_retention_cycle_final_closure_id_reference",
  "final_closure_receipt_reconciliation_result_reference",
  "retention_cycle_final_closure_reconciliation_owner_reference",
  "retention_review_window_final_closure_reconciliation_reference",
  "disposal_hold_watch_final_closure_reconciliation_reference",
  "retention_exception_register_final_closure_reconciliation_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6v_ready",
  "stage6v_report",
  "stage6w_report",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "external_final_closure_reconciliation_records_stay_external",
  "external_cycle_final_closure_reconciliation_owner_recorded",
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

export class Stage6WReleaseArchiveRetentionCycleFinalClosureReconciliationError extends Error {
  constructor(details = []) {
    super("Stage 6W production release archive retention cycle final closure reconciliation failed validation.");
    this.name = "Stage6WReleaseArchiveRetentionCycleFinalClosureReconciliationError";
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
        details.push({ field: path, message: `Archive reconciliation contains forbidden value: ${code}.` });
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
    releaseArchiveRetentionCycleFinalClosureReconciliationBundledInRepository: true,
    releaseArchiveRetentionCycleFinalClosureReceiptBundledInRepository: true,
    releaseArchiveRetentionCycleFinalClosureBundledInRepository: true,
    externalArchiveReceiptStoredOutsideGit: true,
    releaseArchiveContentsStoredOutsideGit: true,
    externalArchiveReconciliationStoredOutsideGit: true,
    externalArchiveReconciliationReceiptStoredOutsideGit: true,
    externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit: true,
    externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit: true,
    externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit: true,
    archiveReceiptOutcomeKnownToRepository: false,
    archiveReconciliationOutcomeKnownToRepository: false,
    archiveRetentionCycleFinalClosureOutcomeKnownToRepository: false,
    archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository: false,
    archiveRetentionCycleFinalClosureReconciliationOutcomeKnownToRepository: false,
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
    details.push({ field: `reconciliationInputs.${index}`, message: "reconciliation input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `reconciliationInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `reconciliationInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `reconciliationInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `reconciliationInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `reconciliationSections.${index}`, message: "reconciliation section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `reconciliationSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `reconciliationSections.${index}.label`, message: "label is required." });
  return {
    key,
    label,
    required: section.required !== false,
    storeOutsideGit: section.storeOutsideGit === true,
  };
}

function normalizeReconciliationField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalReconciliationFields.${index}`, message: "reconciliation field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalReconciliationFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalReconciliationFields.${index}.label`, message: "label is required." });
  for (const property of ["required", "redacted", "storeOutsideGit"]) {
    if (field[property] !== true) {
      details.push({ field: `externalReconciliationFields.${index}.${property}`, message: "Expected true." });
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
    details.push({ field: `reconciliationGates.${index}`, message: "reconciliation gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `reconciliationGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `reconciliationGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `reconciliationGates.${index}.command`, message: "command is required." });
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
    details.push({ field: "reconciliationPolicy", message: "reconciliationPolicy is required." });
    return;
  }
  if (!Array.isArray(policy.repositoryStores) || policy.repositoryStores.length === 0) {
    details.push({ field: "reconciliationPolicy.repositoryStores", message: "repositoryStores must be non-empty." });
  }
  if (!Array.isArray(policy.repositoryMustNotStore) || policy.repositoryMustNotStore.length === 0) {
    details.push({ field: "reconciliationPolicy.repositoryMustNotStore", message: "repositoryMustNotStore must be non-empty." });
  }
  if (policy.goLiveDecisionBundledInRepository !== false) {
    details.push({ field: "reconciliationPolicy.goLiveDecisionBundledInRepository", message: "Expected false." });
  }
  if (policy.liveServerVerifiedByRepository !== false) {
    details.push({ field: "reconciliationPolicy.liveServerVerifiedByRepository", message: "Expected false." });
  }
  if (!cleanString(policy.retentionCycleFinalClosureReconciliationOwner)) {
    details.push({ field: "reconciliationPolicy.retentionCycleFinalClosureReconciliationOwner", message: "retentionCycleFinalClosureReconciliationOwner is required." });
  }
}

export function readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(rawManifest) {
  const details = [];
  if (!isPlainObject(rawManifest)) {
    throw new Stage6WReleaseArchiveRetentionCycleFinalClosureReconciliationError([{ field: "manifest", message: "manifest must be an object." }]);
  }
  const manifest = { ...rawManifest };
  if (manifest.stage !== "6W") details.push({ field: "stage", message: "Expected 6W." });
  if (manifest.packageId !== "stage6w-production-release-archive-retention-cycle-final-closure-reconciliation") {
    details.push({ field: "packageId", message: "Unexpected packageId." });
  }
  manifest.releaseArchiveRetentionCycleFinalClosureReceiptManifest = validateSafeRelativePath(
    manifest.releaseArchiveRetentionCycleFinalClosureReceiptManifest,
    "releaseArchiveRetentionCycleFinalClosureReceiptManifest",
    details,
  );
  validateBoundary(manifest.productBoundary, details);
  manifest.reconciliationInputs = Array.isArray(manifest.reconciliationInputs)
    ? manifest.reconciliationInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  manifest.reconciliationSections = Array.isArray(manifest.reconciliationSections)
    ? manifest.reconciliationSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  manifest.externalReconciliationFields = Array.isArray(manifest.externalReconciliationFields)
    ? manifest.externalReconciliationFields.map((item, index) => normalizeReconciliationField(item, index, details)).filter(Boolean)
    : [];
  manifest.reconciliationGates = Array.isArray(manifest.reconciliationGates)
    ? manifest.reconciliationGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(manifest.reconciliationInputs, REQUIRED_INPUT_KEYS, "reconciliationInputs", details);
  requireKeys(manifest.reconciliationSections, REQUIRED_SECTION_KEYS, "reconciliationSections", details);
  requireKeys(manifest.externalReconciliationFields, REQUIRED_RECONCILIATION_FIELD_KEYS, "externalReconciliationFields", details);
  requireKeys(manifest.reconciliationGates, REQUIRED_GATE_KEYS, "reconciliationGates", details);
  validatePolicy(manifest.reconciliationPolicy, details);
  scanValue(manifest, "manifest", details);
  if (details.length > 0) throw new Stage6WReleaseArchiveRetentionCycleFinalClosureReconciliationError(details);
  return manifest;
}

export function detectReleaseArchiveRetentionCycleFinalClosureReconciliationLeaks(value) {
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

export function buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliation({
  manifest = readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(),
  root = REPO_ROOT,
  generatedAt = DEFAULT_NOW,
} = {}) {
  const validated = validateReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(manifest);
  const finalClosureReceiptManifest = validateReleaseArchiveRetentionCycleFinalClosureReceiptManifest(
    readReleaseArchiveRetentionCycleFinalClosureReceiptManifest(validated.releaseArchiveRetentionCycleFinalClosureReceiptManifest),
  );
  const finalClosureReceipt = buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt({
    manifest: finalClosureReceiptManifest,
    root,
    generatedAt: finalClosureReceiptManifest.generatedAt,
  });
  const inputs = validated.reconciliationInputs.map((input) => statusForInput(root, input));
  const missingRequiredInputs = inputs.filter((input) => input.required && !input.present);
  const externalReconciliationFieldCount = validated.externalReconciliationFields.length;
  const externalReconciliationFieldsStoredOutsideGit = validated.externalReconciliationFields.every(
    (field) => field.storeOutsideGit,
  );
  const leakFindings = detectReleaseArchiveRetentionCycleFinalClosureReconciliationLeaks(validated);
  const readyForExternalReleaseArchiveRetentionCycleFinalClosureReconciliation =
    finalClosureReceipt.status === "ready" &&
    finalClosureReceipt.readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt === true &&
    missingRequiredInputs.length === 0 &&
    externalReconciliationFieldsStoredOutsideGit &&
    leakFindings.length === 0;

  return {
    stage: "6W",
    packageId: validated.packageId,
    generatedAt,
    status: readyForExternalReleaseArchiveRetentionCycleFinalClosureReconciliation ? "ready" : "blocked",
    readyForExternalReleaseArchiveRetentionCycleFinalClosureReconciliation,
    releaseArchiveRetentionCycleFinalClosureReceipt: {
      status: finalClosureReceipt.status,
      readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt:
        finalClosureReceipt.readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt,
      externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit:
        finalClosureReceipt.externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit,
      archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository:
        finalClosureReceipt.archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository,
    },
    releaseArchiveRetentionCycleFinalClosureReconciliationStoredInGit: true,
    releaseArchiveRetentionCycleFinalClosureReceiptStoredInGit: true,
    releaseArchiveRetentionCycleFinalClosureStoredInGit: true,
    externalArchiveReceiptStoredOutsideGit: validated.productBoundary.externalArchiveReceiptStoredOutsideGit,
    externalArchiveReconciliationStoredOutsideGit: validated.productBoundary.externalArchiveReconciliationStoredOutsideGit,
    externalArchiveReconciliationReceiptStoredOutsideGit:
      validated.productBoundary.externalArchiveReconciliationReceiptStoredOutsideGit,
    externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit,
    externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit,
    externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit,
    releaseArchiveContentsStoredOutsideGit: validated.productBoundary.releaseArchiveContentsStoredOutsideGit,
    archiveReceiptOutcomeKnownToRepository: validated.productBoundary.archiveReceiptOutcomeKnownToRepository,
    archiveReconciliationOutcomeKnownToRepository: validated.productBoundary.archiveReconciliationOutcomeKnownToRepository,
    archiveRetentionCycleFinalClosureOutcomeKnownToRepository:
      validated.productBoundary.archiveRetentionCycleFinalClosureOutcomeKnownToRepository,
    archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository:
      validated.productBoundary.archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository,
    archiveRetentionCycleFinalClosureReconciliationOutcomeKnownToRepository:
      validated.productBoundary.archiveRetentionCycleFinalClosureReconciliationOutcomeKnownToRepository,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveArchiveVerifiedByThisReport: false,
    externalReconciliationFieldCount,
    externalReconciliationFieldsStoredOutsideGit,
    reconciliationInputs: inputs,
    missingRequiredInputs: missingRequiredInputs.map((input) => input.key),
    reconciliationSections: validated.reconciliationSections,
    reconciliationGates: validated.reconciliationGates,
    productBoundary: validated.productBoundary,
    reconciliationPolicy: validated.reconciliationPolicy,
    leakFindings,
  };
}

export function renderProductionReleaseArchiveRetentionCycleFinalClosureReconciliationMarkdown(report) {
  const lines = [
    "# Stage 6W production release archive retention cycle final closure reconciliation",
    "",
    `- Generated at: \`${report.generatedAt}\``,
    `- Status: \`${report.status}\``,
    `- Ready for external release archive retention cycle final closure reconciliation: \`${report.readyForExternalReleaseArchiveRetentionCycleFinalClosureReconciliation}\``,
    `- Stage 6V archive retention cycle final closure receipt status: \`${report.releaseArchiveRetentionCycleFinalClosureReceipt.status}\``,
    `- Ready for external archive retention cycle final closure receipt: \`${report.releaseArchiveRetentionCycleFinalClosureReceipt.readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt}\``,
    `- Release archive retention cycle final closure reconciliation stored in git: \`${report.releaseArchiveRetentionCycleFinalClosureReconciliationStoredInGit}\``,
    `- Release archive retention cycle final closure receipt stored in git: \`${report.releaseArchiveRetentionCycleFinalClosureReceiptStoredInGit}\``,
    `- Release archive retention cycle final closure stored in git: \`${report.releaseArchiveRetentionCycleFinalClosureStoredInGit}\``,
    `- Release archive contents stored outside git: \`${report.releaseArchiveContentsStoredOutsideGit}\``,
    `- External archive receipt stored outside git: \`${report.externalArchiveReceiptStoredOutsideGit}\``,
    `- External archive reconciliation stored outside git: \`${report.externalArchiveReconciliationStoredOutsideGit}\``,
    `- External archive reconciliation receipt stored outside git: \`${report.externalArchiveReconciliationReceiptStoredOutsideGit}\``,
    `- External archive retention cycle final closure records stored outside git: \`${report.externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit}\``,
    `- External archive retention cycle final closure receipt stored outside git: \`${report.externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit}\``,
    `- External archive retention cycle final closure reconciliation stored outside git: \`${report.externalArchiveRetentionCycleFinalClosureReconciliationStoredOutsideGit}\``,
    `- Archive receipt outcome known to repository: \`${report.archiveReceiptOutcomeKnownToRepository}\``,
    `- Archive reconciliation outcome known to repository: \`${report.archiveReconciliationOutcomeKnownToRepository}\``,
    `- Archive retention cycle final closure outcome known to repository: \`${report.archiveRetentionCycleFinalClosureOutcomeKnownToRepository}\``,
    `- Archive retention cycle final closure receipt outcome known to repository: \`${report.archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository}\``,
    `- Archive retention cycle final closure reconciliation outcome known to repository: \`${report.archiveRetentionCycleFinalClosureReconciliationOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live archive verified by this report: \`${report.liveArchiveVerifiedByThisReport}\``,
    `- Leak findings: \`${report.leakFindings.length}\``,
    "",
    "## Reconciliation inputs",
    "",
  ];
  for (const input of report.reconciliationInputs) {
    lines.push(`- ${input.present ? "ok" : "missing"} \`${input.path}\` (${input.key})`);
  }
  lines.push("", "## External reconciliation fields", "");
  lines.push(`- Count: \`${report.externalReconciliationFieldCount}\``);
  lines.push(`- Stored outside git: \`${report.externalReconciliationFieldsStoredOutsideGit}\``);
  lines.push("", "## Reconciliation gates", "");
  for (const gate of report.reconciliationGates) {
    lines.push(`- \`${gate.command}\` — ${gate.label}`);
  }
  lines.push("", "## Product boundary", "");
  lines.push("- Managed runtime/database dependency: none");
  lines.push(`- Runtime calls external systems: \`${report.productBoundary.productRuntimeCallsExternalSystems}\``);
  lines.push(`- Demo fallback in production: \`${report.productBoundary.demoFallbackInProduction}\``);
  lines.push("", "## Repository policy", "");
  lines.push("- The repository stores the final closure reconciliation schema, redacted field names, gates, and safe pointers.");
  lines.push("- The repository does not store the final closure reconciliation outcome, final closure receipt values, raw archive contents, logs, metrics, credentials, backup contents, or patient-identifying content.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6WArgs(argv = process.argv.slice(2)) {
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

export function runStage6WProductionReleaseArchiveRetentionCycleFinalClosureReconciliation(options = {}) {
  const manifest = readReleaseArchiveRetentionCycleFinalClosureReconciliationManifest(options.manifest ?? DEFAULT_MANIFEST);
  const report = buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliation({
    manifest,
    root: options.root ?? REPO_ROOT,
    generatedAt: options.generatedAt ?? options.now ?? DEFAULT_NOW,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleFinalClosureReconciliationMarkdown(report);
  if (options.summaryPath) writeOutput(options.summaryPath, markdown);
  if (options.jsonOut) writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (options.dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage6WArgs(argv);
    const result = runStage6WProductionReleaseArchiveRetentionCycleFinalClosureReconciliation({
      manifest: args.manifest,
      summaryPath: args.summaryPath,
      jsonOut: args.jsonOut,
      generatedAt: args.now,
      dryRun: args.dryRun,
    });
    if (!args.dryRun && !args.summaryPath && !args.jsonOut) process.stdout.write(`${result.markdown}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[stage6w-production-release-archive-retention-cycle-final-closure-reconciliation] failed: ${error.message}`);
    if (error?.details) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
