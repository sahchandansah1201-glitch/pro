#!/usr/bin/env node
// Stage 6I · production release archive index.
// Builds an offline, redacted archive index for the Stage 6A-6H release chain.
// The command reads repository evidence only, performs no network calls,
// and does not approve or verify a live production go-live.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProductionReleaseMemoryClosure,
  readReleaseMemoryClosureManifest,
  validateReleaseMemoryClosureManifest,
} from "./stage6h-production-release-memory-closure.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-index.stage6i.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6i-production-release-archive-index.md";
const DEFAULT_JSON_PATH = "test-results/stage6i-production-release-archive-index.json";
const DEFAULT_NOW = "2026-05-16T14:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6h_release_memory_closure",
  "stage6h_closure_generator",
  "stage6g_post_go_live_observation",
  "stage6f_go_live_decision_record",
  "stage6e_go_live_handoff",
  "stage6d_live_install_evidence_receipt",
  "stage6c_install_verification",
  "stage6b_server_install_package",
  "stage6a_acceptance_baseline",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "release_status_dashboard",
];

const REQUIRED_SECTION_KEYS = [
  "release_chain_summary",
  "evidence_manifest_index",
  "external_records_pointer",
  "operator_handoff_pointer",
  "production_boundary",
  "verification_commands",
  "retention_policy",
  "next_cycle_entrypoints",
];

const REQUIRED_EXTERNAL_RECORD_KEYS = [
  "live_install_evidence_location",
  "go_live_decision_location",
  "observation_evidence_location",
  "release_memory_closure_location",
  "operator_archive_owner",
  "retention_policy_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6h_ready",
  "stage6h_report",
  "stage6a_to_6h_manifests_present",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "backend_guardrails_green",
  "external_archive_owner_recorded",
];

const STAGE_MANIFEST_PATHS = [
  "deploy/self-hosted/acceptance-baseline.stage6a.json",
  "deploy/self-hosted/server-install-package.stage6b.json",
  "deploy/self-hosted/install-verification.stage6c.json",
  "deploy/self-hosted/live-install-evidence.stage6d.json",
  "deploy/self-hosted/go-live-handoff.stage6e.json",
  "deploy/self-hosted/go-live-decision-record.stage6f.json",
  "deploy/self-hosted/post-go-live-observation.stage6g.json",
  "deploy/self-hosted/release-memory-closure.stage6h.json",
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

export class Stage6IReleaseArchiveIndexError extends Error {
  constructor(details = []) {
    super("Stage 6I production release archive index failed validation.");
    this.name = "Stage6IReleaseArchiveIndexError";
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
        details.push({ field: path, message: `Release archive index contains forbidden value: ${code}.` });
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
    archiveIndexBundledInRepository: true,
    releaseArchiveContentsStoredOutsideGit: true,
    closureEvidenceStoredOutsideGit: true,
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
    details.push({ field: `archiveInputs.${index}`, message: "archive input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `archiveInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `archiveInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `archiveInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `archiveInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `archiveSections.${index}`, message: "archive section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `archiveSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `archiveSections.${index}.label`, message: "label is required." });
  return {
    key,
    label,
    required: section.required !== false,
    storeOutsideGit: section.storeOutsideGit === true,
  };
}

function normalizeExternalRecord(record, index, details) {
  if (!isPlainObject(record)) {
    details.push({ field: `externalArchiveRecords.${index}`, message: "external record must be an object." });
    return null;
  }
  const key = cleanString(record.key);
  const label = cleanString(record.label);
  if (!key) details.push({ field: `externalArchiveRecords.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalArchiveRecords.${index}.label`, message: "label is required." });
  if (record.redacted !== true) {
    details.push({ field: `externalArchiveRecords.${index}.redacted`, message: "Expected true." });
  }
  if (record.storeOutsideGit !== true) {
    details.push({ field: `externalArchiveRecords.${index}.storeOutsideGit`, message: "Expected true." });
  }
  return { key, label, redacted: record.redacted === true, storeOutsideGit: record.storeOutsideGit === true };
}

function normalizeGate(gate, index, details) {
  if (!isPlainObject(gate)) {
    details.push({ field: `archiveGates.${index}`, message: "archive gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `archiveGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `archiveGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `archiveGates.${index}.command`, message: "command is required." });
  return { key, label, command, required: gate.required !== false };
}

function validateArchivePolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "archivePolicy", message: "archivePolicy is required." });
    return {};
  }
  const expected = {
    repositoryContainsArchiveIndex: true,
    repositoryContainsArchiveContents: false,
    repositoryContainsLiveSecrets: false,
    repositoryContainsPatientData: false,
    repositoryContainsRawLiveEvidence: false,
    repositoryContainsFinalApproval: false,
    repositoryContainsLiveLogs: false,
    repositoryContainsLiveMetrics: false,
    externalArchiveRecordsStoredOutsideGit: true,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
    productRuntimeCallsExternalSystems: false,
    demoFallbackInProduction: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (policy[key] !== value) {
      details.push({ field: `archivePolicy.${key}`, message: `Expected ${String(value)}.` });
    }
  }
  return { ...policy };
}

function validateSafetyAssertions(assertions, details) {
  if (!isPlainObject(assertions)) {
    details.push({ field: "safetyAssertions", message: "safetyAssertions is required." });
    return {};
  }
  const required = [
    "selfHostedOnly",
    "noManagedRuntimeDependency",
    "noManagedDatabaseDependency",
    "noLiveLogsInGit",
    "noLiveMetricsInGit",
    "noPatientDataInGit",
    "noSecretsInGit",
    "stage6hClosureIsReady",
    "releaseArchiveContentsAreExternal",
    "archiveIndexIsRepositorySafe",
  ];
  for (const key of required) {
    if (assertions[key] !== true) {
      details.push({ field: `safetyAssertions.${key}`, message: "Expected true." });
    }
  }
  return { ...assertions };
}

function requireKeys(items, requiredKeys, field, details) {
  const keys = items.map((item) => item.key);
  const missing = requiredKeys.filter((key) => !keys.includes(key));
  if (missing.length > 0) {
    details.push({ field, message: `Missing keys: ${missing.join(", ")}.` });
  }
}

export function readReleaseArchiveIndexManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveIndexManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6IReleaseArchiveIndexError([{ field: "manifest", message: "Release archive index manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);

  const archiveInputs = Array.isArray(input.archiveInputs)
    ? input.archiveInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  requireKeys(archiveInputs, REQUIRED_INPUT_KEYS, "archiveInputs", details);

  const archiveSections = Array.isArray(input.archiveSections)
    ? input.archiveSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  requireKeys(archiveSections, REQUIRED_SECTION_KEYS, "archiveSections", details);

  const externalArchiveRecords = Array.isArray(input.externalArchiveRecords)
    ? input.externalArchiveRecords.map((item, index) => normalizeExternalRecord(item, index, details)).filter(Boolean)
    : [];
  requireKeys(externalArchiveRecords, REQUIRED_EXTERNAL_RECORD_KEYS, "externalArchiveRecords", details);

  const archiveGates = Array.isArray(input.archiveGates)
    ? input.archiveGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(archiveGates, REQUIRED_GATE_KEYS, "archiveGates", details);

  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  const releaseMemoryClosureManifest = validateSafeRelativePath(
    input.releaseMemoryClosureManifest,
    "releaseMemoryClosureManifest",
    details,
  );
  const archivePolicy = validateArchivePolicy(input.archivePolicy, details);
  const safetyAssertions = validateSafetyAssertions(input.safetyAssertions, details);
  if (details.length > 0) throw new Stage6IReleaseArchiveIndexError(details);

  return {
    stage: cleanString(input.stage) || "6I",
    packageId: cleanString(input.packageId) || "stage6i-production-release-archive-index",
    generatedAt,
    releaseMemoryClosureManifest,
    productBoundary: { ...input.productBoundary },
    archiveInputs,
    archiveSections,
    externalArchiveRecords,
    archiveGates,
    archivePolicy,
    safetyAssertions,
  };
}

function inputPresence(root, input) {
  const absolutePath = join(root, input.path);
  if (!existsSync(absolutePath)) return { ...input, present: false };
  const stats = statSync(absolutePath);
  const typeMatches = input.kind === "directory" ? stats.isDirectory() : stats.isFile();
  return { ...input, present: typeMatches };
}

function packageScriptPresent(root, scriptName) {
  const parsed = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return Boolean(parsed.scripts?.[scriptName]);
}

function stageManifestPresence(root) {
  return STAGE_MANIFEST_PATHS.map((path) => ({ path, present: existsSync(join(root, path)) }));
}

export function detectReleaseArchiveIndexLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildProductionReleaseArchiveIndex({
  manifest,
  root = REPO_ROOT,
  generatedAt,
} = {}) {
  const normalized = validateReleaseArchiveIndexManifest(manifest);
  const stage6hManifest = validateReleaseMemoryClosureManifest(
    readReleaseMemoryClosureManifest(normalized.releaseMemoryClosureManifest),
  );
  const closure = buildProductionReleaseMemoryClosure({
    manifest: stage6hManifest,
    root,
    generatedAt: stage6hManifest.generatedAt,
  });

  const inventory = normalized.archiveInputs.map((input) => inputPresence(root, input));
  const missingRequiredInputs = inventory
    .filter((input) => input.required && !input.present)
    .map((input) => input.path);
  const stageManifests = stageManifestPresence(root);

  const checks = {
    stage6hReady:
      closure.status === "ready" &&
      closure.readyForExternalReleaseMemoryClosure === true,
    allRequiredInputsPresent: missingRequiredInputs.length === 0,
    stage6aTo6hManifestsPresent: stageManifests.every((item) => item.present),
    archiveSectionsPresent: REQUIRED_SECTION_KEYS.every((key) => normalized.archiveSections.some((section) => section.key === key)),
    externalArchiveRecordsPresent: REQUIRED_EXTERNAL_RECORD_KEYS.every((key) => normalized.externalArchiveRecords.some((record) => record.key === key)),
    externalArchiveRecordsStoredOutsideGit: normalized.externalArchiveRecords.every((record) => record.redacted === true && record.storeOutsideGit === true),
    archiveGatesPresent: REQUIRED_GATE_KEYS.every((key) => normalized.archiveGates.some((gate) => gate.key === key)),
    archivePolicySafe:
      normalized.archivePolicy.repositoryContainsArchiveIndex === true &&
      normalized.archivePolicy.repositoryContainsArchiveContents === false &&
      normalized.archivePolicy.repositoryContainsLiveSecrets === false &&
      normalized.archivePolicy.repositoryContainsPatientData === false &&
      normalized.archivePolicy.repositoryContainsRawLiveEvidence === false &&
      normalized.archivePolicy.repositoryContainsFinalApproval === false &&
      normalized.archivePolicy.repositoryContainsLiveLogs === false &&
      normalized.archivePolicy.repositoryContainsLiveMetrics === false &&
      normalized.archivePolicy.externalArchiveRecordsStoredOutsideGit === true &&
      normalized.archivePolicy.managedRuntimeDependency === "none" &&
      normalized.archivePolicy.managedDatabaseDependency === "none" &&
      normalized.archivePolicy.productRuntimeCallsExternalSystems === false &&
      normalized.archivePolicy.demoFallbackInProduction === false,
    safetyAssertionsGreen: Object.values(normalized.safetyAssertions).every((value) => value === true),
    stage6iScriptsPresent: [
      "test:stage6i",
      "check:stage6i",
      "preflight:stage6i",
      "archive:stage6i:dry-run",
      "archive:stage6i:report",
    ].every((script) => packageScriptPresent(root, script)),
  };

  const reportCandidate = {
    stage: "6I",
    packageId: normalized.packageId,
    generatedAt: generatedAt || normalized.generatedAt,
    releaseMemoryClosure: {
      manifest: normalized.releaseMemoryClosureManifest,
      status: closure.status,
      readyForExternalReleaseMemoryClosure: closure.readyForExternalReleaseMemoryClosure,
      closureEvidenceStoredOutsideGit: closure.closureEvidenceStoredOutsideGit,
      closureOutcomeKnownToRepository: closure.closureOutcomeKnownToRepository,
      goLiveApprovedByThisReport: closure.goLiveApprovedByThisReport,
      liveServerGoLiveVerifiedByThisReport: closure.liveServerGoLiveVerifiedByThisReport,
      liveClosureVerifiedByThisReport: closure.liveClosureVerifiedByThisReport,
    },
    productBoundary: normalized.productBoundary,
    inventory,
    stageManifests,
    archiveSections: normalized.archiveSections,
    externalArchiveRecords: normalized.externalArchiveRecords,
    archiveGates: normalized.archiveGates,
    archivePolicy: normalized.archivePolicy,
    checks,
    missingRequiredInputs,
    releaseArchiveIndexStoredInGit: true,
    releaseArchiveContentsStoredOutsideGit: true,
    archiveOutcomeKnownToRepository: false,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveArchiveVerifiedByThisReport: false,
    repositoryContainsLiveLogs: false,
    repositoryContainsLiveMetrics: false,
  };
  const leakFindings = detectReleaseArchiveIndexLeaks(JSON.stringify(reportCandidate));
  const ready = Object.values(checks).every(Boolean) && leakFindings.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "ready" : "blocked",
    readyForExternalReleaseArchiveIndex: ready,
    leakFindings,
  };
}

export function renderProductionReleaseArchiveIndexMarkdown(report) {
  const lines = [
    "# Stage 6I production release archive index",
    "",
    `- Status: \`${report.status}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Ready for external release archive index: \`${report.readyForExternalReleaseArchiveIndex}\``,
    `- Release archive index stored in git: \`${report.releaseArchiveIndexStoredInGit}\``,
    `- Release archive contents stored outside git: \`${report.releaseArchiveContentsStoredOutsideGit}\``,
    `- Archive outcome known to repository: \`${report.archiveOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live archive verified by this report: \`${report.liveArchiveVerifiedByThisReport}\``,
    `- Stage 6H release memory closure status: \`${report.releaseMemoryClosure.status}\``,
    `- Leak findings: ${report.leakFindings.length}`,
    "",
    "## Checks",
    "",
  ];
  for (const [key, value] of Object.entries(report.checks)) {
    lines.push(`- ${value ? "OK" : "BLOCKED"} \`${key}\``);
  }
  lines.push("");
  lines.push("## Stage 6 manifest chain");
  lines.push("");
  for (const item of report.stageManifests) {
    lines.push(`- ${item.present ? "OK" : "MISSING"} \`${item.path}\``);
  }
  lines.push("");
  lines.push("## Required archive inputs");
  lines.push("");
  for (const input of report.inventory) {
    lines.push(`- ${input.present ? "OK" : "MISSING"} ${input.label} — \`${input.path}\``);
  }
  lines.push("");
  lines.push("## Archive sections");
  lines.push("");
  for (const section of report.archiveSections) {
    lines.push(`- ${section.required ? "Required" : "Optional"}: ${section.label}${section.storeOutsideGit ? " (external record)" : ""}`);
  }
  lines.push("");
  lines.push("## Archive gates");
  lines.push("");
  for (const gate of report.archiveGates) {
    lines.push(`- ${gate.label}: \`${gate.command}\``);
  }
  lines.push("");
  lines.push("## Privacy boundary");
  lines.push("");
  lines.push("- Managed runtime/database dependency: none.");
  lines.push("- The repository contains only the redacted archive index; archive contents and final closure records remain outside git.");
  lines.push("- The repository does not contain final approval, raw production evidence, live logs, live metrics, patient data, credentials, object keys, or backup contents.");
  lines.push("- This report prepares a release archive index; it does not approve or verify a live production go-live.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6IArgs(argv = []) {
  const parsed = {
    manifest: DEFAULT_MANIFEST,
    summaryPath: DEFAULT_SUMMARY_PATH,
    jsonOut: DEFAULT_JSON_PATH,
    dryRun: false,
    now: DEFAULT_NOW,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--manifest") {
      parsed.manifest = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      parsed.summaryPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      parsed.jsonOut = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--now") {
      parsed.now = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (key !== "dryRun" && !value) throw new Error(`Missing value for ${key}.`);
  }
  return parsed;
}

export function runStage6IProductionReleaseArchiveIndex({
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt = DEFAULT_NOW,
  dryRun = false,
  root = REPO_ROOT,
} = {}) {
  const report = buildProductionReleaseArchiveIndex({
    manifest: readReleaseArchiveIndexManifest(manifestPath),
    root,
    generatedAt,
  });
  const markdown = renderProductionReleaseArchiveIndexMarkdown(report);
  if (!dryRun) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(summaryPath, markdown);
    writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseStage6IArgs(argv);
  const result = runStage6IProductionReleaseArchiveIndex({
    manifestPath: args.manifest,
    summaryPath: args.summaryPath,
    jsonOut: args.jsonOut,
    generatedAt: args.now,
    dryRun: args.dryRun,
  });
  process.stdout.write(result.markdown);
  if (!args.dryRun) {
    process.stdout.write(`\n[stage6i] wrote ${args.summaryPath}\n`);
    process.stdout.write(`[stage6i] wrote ${args.jsonOut}\n`);
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`[stage6i] ${error.message}`);
    if (Array.isArray(error.details)) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    process.exit(1);
  }
}
