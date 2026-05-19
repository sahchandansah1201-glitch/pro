#!/usr/bin/env node
// Stage 6M · production release archive final closure.
// Builds an offline, redacted closure package for the Stage 6L release archive
// reconciliation receipt. The command reads repository evidence only, performs no
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
  buildProductionReleaseArchiveReconciliationReceipt,
  readReleaseArchiveReconciliationReceiptManifest,
  validateReleaseArchiveReconciliationReceiptManifest,
} from "./stage6l-production-release-archive-reconciliation-receipt.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-final-closure.stage6m.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6m-production-release-archive-final-closure.md";
const DEFAULT_JSON_PATH = "test-results/stage6m-production-release-archive-final-closure.json";
const DEFAULT_NOW = "2026-05-19T11:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6l_release_archive_reconciliation_receipt",
  "stage6l_archive_reconciliation_receipt_generator",
  "stage6k_release_archive_reconciliation",
  "stage6i_release_archive_index",
  "stage6j_release_archive_handoff_receipt",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "stage6l_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "archive_index_reference",
  "archive_handoff_receipt_reference",
  "archive_reconciliation_reference",
  "archive_reconciliation_receipt_reference",
  "external_archive_final_closure_reference",
  "final_archive_outcome_reference",
  "retention_followup_reference",
  "production_boundary",
  "next_cycle_entrypoints",
];

const REQUIRED_CLOSURE_FIELD_KEYS = [
  "archive_final_closure_id_reference",
  "archive_index_outcome_reference",
  "archive_reconciliation_receipt_outcome_reference",
  "archive_owner_signoff_reference",
  "retention_followup_reference",
  "final_closure_owner_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6l_ready",
  "stage6l_report",
  "stage6m_report",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "external_closure_contents_stay_external",
  "external_closure_owner_recorded",
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

export class Stage6MReleaseArchiveFinalClosureError extends Error {
  constructor(details = []) {
    super("Stage 6M production release archive final closure failed validation.");
    this.name = "Stage6MReleaseArchiveFinalClosureError";
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
        details.push({ field: path, message: `Archive final closure contains forbidden value: ${code}.` });
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
    releaseArchiveFinalClosureBundledInRepository: true,
    releaseArchiveReconciliationReceiptBundledInRepository: true,
    releaseArchiveReconciliationBundledInRepository: true,
    archiveHandoffReceiptBundledInRepository: true,
    externalArchiveReceiptStoredOutsideGit: true,
    releaseArchiveContentsStoredOutsideGit: true,
    externalArchiveReconciliationStoredOutsideGit: true,
    externalArchiveReconciliationReceiptStoredOutsideGit: true,
    externalArchiveFinalClosureStoredOutsideGit: true,
    archiveReceiptOutcomeKnownToRepository: false,
    archiveReconciliationOutcomeKnownToRepository: false,
    archiveFinalClosureOutcomeKnownToRepository: false,
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
    details.push({ field: `closureInputs.${index}`, message: "closure input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `closureInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `closureInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `closureInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `closureInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `closureSections.${index}`, message: "closure section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `closureSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `closureSections.${index}.label`, message: "label is required." });
  return {
    key,
    label,
    required: section.required !== false,
    storeOutsideGit: section.storeOutsideGit === true,
  };
}

function normalizeClosureField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalClosureFields.${index}`, message: "closure field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalClosureFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalClosureFields.${index}.label`, message: "label is required." });
  for (const property of ["required", "redacted", "storeOutsideGit"]) {
    if (field[property] !== true) {
      details.push({ field: `externalClosureFields.${index}.${property}`, message: "Expected true." });
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
    details.push({ field: `closureGates.${index}`, message: "closure gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `closureGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `closureGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `closureGates.${index}.command`, message: "command is required." });
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
    details.push({ field: "closurePolicy", message: "closurePolicy is required." });
    return;
  }
  if (!Array.isArray(policy.repositoryStores) || policy.repositoryStores.length === 0) {
    details.push({ field: "closurePolicy.repositoryStores", message: "repositoryStores must be non-empty." });
  }
  if (!Array.isArray(policy.repositoryMustNotStore) || policy.repositoryMustNotStore.length === 0) {
    details.push({ field: "closurePolicy.repositoryMustNotStore", message: "repositoryMustNotStore must be non-empty." });
  }
  if (policy.goLiveDecisionBundledInRepository !== false) {
    details.push({ field: "closurePolicy.goLiveDecisionBundledInRepository", message: "Expected false." });
  }
  if (policy.liveServerVerifiedByRepository !== false) {
    details.push({ field: "closurePolicy.liveServerVerifiedByRepository", message: "Expected false." });
  }
  if (!cleanString(policy.finalClosureOwner)) {
    details.push({ field: "closurePolicy.finalClosureOwner", message: "finalClosureOwner is required." });
  }
}

export function readReleaseArchiveFinalClosureManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveFinalClosureManifest(rawManifest) {
  const details = [];
  if (!isPlainObject(rawManifest)) {
    throw new Stage6MReleaseArchiveFinalClosureError([{ field: "manifest", message: "manifest must be an object." }]);
  }
  const manifest = { ...rawManifest };
  if (manifest.stage !== "6M") details.push({ field: "stage", message: "Expected 6M." });
  if (manifest.packageId !== "stage6m-production-release-archive-final-closure") {
    details.push({ field: "packageId", message: "Unexpected packageId." });
  }
  manifest.releaseArchiveReconciliationReceiptManifest = validateSafeRelativePath(
    manifest.releaseArchiveReconciliationReceiptManifest,
    "releaseArchiveReconciliationReceiptManifest",
    details,
  );
  validateBoundary(manifest.productBoundary, details);
  manifest.closureInputs = Array.isArray(manifest.closureInputs)
    ? manifest.closureInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  manifest.closureSections = Array.isArray(manifest.closureSections)
    ? manifest.closureSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  manifest.externalClosureFields = Array.isArray(manifest.externalClosureFields)
    ? manifest.externalClosureFields.map((item, index) => normalizeClosureField(item, index, details)).filter(Boolean)
    : [];
  manifest.closureGates = Array.isArray(manifest.closureGates)
    ? manifest.closureGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(manifest.closureInputs, REQUIRED_INPUT_KEYS, "closureInputs", details);
  requireKeys(manifest.closureSections, REQUIRED_SECTION_KEYS, "closureSections", details);
  requireKeys(manifest.externalClosureFields, REQUIRED_CLOSURE_FIELD_KEYS, "externalClosureFields", details);
  requireKeys(manifest.closureGates, REQUIRED_GATE_KEYS, "closureGates", details);
  validatePolicy(manifest.closurePolicy, details);
  scanValue(manifest, "manifest", details);
  if (details.length > 0) throw new Stage6MReleaseArchiveFinalClosureError(details);
  return manifest;
}

export function detectReleaseArchiveFinalClosureLeaks(value) {
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

export function buildProductionReleaseArchiveFinalClosure({
  manifest = readReleaseArchiveFinalClosureManifest(),
  root = REPO_ROOT,
  generatedAt = DEFAULT_NOW,
} = {}) {
  const validated = validateReleaseArchiveFinalClosureManifest(manifest);
  const receiptManifest = validateReleaseArchiveReconciliationReceiptManifest(
    readReleaseArchiveReconciliationReceiptManifest(validated.releaseArchiveReconciliationReceiptManifest),
  );
  const reconciliationReceipt = buildProductionReleaseArchiveReconciliationReceipt({
    manifest: receiptManifest,
    root,
    generatedAt,
  });
  const inputs = validated.closureInputs.map((input) => statusForInput(root, input));
  const missingRequiredInputs = inputs.filter((input) => input.required && !input.present);
  const externalClosureFieldCount = validated.externalClosureFields.length;
  const externalClosureFieldsStoredOutsideGit = validated.externalClosureFields.every(
    (field) => field.storeOutsideGit,
  );
  const leakFindings = detectReleaseArchiveFinalClosureLeaks(validated);
  const readyForExternalReleaseArchiveFinalClosure =
    reconciliationReceipt.status === "ready" &&
    missingRequiredInputs.length === 0 &&
    externalClosureFieldsStoredOutsideGit &&
    leakFindings.length === 0;

  return {
    stage: "6M",
    packageId: validated.packageId,
    generatedAt,
    status: readyForExternalReleaseArchiveFinalClosure ? "ready" : "blocked",
    readyForExternalReleaseArchiveFinalClosure,
    releaseArchiveReconciliationReceipt: {
      status: reconciliationReceipt.status,
      readyForExternalReleaseArchiveReconciliationReceipt:
        reconciliationReceipt.readyForExternalReleaseArchiveReconciliationReceipt,
      externalArchiveReconciliationReceiptStoredOutsideGit:
        reconciliationReceipt.externalArchiveReconciliationReceiptStoredOutsideGit,
      archiveReconciliationReceiptOutcomeKnownToRepository:
        reconciliationReceipt.archiveReconciliationReceiptOutcomeKnownToRepository,
    },
    releaseArchiveFinalClosureStoredInGit: true,
    releaseArchiveReconciliationReceiptStoredInGit: true,
    releaseArchiveReconciliationStoredInGit: true,
    releaseArchiveIndexStoredInGit: true,
    archiveHandoffReceiptStoredInGit: true,
    releaseArchiveContentsStoredOutsideGit: validated.productBoundary.releaseArchiveContentsStoredOutsideGit,
    externalArchiveReceiptStoredOutsideGit: validated.productBoundary.externalArchiveReceiptStoredOutsideGit,
    externalArchiveReconciliationStoredOutsideGit: validated.productBoundary.externalArchiveReconciliationStoredOutsideGit,
    externalArchiveReconciliationReceiptStoredOutsideGit:
      validated.productBoundary.externalArchiveReconciliationReceiptStoredOutsideGit,
    externalArchiveFinalClosureStoredOutsideGit: validated.productBoundary.externalArchiveFinalClosureStoredOutsideGit,
    archiveReceiptOutcomeKnownToRepository: validated.productBoundary.archiveReceiptOutcomeKnownToRepository,
    archiveReconciliationOutcomeKnownToRepository: validated.productBoundary.archiveReconciliationOutcomeKnownToRepository,
    archiveFinalClosureOutcomeKnownToRepository: validated.productBoundary.archiveFinalClosureOutcomeKnownToRepository,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveArchiveVerifiedByThisReport: false,
    externalClosureFieldCount,
    externalClosureFieldsStoredOutsideGit,
    closureInputs: inputs,
    missingRequiredInputs: missingRequiredInputs.map((input) => input.key),
    closureSections: validated.closureSections,
    closureGates: validated.closureGates,
    productBoundary: validated.productBoundary,
    closurePolicy: validated.closurePolicy,
    leakFindings,
  };
}

export function renderProductionReleaseArchiveFinalClosureMarkdown(report) {
  const lines = [
    "# Stage 6M production release archive final closure",
    "",
    `- Generated at: \`${report.generatedAt}\``,
    `- Status: \`${report.status}\``,
    `- Ready for external release archive final closure: \`${report.readyForExternalReleaseArchiveFinalClosure}\``,
    `- Stage 6L archive reconciliation receipt status: \`${report.releaseArchiveReconciliationReceipt.status}\``,
    `- Ready for external archive reconciliation receipt: \`${report.releaseArchiveReconciliationReceipt.readyForExternalReleaseArchiveReconciliationReceipt}\``,
    `- Release archive final closure stored in git: \`${report.releaseArchiveFinalClosureStoredInGit}\``,
    `- Release archive reconciliation receipt stored in git: \`${report.releaseArchiveReconciliationReceiptStoredInGit}\``,
    `- Release archive reconciliation stored in git: \`${report.releaseArchiveReconciliationStoredInGit}\``,
    `- Release archive index stored in git: \`${report.releaseArchiveIndexStoredInGit}\``,
    `- Archive handoff receipt stored in git: \`${report.archiveHandoffReceiptStoredInGit}\``,
    `- Release archive contents stored outside git: \`${report.releaseArchiveContentsStoredOutsideGit}\``,
    `- External archive receipt stored outside git: \`${report.externalArchiveReceiptStoredOutsideGit}\``,
    `- External archive reconciliation stored outside git: \`${report.externalArchiveReconciliationStoredOutsideGit}\``,
    `- External archive reconciliation receipt stored outside git: \`${report.externalArchiveReconciliationReceiptStoredOutsideGit}\``,
    `- External archive final closure stored outside git: \`${report.externalArchiveFinalClosureStoredOutsideGit}\``,
    `- Archive receipt outcome known to repository: \`${report.archiveReceiptOutcomeKnownToRepository}\``,
    `- Archive reconciliation outcome known to repository: \`${report.archiveReconciliationOutcomeKnownToRepository}\``,
    `- Archive final closure outcome known to repository: \`${report.archiveFinalClosureOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live archive verified by this report: \`${report.liveArchiveVerifiedByThisReport}\``,
    `- Leak findings: \`${report.leakFindings.length}\``,
    "",
    "## Closure inputs",
    "",
  ];
  for (const input of report.closureInputs) {
    lines.push(`- ${input.present ? "ok" : "missing"} \`${input.path}\` (${input.key})`);
  }
  lines.push("", "## External closure fields", "");
  lines.push(`- Count: \`${report.externalClosureFieldCount}\``);
  lines.push(`- Stored outside git: \`${report.externalClosureFieldsStoredOutsideGit}\``);
  lines.push("", "## Closure gates", "");
  for (const gate of report.closureGates) {
    lines.push(`- \`${gate.command}\` — ${gate.label}`);
  }
  lines.push("", "## Product boundary", "");
  lines.push("- Managed runtime/database dependency: none");
  lines.push(`- Runtime calls external systems: \`${report.productBoundary.productRuntimeCallsExternalSystems}\``);
  lines.push(`- Demo fallback in production: \`${report.productBoundary.demoFallbackInProduction}\``);
  lines.push("", "## Repository policy", "");
  lines.push("- The repository stores the final closure schema, redacted field names, gates, and safe pointers.");
  lines.push("- The repository does not store the final archive final closure outcome, archive closure values, reconciliation values, raw archive contents, logs, metrics, credentials, backup contents, or patient-identifying content.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6MArgs(argv = process.argv.slice(2)) {
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

export function runStage6MProductionReleaseArchiveFinalClosure(options = {}) {
  const manifest = readReleaseArchiveFinalClosureManifest(options.manifest ?? DEFAULT_MANIFEST);
  const report = buildProductionReleaseArchiveFinalClosure({
    manifest,
    root: options.root ?? REPO_ROOT,
    generatedAt: options.generatedAt ?? options.now ?? DEFAULT_NOW,
  });
  const markdown = renderProductionReleaseArchiveFinalClosureMarkdown(report);
  if (options.summaryPath) writeOutput(options.summaryPath, markdown);
  if (options.jsonOut) writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (options.dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage6MArgs(argv);
    const result = runStage6MProductionReleaseArchiveFinalClosure({
      manifest: args.manifest,
      summaryPath: args.summaryPath,
      jsonOut: args.jsonOut,
      generatedAt: args.now,
      dryRun: args.dryRun,
    });
    if (!args.dryRun && !args.summaryPath && !args.jsonOut) process.stdout.write(`${result.markdown}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[stage6m-production-release-archive-final-closure] failed: ${error.message}`);
    if (error?.details) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
