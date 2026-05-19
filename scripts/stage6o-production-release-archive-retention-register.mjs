#!/usr/bin/env node
// Stage 6O · production release archive retention register.
// Builds an offline, redacted retention-register package on top of the Stage
// 6N final closure receipt. The command reads repository evidence only,
// performs no network calls, and does not store live archive retention values.
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
  buildProductionReleaseArchiveFinalClosureReceipt,
  readReleaseArchiveFinalClosureReceiptManifest,
  validateReleaseArchiveFinalClosureReceiptManifest,
} from "./stage6n-production-release-archive-final-closure-receipt.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-retention-register.stage6o.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6o-production-release-archive-retention-register.md";
const DEFAULT_JSON_PATH = "test-results/stage6o-production-release-archive-retention-register.json";
const DEFAULT_NOW = "2026-05-19T12:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6n_release_archive_final_closure_receipt",
  "stage6n_release_archive_final_closure_receipt_generator",
  "stage6m_release_archive_final_closure",
  "stage6i_release_archive_index",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "stage6n_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "archive_index_reference",
  "archive_final_closure_receipt_reference",
  "archive_retention_policy_reference",
  "archive_retention_schedule_reference",
  "archive_retention_owner_reference",
  "archive_disposal_hold_reference",
  "retention_review_reference",
  "production_boundary",
  "next_cycle_entrypoints",
];

const REQUIRED_RETENTION_FIELD_KEYS = [
  "archive_retention_register_id_reference",
  "archive_retention_schedule_reference",
  "archive_retention_owner_reference",
  "archive_disposal_hold_reference",
  "retention_review_receipt_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6n_ready",
  "stage6n_report",
  "stage6o_report",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "external_retention_records_stay_external",
  "external_retention_owner_recorded",
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

export class Stage6OReleaseArchiveRetentionRegisterError extends Error {
  constructor(details = []) {
    super("Stage 6O production release archive retention register failed validation.");
    this.name = "Stage6OReleaseArchiveRetentionRegisterError";
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
        details.push({ field: path, message: `Archive retention register contains forbidden value: ${code}.` });
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
    releaseArchiveRetentionRegisterBundledInRepository: true,
    releaseArchiveFinalClosureReceiptBundledInRepository: true,
    releaseArchiveFinalClosureBundledInRepository: true,
    releaseArchiveReconciliationReceiptBundledInRepository: true,
    releaseArchiveReconciliationBundledInRepository: true,
    archiveHandoffReceiptBundledInRepository: true,
    releaseArchiveContentsStoredOutsideGit: true,
    externalArchiveReceiptStoredOutsideGit: true,
    externalArchiveReconciliationStoredOutsideGit: true,
    externalArchiveReconciliationReceiptStoredOutsideGit: true,
    externalArchiveFinalClosureStoredOutsideGit: true,
    externalArchiveFinalClosureReceiptStoredOutsideGit: true,
    externalArchiveRetentionRecordsStoredOutsideGit: true,
    archiveReceiptOutcomeKnownToRepository: false,
    archiveReconciliationOutcomeKnownToRepository: false,
    archiveReconciliationReceiptOutcomeKnownToRepository: false,
    archiveFinalClosureOutcomeKnownToRepository: false,
    archiveFinalClosureReceiptOutcomeKnownToRepository: false,
    archiveRetentionOutcomeKnownToRepository: false,
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
    details.push({ field: `registerInputs.${index}`, message: "register input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `registerInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `registerInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `registerInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `registerInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `registerSections.${index}`, message: "register section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `registerSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `registerSections.${index}.label`, message: "label is required." });
  return {
    key,
    label,
    required: section.required !== false,
    storeOutsideGit: section.storeOutsideGit === true,
  };
}

function normalizeRetentionField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalRetentionFields.${index}`, message: "retention field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalRetentionFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalRetentionFields.${index}.label`, message: "label is required." });
  for (const property of ["required", "redacted", "storeOutsideGit"]) {
    if (field[property] !== true) {
      details.push({ field: `externalRetentionFields.${index}.${property}`, message: "Expected true." });
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
    details.push({ field: `registerGates.${index}`, message: "register gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `registerGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `registerGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `registerGates.${index}.command`, message: "command is required." });
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
    details.push({ field: "retentionPolicy", message: "retentionPolicy is required." });
    return;
  }
  if (!Array.isArray(policy.repositoryStores) || policy.repositoryStores.length === 0) {
    details.push({ field: "retentionPolicy.repositoryStores", message: "repositoryStores must be non-empty." });
  }
  if (!Array.isArray(policy.repositoryMustNotStore) || policy.repositoryMustNotStore.length === 0) {
    details.push({ field: "retentionPolicy.repositoryMustNotStore", message: "repositoryMustNotStore must be non-empty." });
  }
  if (policy.goLiveDecisionBundledInRepository !== false) {
    details.push({ field: "retentionPolicy.goLiveDecisionBundledInRepository", message: "Expected false." });
  }
  if (policy.liveServerVerifiedByRepository !== false) {
    details.push({ field: "retentionPolicy.liveServerVerifiedByRepository", message: "Expected false." });
  }
  if (!cleanString(policy.archiveRetentionOwner)) {
    details.push({ field: "retentionPolicy.archiveRetentionOwner", message: "archiveRetentionOwner is required." });
  }
}

export function readReleaseArchiveRetentionRegisterManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveRetentionRegisterManifest(rawManifest) {
  const details = [];
  if (!isPlainObject(rawManifest)) {
    throw new Stage6OReleaseArchiveRetentionRegisterError([{ field: "manifest", message: "manifest must be an object." }]);
  }
  const manifest = { ...rawManifest };
  if (manifest.stage !== "6O") details.push({ field: "stage", message: "Expected 6O." });
  if (manifest.packageId !== "stage6o-production-release-archive-retention-register") {
    details.push({ field: "packageId", message: "Unexpected packageId." });
  }
  manifest.releaseArchiveFinalClosureReceiptManifest = validateSafeRelativePath(
    manifest.releaseArchiveFinalClosureReceiptManifest,
    "releaseArchiveFinalClosureReceiptManifest",
    details,
  );
  validateBoundary(manifest.productBoundary, details);
  manifest.registerInputs = Array.isArray(manifest.registerInputs)
    ? manifest.registerInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  manifest.registerSections = Array.isArray(manifest.registerSections)
    ? manifest.registerSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  manifest.externalRetentionFields = Array.isArray(manifest.externalRetentionFields)
    ? manifest.externalRetentionFields.map((item, index) => normalizeRetentionField(item, index, details)).filter(Boolean)
    : [];
  manifest.registerGates = Array.isArray(manifest.registerGates)
    ? manifest.registerGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(manifest.registerInputs, REQUIRED_INPUT_KEYS, "registerInputs", details);
  requireKeys(manifest.registerSections, REQUIRED_SECTION_KEYS, "registerSections", details);
  requireKeys(manifest.externalRetentionFields, REQUIRED_RETENTION_FIELD_KEYS, "externalRetentionFields", details);
  requireKeys(manifest.registerGates, REQUIRED_GATE_KEYS, "registerGates", details);
  validatePolicy(manifest.retentionPolicy, details);
  scanValue(manifest, "manifest", details);
  if (details.length > 0) throw new Stage6OReleaseArchiveRetentionRegisterError(details);
  return manifest;
}

export function detectReleaseArchiveRetentionRegisterLeaks(value) {
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

export function buildProductionReleaseArchiveRetentionRegister({
  manifest = readReleaseArchiveRetentionRegisterManifest(),
  root = REPO_ROOT,
  generatedAt = DEFAULT_NOW,
} = {}) {
  const validated = validateReleaseArchiveRetentionRegisterManifest(manifest);
  const receiptManifest = validateReleaseArchiveFinalClosureReceiptManifest(
    readReleaseArchiveFinalClosureReceiptManifest(validated.releaseArchiveFinalClosureReceiptManifest),
  );
  const finalClosureReceipt = buildProductionReleaseArchiveFinalClosureReceipt({
    manifest: receiptManifest,
    root,
    generatedAt,
  });
  const inputs = validated.registerInputs.map((input) => statusForInput(root, input));
  const missingRequiredInputs = inputs.filter((input) => input.required && !input.present);
  const externalRetentionFieldCount = validated.externalRetentionFields.length;
  const externalRetentionFieldsStoredOutsideGit = validated.externalRetentionFields.every(
    (field) => field.storeOutsideGit,
  );
  const leakFindings = detectReleaseArchiveRetentionRegisterLeaks(validated);
  const readyForExternalReleaseArchiveRetentionRegister =
    finalClosureReceipt.status === "ready" &&
    missingRequiredInputs.length === 0 &&
    externalRetentionFieldsStoredOutsideGit &&
    leakFindings.length === 0;

  return {
    stage: "6O",
    packageId: validated.packageId,
    generatedAt,
    status: readyForExternalReleaseArchiveRetentionRegister ? "ready" : "blocked",
    readyForExternalReleaseArchiveRetentionRegister,
    releaseArchiveFinalClosureReceipt: {
      status: finalClosureReceipt.status,
      readyForExternalReleaseArchiveFinalClosureReceipt:
        finalClosureReceipt.readyForExternalReleaseArchiveFinalClosureReceipt,
      externalArchiveFinalClosureReceiptStoredOutsideGit:
        finalClosureReceipt.externalArchiveFinalClosureReceiptStoredOutsideGit,
      archiveFinalClosureReceiptOutcomeKnownToRepository:
        finalClosureReceipt.archiveFinalClosureReceiptOutcomeKnownToRepository,
    },
    releaseArchiveRetentionRegisterStoredInGit: true,
    releaseArchiveFinalClosureReceiptStoredInGit: true,
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
    externalArchiveFinalClosureReceiptStoredOutsideGit:
      validated.productBoundary.externalArchiveFinalClosureReceiptStoredOutsideGit,
    externalArchiveRetentionRecordsStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionRecordsStoredOutsideGit,
    archiveReceiptOutcomeKnownToRepository: validated.productBoundary.archiveReceiptOutcomeKnownToRepository,
    archiveReconciliationOutcomeKnownToRepository: validated.productBoundary.archiveReconciliationOutcomeKnownToRepository,
    archiveReconciliationReceiptOutcomeKnownToRepository:
      validated.productBoundary.archiveReconciliationReceiptOutcomeKnownToRepository,
    archiveFinalClosureOutcomeKnownToRepository: validated.productBoundary.archiveFinalClosureOutcomeKnownToRepository,
    archiveFinalClosureReceiptOutcomeKnownToRepository:
      validated.productBoundary.archiveFinalClosureReceiptOutcomeKnownToRepository,
    archiveRetentionOutcomeKnownToRepository: validated.productBoundary.archiveRetentionOutcomeKnownToRepository,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveArchiveVerifiedByThisReport: false,
    externalRetentionFieldCount,
    externalRetentionFieldsStoredOutsideGit,
    registerInputs: inputs,
    missingRequiredInputs: missingRequiredInputs.map((input) => input.key),
    registerSections: validated.registerSections,
    registerGates: validated.registerGates,
    productBoundary: validated.productBoundary,
    retentionPolicy: validated.retentionPolicy,
    leakFindings,
  };
}

export function renderProductionReleaseArchiveRetentionRegisterMarkdown(report) {
  const lines = [
    "# Stage 6O production release archive retention register",
    "",
    `- Generated at: \`${report.generatedAt}\``,
    `- Status: \`${report.status}\``,
    `- Ready for external release archive retention register: \`${report.readyForExternalReleaseArchiveRetentionRegister}\``,
    `- Stage 6N archive final closure receipt status: \`${report.releaseArchiveFinalClosureReceipt.status}\``,
    `- Ready for external archive final closure receipt: \`${report.releaseArchiveFinalClosureReceipt.readyForExternalReleaseArchiveFinalClosureReceipt}\``,
    `- Release archive retention register stored in git: \`${report.releaseArchiveRetentionRegisterStoredInGit}\``,
    `- Release archive final closure receipt stored in git: \`${report.releaseArchiveFinalClosureReceiptStoredInGit}\``,
    `- Release archive final closure stored in git: \`${report.releaseArchiveFinalClosureStoredInGit}\``,
    `- Release archive reconciliation receipt stored in git: \`${report.releaseArchiveReconciliationReceiptStoredInGit}\``,
    `- Release archive reconciliation stored in git: \`${report.releaseArchiveReconciliationStoredInGit}\``,
    `- Release archive index stored in git: \`${report.releaseArchiveIndexStoredInGit}\``,
    `- Archive handoff receipt stored in git: \`${report.archiveHandoffReceiptStoredInGit}\``,
    `- Release archive contents stored outside git: \`${report.releaseArchiveContentsStoredOutsideGit}\``,
    `- External archive final closure receipt stored outside git: \`${report.externalArchiveFinalClosureReceiptStoredOutsideGit}\``,
    `- External archive retention records stored outside git: \`${report.externalArchiveRetentionRecordsStoredOutsideGit}\``,
    `- Archive final closure receipt outcome known to repository: \`${report.archiveFinalClosureReceiptOutcomeKnownToRepository}\``,
    `- Archive retention outcome known to repository: \`${report.archiveRetentionOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live archive verified by this report: \`${report.liveArchiveVerifiedByThisReport}\``,
    `- Leak findings: \`${report.leakFindings.length}\``,
    "",
    "## Register inputs",
    "",
  ];
  for (const input of report.registerInputs) {
    lines.push(`- ${input.present ? "ok" : "missing"} \`${input.path}\` (${input.key})`);
  }
  lines.push("", "## External retention fields", "");
  lines.push(`- Count: \`${report.externalRetentionFieldCount}\``);
  lines.push(`- Stored outside git: \`${report.externalRetentionFieldsStoredOutsideGit}\``);
  lines.push("", "## Register gates", "");
  for (const gate of report.registerGates) {
    lines.push(`- \`${gate.command}\` — ${gate.label}`);
  }
  lines.push("", "## Product boundary", "");
  lines.push("- Managed runtime/database dependency: none");
  lines.push(`- Runtime calls external systems: \`${report.productBoundary.productRuntimeCallsExternalSystems}\``);
  lines.push(`- Demo fallback in production: \`${report.productBoundary.demoFallbackInProduction}\``);
  lines.push("", "## Repository policy", "");
  lines.push("- The repository stores the retention register schema, redacted field names, gates, and safe pointers.");
  lines.push("- The repository does not store retention schedules, disposal holds, live logs, metrics, credentials, backup contents, archive contents, or patient-identifying content.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6OArgs(argv = process.argv.slice(2)) {
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

export function runStage6OProductionReleaseArchiveRetentionRegister(options = {}) {
  const manifest = readReleaseArchiveRetentionRegisterManifest(options.manifest ?? DEFAULT_MANIFEST);
  const report = buildProductionReleaseArchiveRetentionRegister({
    manifest,
    root: options.root ?? REPO_ROOT,
    generatedAt: options.generatedAt ?? options.now ?? DEFAULT_NOW,
  });
  const markdown = renderProductionReleaseArchiveRetentionRegisterMarkdown(report);
  if (options.summaryPath) writeOutput(options.summaryPath, markdown);
  if (options.jsonOut) writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (options.dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage6OArgs(argv);
    const result = runStage6OProductionReleaseArchiveRetentionRegister({
      manifest: args.manifest,
      summaryPath: args.summaryPath,
      jsonOut: args.jsonOut,
      generatedAt: args.now,
      dryRun: args.dryRun,
    });
    if (!args.dryRun && !args.summaryPath && !args.jsonOut) process.stdout.write(`${result.markdown}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[stage6o-production-release-archive-retention-register] failed: ${error.message}`);
    if (error?.details) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
