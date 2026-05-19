#!/usr/bin/env node
// Stage 6R · production release archive retention cycle index receipt.
// Builds an offline, redacted receipt package for the Stage 6Q release archive
// retention cycle index. The command reads repository evidence only, performs
// no network calls, and does not store live archive retention cycle values.
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
  buildProductionReleaseArchiveRetentionCycleIndex,
  readReleaseArchiveRetentionCycleIndexManifest,
  validateReleaseArchiveRetentionCycleIndexManifest,
} from "./stage6q-production-release-archive-retention-cycle-index.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-retention-cycle-index-receipt.stage6r.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6r-production-release-archive-retention-cycle-index-receipt.md";
const DEFAULT_JSON_PATH = "test-results/stage6r-production-release-archive-retention-cycle-index-receipt.json";
const DEFAULT_NOW = "2026-05-19T13:30:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6q_release_archive_retention_cycle_index",
  "stage6q_release_archive_retention_cycle_index_generator",
  "stage6p_release_archive_retention_register_receipt",
  "stage6o_release_archive_retention_register",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "stage6q_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "archive_retention_cycle_index_reference",
  "archive_retention_register_receipt_reference",
  "external_archive_retention_cycle_index_receipt_reference",
  "retention_cycle_owner_receipt_reference",
  "retention_review_window_receipt_reference",
  "disposal_hold_watch_receipt_reference",
  "retention_exception_register_receipt_reference",
  "production_boundary",
  "next_cycle_receipt_entrypoints",
];

const REQUIRED_RECEIPT_FIELD_KEYS = [
  "archive_retention_cycle_index_receipt_id_reference",
  "archive_retention_cycle_index_id_reference",
  "archive_retention_cycle_owner_signoff_receipt_reference",
  "retention_review_window_receipt_reference",
  "disposal_hold_watch_receipt_reference",
  "retention_exception_register_receipt_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6q_ready",
  "stage6q_report",
  "stage6r_report",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "external_receipt_contents_stay_external",
  "external_cycle_index_receipt_owner_recorded",
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

export class Stage6RReleaseArchiveRetentionCycleIndexReceiptError extends Error {
  constructor(details = []) {
    super("Stage 6R production release archive retention cycle index receipt failed validation.");
    this.name = "Stage6RReleaseArchiveRetentionCycleIndexReceiptError";
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
        details.push({ field: path, message: `Archive retention cycle index receipt contains forbidden value: ${code}.` });
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
    releaseArchiveRetentionCycleIndexReceiptBundledInRepository: true,
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
    externalArchiveRetentionCycleIndexReceiptStoredOutsideGit: true,
    archiveReceiptOutcomeKnownToRepository: false,
    archiveReconciliationOutcomeKnownToRepository: false,
    archiveRetentionOutcomeKnownToRepository: false,
    archiveRetentionRegisterReceiptOutcomeKnownToRepository: false,
    archiveRetentionCycleOutcomeKnownToRepository: false,
    archiveRetentionCycleIndexReceiptOutcomeKnownToRepository: false,
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

function normalizeExternalField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalReceiptFields.${index}`, message: "external receipt field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalReceiptFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalReceiptFields.${index}.label`, message: "label is required." });
  if (field.redacted !== true) {
    details.push({ field: `externalReceiptFields.${index}.redacted`, message: "external receipt field must be redacted." });
  }
  if (field.storeOutsideGit !== true) {
    details.push({
      field: `externalReceiptFields.${index}.storeOutsideGit`,
      message: "external receipt field must be stored outside git.",
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

function requireKeys(items, keys, field, details) {
  const available = new Set(items.map((item) => item?.key).filter(Boolean));
  for (const key of keys) {
    if (!available.has(key)) details.push({ field, message: `${field} missing required key: ${key}` });
  }
}

function validateReceiptPolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "receiptPolicy", message: "receiptPolicy is required." });
    return;
  }
  for (const field of ["repositoryStores", "repositoryMustNotStore"]) {
    if (!Array.isArray(policy[field]) || policy[field].length === 0) {
      details.push({ field: `receiptPolicy.${field}`, message: `${field} must be a non-empty array.` });
    }
  }
  if (policy.goLiveDecisionBundledInRepository !== false) {
    details.push({ field: "receiptPolicy.goLiveDecisionBundledInRepository", message: "go-live decision must stay outside git." });
  }
  if (policy.liveServerVerifiedByRepository !== false) {
    details.push({ field: "receiptPolicy.liveServerVerifiedByRepository", message: "live server verification must stay outside git." });
  }
  if (policy.nextStageHypothesis !== "Stage 6S") {
    details.push({ field: "receiptPolicy.nextStageHypothesis", message: "nextStageHypothesis must be Stage 6S." });
  }
}

export function readReleaseArchiveRetentionCycleIndexReceiptManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveRetentionCycleIndexReceiptManifest(manifest) {
  const details = [];
  if (!isPlainObject(manifest)) {
    throw new Stage6RReleaseArchiveRetentionCycleIndexReceiptError([{ field: "manifest", message: "Manifest must be an object." }]);
  }
  if (manifest.stage !== "6R") details.push({ field: "stage", message: "stage must be 6R." });
  if (manifest.packageId !== "stage6r-production-release-archive-retention-cycle-index-receipt") {
    details.push({ field: "packageId", message: "Unexpected Stage 6R package id." });
  }
  validateSafeRelativePath(
    manifest.releaseArchiveRetentionCycleIndexManifest,
    "releaseArchiveRetentionCycleIndexManifest",
    details,
  );
  validateBoundary(manifest.productBoundary, details);
  const receiptInputs = Array.isArray(manifest.receiptInputs)
    ? manifest.receiptInputs.map((input, index) => normalizeInput(input, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(manifest.receiptInputs)) details.push({ field: "receiptInputs", message: "receiptInputs must be an array." });
  requireKeys(receiptInputs, REQUIRED_INPUT_KEYS, "receiptInputs", details);
  const receiptSections = Array.isArray(manifest.receiptSections)
    ? manifest.receiptSections.map((section, index) => normalizeSection(section, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(manifest.receiptSections)) {
    details.push({ field: "receiptSections", message: "receiptSections must be an array." });
  }
  requireKeys(receiptSections, REQUIRED_SECTION_KEYS, "receiptSections", details);
  const externalReceiptFields = Array.isArray(manifest.externalReceiptFields)
    ? manifest.externalReceiptFields.map((field, index) => normalizeExternalField(field, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(manifest.externalReceiptFields)) {
    details.push({ field: "externalReceiptFields", message: "externalReceiptFields must be an array." });
  }
  requireKeys(externalReceiptFields, REQUIRED_RECEIPT_FIELD_KEYS, "externalReceiptFields", details);
  const receiptGates = Array.isArray(manifest.receiptGates)
    ? manifest.receiptGates.map((gate, index) => normalizeGate(gate, index, details)).filter(Boolean)
    : [];
  if (!Array.isArray(manifest.receiptGates)) details.push({ field: "receiptGates", message: "receiptGates must be an array." });
  requireKeys(receiptGates, REQUIRED_GATE_KEYS, "receiptGates", details);
  validateReceiptPolicy(manifest.receiptPolicy, details);
  scanValue(manifest, "manifest", details);
  if (details.length > 0) throw new Stage6RReleaseArchiveRetentionCycleIndexReceiptError(details);
  return { ...manifest, receiptInputs, receiptSections, externalReceiptFields, receiptGates };
}

export function detectReleaseArchiveRetentionCycleIndexReceiptLeaks(value) {
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

export function buildProductionReleaseArchiveRetentionCycleIndexReceipt({
  manifest = readReleaseArchiveRetentionCycleIndexReceiptManifest(),
  root = REPO_ROOT,
  generatedAt = DEFAULT_NOW,
} = {}) {
  const normalized = validateReleaseArchiveRetentionCycleIndexReceiptManifest(manifest);
  const cycleIndexManifest = validateReleaseArchiveRetentionCycleIndexManifest(
    readReleaseArchiveRetentionCycleIndexManifest(normalized.releaseArchiveRetentionCycleIndexManifest),
  );
  const cycleIndex = buildProductionReleaseArchiveRetentionCycleIndex({
    manifest: cycleIndexManifest,
    root,
    generatedAt: cycleIndexManifest.generatedAt,
  });
  const receiptInputs = inputPresence(normalized.receiptInputs, root);
  const missingInputs = receiptInputs.filter((input) => input.required && !input.present);
  const leakFindings = detectReleaseArchiveRetentionCycleIndexReceiptLeaks(JSON.stringify(normalized));
  const readyForExternalReleaseArchiveRetentionCycleIndexReceipt =
    cycleIndex.status === "ready" &&
    cycleIndex.readyForExternalReleaseArchiveRetentionCycleIndex === true &&
    missingInputs.length === 0 &&
    normalized.externalReceiptFields.every((field) => field.storeOutsideGit === true && field.redacted === true) &&
    leakFindings.length === 0;

  return {
    stage: "6R",
    packageId: normalized.packageId,
    generatedAt,
    status: readyForExternalReleaseArchiveRetentionCycleIndexReceipt ? "ready" : "blocked",
    readyForExternalReleaseArchiveRetentionCycleIndexReceipt,
    releaseArchiveRetentionCycleIndex: {
      generatedAt: cycleIndex.generatedAt,
      status: cycleIndex.status,
      readyForExternalReleaseArchiveRetentionCycleIndex:
        cycleIndex.readyForExternalReleaseArchiveRetentionCycleIndex === true,
      missingInputs: cycleIndex.missingInputs ?? [],
      leakFindings: cycleIndex.leakFindings ?? [],
    },
    releaseArchiveRetentionCycleIndexReceiptStoredInGit:
      normalized.productBoundary.releaseArchiveRetentionCycleIndexReceiptBundledInRepository === true,
    releaseArchiveRetentionCycleIndexStoredInGit:
      normalized.productBoundary.releaseArchiveRetentionCycleIndexBundledInRepository === true,
    releaseArchiveRetentionRegisterReceiptStoredInGit:
      normalized.productBoundary.releaseArchiveRetentionRegisterReceiptBundledInRepository === true,
    releaseArchiveRetentionRegisterStoredInGit:
      normalized.productBoundary.releaseArchiveRetentionRegisterBundledInRepository === true,
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
    externalArchiveRetentionCycleIndexReceiptStoredOutsideGit:
      normalized.productBoundary.externalArchiveRetentionCycleIndexReceiptStoredOutsideGit === true,
    archiveReceiptOutcomeKnownToRepository: normalized.productBoundary.archiveReceiptOutcomeKnownToRepository === true,
    archiveReconciliationOutcomeKnownToRepository: normalized.productBoundary.archiveReconciliationOutcomeKnownToRepository === true,
    archiveRetentionOutcomeKnownToRepository: normalized.productBoundary.archiveRetentionOutcomeKnownToRepository === true,
    archiveRetentionRegisterReceiptOutcomeKnownToRepository:
      normalized.productBoundary.archiveRetentionRegisterReceiptOutcomeKnownToRepository === true,
    archiveRetentionCycleOutcomeKnownToRepository: normalized.productBoundary.archiveRetentionCycleOutcomeKnownToRepository === true,
    archiveRetentionCycleIndexReceiptOutcomeKnownToRepository:
      normalized.productBoundary.archiveRetentionCycleIndexReceiptOutcomeKnownToRepository === true,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveArchiveVerifiedByThisReport: false,
    receiptInputs,
    missingInputs,
    receiptSections: normalized.receiptSections,
    externalReceiptFields: normalized.externalReceiptFields,
    receiptGates: normalized.receiptGates,
    productBoundary: normalized.productBoundary,
    receiptPolicy: normalized.receiptPolicy,
    leakFindings,
  };
}

export function renderProductionReleaseArchiveRetentionCycleIndexReceiptMarkdown(report) {
  const lines = [
    "# Stage 6R production release archive retention cycle index receipt",
    "",
    `- Generated at: \`${report.generatedAt}\``,
    `- Status: \`${report.status}\``,
    `- Ready for external release archive retention cycle index receipt: \`${report.readyForExternalReleaseArchiveRetentionCycleIndexReceipt}\``,
    `- Stage 6Q retention cycle index generated at: \`${report.releaseArchiveRetentionCycleIndex.generatedAt}\``,
    `- Stage 6Q retention cycle index status: \`${report.releaseArchiveRetentionCycleIndex.status}\``,
    `- Ready for external retention cycle index: \`${report.releaseArchiveRetentionCycleIndex.readyForExternalReleaseArchiveRetentionCycleIndex}\``,
    `- Stage 6Q missing required inputs: \`${report.releaseArchiveRetentionCycleIndex.missingInputs.length}\``,
    `- Stage 6Q leak findings: \`${report.releaseArchiveRetentionCycleIndex.leakFindings.length}\``,
    `- Release archive retention cycle index receipt stored in git: \`${report.releaseArchiveRetentionCycleIndexReceiptStoredInGit}\``,
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
    `- External archive retention cycle index receipt stored outside git: \`${report.externalArchiveRetentionCycleIndexReceiptStoredOutsideGit}\``,
    `- Archive receipt outcome known to repository: \`${report.archiveReceiptOutcomeKnownToRepository}\``,
    `- Archive reconciliation outcome known to repository: \`${report.archiveReconciliationOutcomeKnownToRepository}\``,
    `- Archive retention outcome known to repository: \`${report.archiveRetentionOutcomeKnownToRepository}\``,
    `- Archive retention register receipt outcome known to repository: \`${report.archiveRetentionRegisterReceiptOutcomeKnownToRepository}\``,
    `- Archive retention cycle outcome known to repository: \`${report.archiveRetentionCycleOutcomeKnownToRepository}\``,
    `- Archive retention cycle index receipt outcome known to repository: \`${report.archiveRetentionCycleIndexReceiptOutcomeKnownToRepository}\``,
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
  lines.push(`- Count: \`${report.externalReceiptFields.length}\``);
  lines.push(`- Stored outside git: \`${report.externalReceiptFields.every((field) => field.storeOutsideGit === true)}\``);
  lines.push("", "## Receipt gates", "");
  for (const gate of report.receiptGates) {
    lines.push(`- \`${gate.command}\` — ${gate.label}`);
  }
  lines.push("", "## Product boundary", "");
  lines.push(`- Managed runtime/database dependency: ${report.productBoundary.managedRuntimeDependency}`);
  lines.push(`- Runtime calls external systems: \`${report.productBoundary.productRuntimeCallsExternalSystems}\``);
  lines.push(`- Demo fallback in production: \`${report.productBoundary.demoFallbackInProduction}\``);
  lines.push("", "## Repository policy", "");
  lines.push("- The repository stores the retention cycle index receipt schema, redacted field names, gates, and safe pointers.");
  lines.push("- The repository does not store retention cycle index receipt values, review windows, owner rosters, disposal holds, exception registers, live logs, metrics, credentials, backup contents, archive contents, or patient-identifying content.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6RArgs(argv = process.argv.slice(2)) {
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

export function runStage6RProductionReleaseArchiveRetentionCycleIndexReceipt({
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt = DEFAULT_NOW,
  dryRun = false,
} = {}) {
  const report = buildProductionReleaseArchiveRetentionCycleIndexReceipt({
    manifest: readReleaseArchiveRetentionCycleIndexReceiptManifest(manifestPath),
    root: REPO_ROOT,
    generatedAt,
  });
  const markdown = renderProductionReleaseArchiveRetentionCycleIndexReceiptMarkdown(report);
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
    const args = parseStage6RArgs();
    const result = runStage6RProductionReleaseArchiveRetentionCycleIndexReceipt({
      manifestPath: args.manifest,
      summaryPath: args.summaryPath,
      jsonOut: args.jsonOut,
      generatedAt: args.now,
      dryRun: args.dryRun,
    });
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[stage6r] ${error.message}`);
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
