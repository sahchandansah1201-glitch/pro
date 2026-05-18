#!/usr/bin/env node
// Stage 6J · production release archive handoff receipt.
// Builds an offline, redacted receipt package for handing the Stage 6I archive
// index to the operator-owned external archive process. The command reads
// repository evidence only, performs no network calls, and does not approve or
// verify a live production go-live or archive outcome.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProductionReleaseArchiveIndex,
  readReleaseArchiveIndexManifest,
  validateReleaseArchiveIndexManifest,
} from "./stage6i-production-release-archive-index.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-handoff-receipt.stage6j.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6j-production-release-archive-handoff-receipt.md";
const DEFAULT_JSON_PATH = "test-results/stage6j-production-release-archive-handoff-receipt.json";
const DEFAULT_NOW = "2026-05-17T14:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6i_release_archive_index",
  "stage6i_archive_index_generator",
  "stage6h_release_memory_closure",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "stage6i_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "archive_index_reference",
  "external_archive_owner_reference",
  "archive_receipt_identity_reference",
  "archive_media_reference",
  "checksum_manifest_reference",
  "restore_drill_reference",
  "retention_policy_reference",
  "production_boundary",
  "next_cycle_entrypoints",
];

const REQUIRED_RECEIPT_FIELD_KEYS = [
  "archive_receipt_id",
  "archive_owner_reference",
  "archive_location_reference",
  "archive_media_reference",
  "checksum_manifest_reference",
  "restore_drill_reference",
  "retention_policy_reference",
  "receipt_owner_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6i_ready",
  "stage6i_report",
  "stage6j_report",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "external_archive_contents_stay_external",
  "external_receipt_owner_recorded",
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

export class Stage6JReleaseArchiveHandoffReceiptError extends Error {
  constructor(details = []) {
    super("Stage 6J production release archive handoff receipt failed validation.");
    this.name = "Stage6JReleaseArchiveHandoffReceiptError";
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
        details.push({ field: path, message: `Archive handoff receipt contains forbidden value: ${code}.` });
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
    archiveHandoffReceiptBundledInRepository: true,
    releaseArchiveIndexBundledInRepository: true,
    releaseArchiveContentsStoredOutsideGit: true,
    externalArchiveReceiptStoredOutsideGit: true,
    archiveReceiptOutcomeKnownToRepository: false,
    liveServerGoLiveVerifiedByRepository: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (boundary[key] !== value) {
      details.push({ field: `productBoundary.${key}`, message: `Expected ${String(value)}.` });
    }
  }
  for (const key of ["deployment", "frontend", "backend", "database", "objectStorage", "worker"]) {
    if (!cleanString(boundary[key])) {
      details.push({ field: `productBoundary.${key}`, message: `${key} is required.` });
    }
  }
}

function normalizeInput(input, index, details) {
  if (!isPlainObject(input)) {
    details.push({ field: `handoffInputs.${index}`, message: "handoff input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `handoffInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `handoffInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `handoffInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `handoffInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `handoffSections.${index}`, message: "handoff section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `handoffSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `handoffSections.${index}.label`, message: "label is required." });
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
  if (field.required !== true) {
    details.push({ field: `externalReceiptFields.${index}.required`, message: "Expected true." });
  }
  if (field.redacted !== true) {
    details.push({ field: `externalReceiptFields.${index}.redacted`, message: "Expected true." });
  }
  if (field.storeOutsideGit !== true) {
    details.push({ field: `externalReceiptFields.${index}.storeOutsideGit`, message: "Expected true." });
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
  if (!cleanString(policy.finalReceiptOwner)) {
    details.push({ field: "receiptPolicy.finalReceiptOwner", message: "finalReceiptOwner is required." });
  }
}

export function readReleaseArchiveHandoffReceiptManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveHandoffReceiptManifest(rawManifest) {
  const details = [];
  if (!isPlainObject(rawManifest)) {
    throw new Stage6JReleaseArchiveHandoffReceiptError([{ field: "manifest", message: "manifest must be an object." }]);
  }
  const manifest = { ...rawManifest };
  if (manifest.stage !== "6J") details.push({ field: "stage", message: "Expected 6J." });
  if (manifest.packageId !== "stage6j-production-release-archive-handoff-receipt") {
    details.push({ field: "packageId", message: "Unexpected packageId." });
  }
  manifest.releaseArchiveIndexManifest = validateSafeRelativePath(
    manifest.releaseArchiveIndexManifest,
    "releaseArchiveIndexManifest",
    details,
  );
  validateBoundary(manifest.productBoundary, details);
  manifest.handoffInputs = Array.isArray(manifest.handoffInputs)
    ? manifest.handoffInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  manifest.handoffSections = Array.isArray(manifest.handoffSections)
    ? manifest.handoffSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  manifest.externalReceiptFields = Array.isArray(manifest.externalReceiptFields)
    ? manifest.externalReceiptFields.map((item, index) => normalizeReceiptField(item, index, details)).filter(Boolean)
    : [];
  manifest.receiptGates = Array.isArray(manifest.receiptGates)
    ? manifest.receiptGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(manifest.handoffInputs, REQUIRED_INPUT_KEYS, "handoffInputs", details);
  requireKeys(manifest.handoffSections, REQUIRED_SECTION_KEYS, "handoffSections", details);
  requireKeys(manifest.externalReceiptFields, REQUIRED_RECEIPT_FIELD_KEYS, "externalReceiptFields", details);
  requireKeys(manifest.receiptGates, REQUIRED_GATE_KEYS, "receiptGates", details);
  validatePolicy(manifest.receiptPolicy, details);
  scanValue(manifest, "manifest", details);
  if (details.length > 0) throw new Stage6JReleaseArchiveHandoffReceiptError(details);
  return manifest;
}

export function detectReleaseArchiveHandoffReceiptLeaks(value) {
  const details = [];
  scanValue(value, "value", details);
  return [...new Set(details.map((item) => item.message.replace(/^.*forbidden value: /, "").replace(/\.$/, "")))];
}

function statusForInput(root, input) {
  const absolutePath = resolve(root, input.path);
  return {
    ...input,
    present: existsSync(absolutePath),
  };
}

export function buildProductionReleaseArchiveHandoffReceipt({
  manifest = readReleaseArchiveHandoffReceiptManifest(),
  root = REPO_ROOT,
  generatedAt = DEFAULT_NOW,
} = {}) {
  const validated = validateReleaseArchiveHandoffReceiptManifest(manifest);
  const releaseArchiveIndexManifest = validateReleaseArchiveIndexManifest(
    readReleaseArchiveIndexManifest(validated.releaseArchiveIndexManifest),
  );
  const releaseArchiveIndex = buildProductionReleaseArchiveIndex({
    manifest: releaseArchiveIndexManifest,
    root,
    generatedAt,
  });
  const inputs = validated.handoffInputs.map((input) => statusForInput(root, input));
  const missingRequiredInputs = inputs.filter((input) => input.required && !input.present);
  const externalReceiptFieldCount = validated.externalReceiptFields.length;
  const externalReceiptFieldsStoredOutsideGit = validated.externalReceiptFields.every((field) => field.storeOutsideGit);
  const leakFindings = detectReleaseArchiveHandoffReceiptLeaks(validated);
  const readyForExternalReleaseArchiveHandoffReceipt =
    releaseArchiveIndex.status === "ready" &&
    missingRequiredInputs.length === 0 &&
    externalReceiptFieldsStoredOutsideGit &&
    leakFindings.length === 0;

  return {
    stage: "6J",
    packageId: validated.packageId,
    generatedAt,
    status: readyForExternalReleaseArchiveHandoffReceipt ? "ready" : "blocked",
    readyForExternalReleaseArchiveHandoffReceipt,
    releaseArchiveIndex: {
      status: releaseArchiveIndex.status,
      readyForExternalReleaseArchiveIndex: releaseArchiveIndex.readyForExternalReleaseArchiveIndex,
      releaseArchiveContentsStoredOutsideGit: releaseArchiveIndex.releaseArchiveContentsStoredOutsideGit,
      archiveOutcomeKnownToRepository: releaseArchiveIndex.archiveOutcomeKnownToRepository,
    },
    releaseArchiveIndexStoredInGit: true,
    archiveHandoffReceiptStoredInGit: true,
    externalArchiveReceiptStoredOutsideGit: validated.productBoundary.externalArchiveReceiptStoredOutsideGit,
    releaseArchiveContentsStoredOutsideGit: validated.productBoundary.releaseArchiveContentsStoredOutsideGit,
    archiveReceiptOutcomeKnownToRepository: validated.productBoundary.archiveReceiptOutcomeKnownToRepository,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveArchiveVerifiedByThisReport: false,
    externalReceiptFieldCount,
    externalReceiptFieldsStoredOutsideGit,
    handoffInputs: inputs,
    missingRequiredInputs: missingRequiredInputs.map((input) => input.key),
    handoffSections: validated.handoffSections,
    receiptGates: validated.receiptGates,
    productBoundary: validated.productBoundary,
    receiptPolicy: validated.receiptPolicy,
    leakFindings,
  };
}

export function renderProductionReleaseArchiveHandoffReceiptMarkdown(report) {
  const lines = [
    "# Stage 6J production release archive handoff receipt",
    "",
    `- Generated at: \`${report.generatedAt}\``,
    `- Status: \`${report.status}\``,
    `- Ready for external release archive handoff receipt: \`${report.readyForExternalReleaseArchiveHandoffReceipt}\``,
    `- Stage 6I release archive index status: \`${report.releaseArchiveIndex.status}\``,
    `- Ready for external release archive index: \`${report.releaseArchiveIndex.readyForExternalReleaseArchiveIndex}\``,
    `- Release archive index stored in git: \`${report.releaseArchiveIndexStoredInGit}\``,
    `- Archive handoff receipt stored in git: \`${report.archiveHandoffReceiptStoredInGit}\``,
    `- Release archive contents stored outside git: \`${report.releaseArchiveContentsStoredOutsideGit}\``,
    `- External archive receipt stored outside git: \`${report.externalArchiveReceiptStoredOutsideGit}\``,
    `- Archive receipt outcome known to repository: \`${report.archiveReceiptOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live archive verified by this report: \`${report.liveArchiveVerifiedByThisReport}\``,
    `- Leak findings: \`${report.leakFindings.length}\``,
    "",
    "## Handoff inputs",
    "",
  ];
  for (const input of report.handoffInputs) {
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
  lines.push("- The repository stores the receipt schema, redacted field names, gates, and safe pointers.");
  lines.push("- The repository does not store the final archive receipt outcome, raw archive contents, logs, metrics, credentials, backup contents, or patient-identifying content.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6JArgs(argv = process.argv.slice(2)) {
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

export function runStage6JProductionReleaseArchiveHandoffReceipt(options = {}) {
  const manifest = readReleaseArchiveHandoffReceiptManifest(options.manifest ?? DEFAULT_MANIFEST);
  const report = buildProductionReleaseArchiveHandoffReceipt({
    manifest,
    root: options.root ?? REPO_ROOT,
    generatedAt: options.generatedAt ?? options.now ?? DEFAULT_NOW,
  });
  const markdown = renderProductionReleaseArchiveHandoffReceiptMarkdown(report);
  if (options.summaryPath) writeOutput(options.summaryPath, markdown);
  if (options.jsonOut) writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (options.dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage6JArgs(argv);
    const result = runStage6JProductionReleaseArchiveHandoffReceipt({
      manifest: args.manifest,
      summaryPath: args.summaryPath,
      jsonOut: args.jsonOut,
      generatedAt: args.now,
      dryRun: args.dryRun,
    });
    if (!args.dryRun && !args.summaryPath && !args.jsonOut) {
      process.stdout.write(`${result.markdown}\n`);
    }
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[stage6j-production-release-archive-handoff-receipt] failed: ${error.message}`);
    if (error?.details) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
