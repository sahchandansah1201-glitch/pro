#!/usr/bin/env node
// Stage 6H · production release memory closure package.
// Builds an offline, redacted closure contract for operator-owned
// post-go-live monitoring. The command reads repository evidence only, performs no network calls,
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
  buildProductionPostGoLiveObservation,
  readPostGoLiveObservationManifest,
  validatePostGoLiveObservationManifest,
} from "./stage6g-production-post-go-live-observation.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-memory-closure.stage6h.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6h-production-release-memory-closure.md";
const DEFAULT_JSON_PATH = "test-results/stage6h-production-release-memory-closure.json";
const DEFAULT_NOW = "2026-05-15T14:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6g_post_go_live_observation",
  "stage6g_observation_generator",
  "stage6f_go_live_decision_record",
  "stage6f_decision_record_generator",
  "stage6e_go_live_handoff",
  "stage6d_live_install_evidence_receipt",
  "stage6c_install_verification",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "closure_scope",
  "external_decision_reference",
  "closure_window_reference",
  "health_check_summary_reference",
  "smoke_summary_reference",
  "audit_review_reference",
  "rollback_watch",
  "followup_actions",
];

const REQUIRED_EXTERNAL_FIELD_KEYS = [
  "closure_record_id",
  "closure_window_start_utc",
  "closure_window_end_utc",
  "operator_decision_reference",
  "health_check_reference",
  "smoke_evidence_reference",
  "audit_review_reference",
  "rollback_owner_reference",
  "closure_owner_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6g_ready",
  "stage6g_report",
  "preflight_all_dry_run",
  "no_deno_lock",
  "backend_guardrails_green",
  "external_decision_record_present",
  "external_closure_window_recorded",
  "external_health_smoke_reviewed",
  "external_audit_reviewed",
  "rollback_watch_recorded",
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

export class Stage6HReleaseMemoryClosureError extends Error {
  constructor(details = []) {
    super("Stage 6H production release memory closure failed validation.");
    this.name = "Stage6HReleaseMemoryClosureError";
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
        details.push({ field: path, message: `Release memory closure package contains forbidden value: ${code}.` });
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
    closureEvidenceStoredOutsideGit: true,
    releaseMemoryClosureBundledInRepository: false,
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

function normalizeExternalField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalClosureFields.${index}`, message: "closure field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalClosureFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalClosureFields.${index}.label`, message: "label is required." });
  if (field.redacted !== true) {
    details.push({ field: `externalClosureFields.${index}.redacted`, message: "Expected true." });
  }
  if (field.storeOutsideGit !== true) {
    details.push({ field: `externalClosureFields.${index}.storeOutsideGit`, message: "Expected true." });
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

function validateClosurePolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "closurePolicy", message: "closurePolicy is required." });
    return {};
  }
  const expected = {
    repositoryContainsLiveSecrets: false,
    repositoryContainsPatientData: false,
    repositoryContainsRawLiveEvidence: false,
    repositoryContainsFinalApproval: false,
    repositoryContainsLiveLogs: false,
    repositoryContainsLiveMetrics: false,
    closureEvidenceStoredOutsideGit: true,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
    productRuntimeCallsExternalSystems: false,
    demoFallbackInProduction: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (policy[key] !== value) {
      details.push({ field: `closurePolicy.${key}`, message: `Expected ${String(value)}.` });
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
    "selfHostedRuntimeOnly",
    "operatorOwnedDatabase",
    "operatorOwnedObjectStorage",
    "productionModeHasNoDemoFallback",
    "finalDecisionIsExternal",
    "closureEvidenceIsExternal",
    "noFinalApprovalInGit",
    "noLiveEvidenceInGit",
    "noLiveLogsInGit",
    "noLiveMetricsInGit",
    "noPatientDataInGit",
    "noSecretsInGit",
    "stage6gObservationIsExternal",
    "releaseMemoryUpdateIsExternal",
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

export function readReleaseMemoryClosureManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseMemoryClosureManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6HReleaseMemoryClosureError([{ field: "manifest", message: "Release memory closure manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);

  const closureInputs = Array.isArray(input.closureInputs)
    ? input.closureInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  requireKeys(closureInputs, REQUIRED_INPUT_KEYS, "closureInputs", details);

  const closureSections = Array.isArray(input.closureSections)
    ? input.closureSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  requireKeys(closureSections, REQUIRED_SECTION_KEYS, "closureSections", details);

  const externalClosureFields = Array.isArray(input.externalClosureFields)
    ? input.externalClosureFields.map((item, index) => normalizeExternalField(item, index, details)).filter(Boolean)
    : [];
  requireKeys(externalClosureFields, REQUIRED_EXTERNAL_FIELD_KEYS, "externalClosureFields", details);

  const closureGates = Array.isArray(input.closureGates)
    ? input.closureGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(closureGates, REQUIRED_GATE_KEYS, "closureGates", details);

  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  const postGoLiveObservationManifest = validateSafeRelativePath(
    input.postGoLiveObservationManifest,
    "postGoLiveObservationManifest",
    details,
  );
  const closurePolicy = validateClosurePolicy(input.closurePolicy, details);
  const safetyAssertions = validateSafetyAssertions(input.safetyAssertions, details);
  if (details.length > 0) throw new Stage6HReleaseMemoryClosureError(details);

  return {
    stage: cleanString(input.stage) || "6H",
    packageId: cleanString(input.packageId) || "stage6h-production-release-memory-closure",
    generatedAt,
    postGoLiveObservationManifest,
    productBoundary: { ...input.productBoundary },
    closureInputs,
    closureSections,
    externalClosureFields,
    closureGates,
    closurePolicy,
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

export function detectReleaseMemoryClosureLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildProductionReleaseMemoryClosure({
  manifest,
  root = REPO_ROOT,
  generatedAt,
} = {}) {
  const normalized = validateReleaseMemoryClosureManifest(manifest);
  const stage6gManifest = validatePostGoLiveObservationManifest(
    readPostGoLiveObservationManifest(normalized.postGoLiveObservationManifest),
  );
  const observation = buildProductionPostGoLiveObservation({
    manifest: stage6gManifest,
    root,
    generatedAt: stage6gManifest.generatedAt,
  });

  const inventory = normalized.closureInputs.map((input) => inputPresence(root, input));
  const missingRequiredInputs = inventory
    .filter((input) => input.required && !input.present)
    .map((input) => input.path);

  const checks = {
    stage6gReady:
      observation.status === "ready" &&
      observation.readyForExternalPostGoLiveObservation === true,
    allRequiredInputsPresent: missingRequiredInputs.length === 0,
    closureSectionsPresent: REQUIRED_SECTION_KEYS.every((key) => normalized.closureSections.some((section) => section.key === key)),
    externalClosureFieldsPresent: REQUIRED_EXTERNAL_FIELD_KEYS.every((key) => normalized.externalClosureFields.some((field) => field.key === key)),
    externalClosureFieldsStoredOutsideGit: normalized.externalClosureFields.every((field) => field.redacted === true && field.storeOutsideGit === true),
    closureGatesPresent: REQUIRED_GATE_KEYS.every((key) => normalized.closureGates.some((gate) => gate.key === key)),
    closurePolicySafe:
      normalized.closurePolicy.repositoryContainsLiveSecrets === false &&
      normalized.closurePolicy.repositoryContainsPatientData === false &&
      normalized.closurePolicy.repositoryContainsRawLiveEvidence === false &&
      normalized.closurePolicy.repositoryContainsFinalApproval === false &&
      normalized.closurePolicy.repositoryContainsLiveLogs === false &&
      normalized.closurePolicy.repositoryContainsLiveMetrics === false &&
      normalized.closurePolicy.closureEvidenceStoredOutsideGit === true &&
      normalized.closurePolicy.managedRuntimeDependency === "none" &&
      normalized.closurePolicy.managedDatabaseDependency === "none" &&
      normalized.closurePolicy.productRuntimeCallsExternalSystems === false &&
      normalized.closurePolicy.demoFallbackInProduction === false,
    safetyAssertionsGreen: Object.values(normalized.safetyAssertions).every((value) => value === true),
    stage6hScriptsPresent: [
      "test:stage6h",
      "check:stage6h",
      "preflight:stage6h",
      "closure:stage6h:dry-run",
      "closure:stage6h:report",
    ].every((script) => packageScriptPresent(root, script)),
  };

  const reportCandidate = {
    stage: "6H",
    packageId: normalized.packageId,
    generatedAt: generatedAt || normalized.generatedAt,
    postGoLiveObservation: {
      manifest: normalized.postGoLiveObservationManifest,
      status: observation.status,
      readyForExternalPostGoLiveObservation: observation.readyForExternalPostGoLiveObservation,
      observationEvidenceStoredOutsideGit: observation.observationEvidenceStoredOutsideGit,
      observationOutcomeKnownToRepository: observation.observationOutcomeKnownToRepository,
      goLiveApprovedByThisReport: observation.goLiveApprovedByThisReport,
      liveServerGoLiveVerifiedByThisReport: observation.liveServerGoLiveVerifiedByThisReport,
      liveObservationVerifiedByThisReport: observation.liveObservationVerifiedByThisReport,
    },
    productBoundary: normalized.productBoundary,
    inventory,
    closureSections: normalized.closureSections,
    externalClosureFields: normalized.externalClosureFields,
    closureGates: normalized.closureGates,
    closurePolicy: normalized.closurePolicy,
    checks,
    missingRequiredInputs,
    releaseMemoryClosureStoredInGit: false,
    closureEvidenceStoredOutsideGit: true,
    closureOutcomeKnownToRepository: false,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveClosureVerifiedByThisReport: false,
    repositoryContainsLiveLogs: false,
    repositoryContainsLiveMetrics: false,
  };
  const leakFindings = detectReleaseMemoryClosureLeaks(JSON.stringify(reportCandidate));
  const ready = Object.values(checks).every(Boolean) && leakFindings.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "ready" : "blocked",
    readyForExternalReleaseMemoryClosure: ready,
    leakFindings,
  };
}

export function renderProductionReleaseMemoryClosureMarkdown(report) {
  const lines = [
    "# Stage 6H production release memory closure",
    "",
    `- Status: \`${report.status}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Ready for external release memory closure: \`${report.readyForExternalReleaseMemoryClosure}\``,
    `- Closure evidence stored outside git: \`${report.closureEvidenceStoredOutsideGit}\``,
    `- Closure outcome known to repository: \`${report.closureOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live closure verified by this report: \`${report.liveClosureVerifiedByThisReport}\``,
    `- Stage 6G post-go-live observation status: \`${report.postGoLiveObservation.status}\``,
    `- Leak findings: ${report.leakFindings.length}`,
    "",
    "## Checks",
    "",
  ];
  for (const [key, value] of Object.entries(report.checks)) {
    lines.push(`- ${value ? "OK" : "BLOCKED"} \`${key}\``);
  }
  lines.push("");
  lines.push("## Required closure inputs");
  lines.push("");
  for (const input of report.inventory) {
    lines.push(`- ${input.present ? "OK" : "MISSING"} ${input.label} — \`${input.path}\``);
  }
  lines.push("");
  lines.push("## Closure sections");
  lines.push("");
  for (const section of report.closureSections) {
    lines.push(`- ${section.required ? "Required" : "Optional"}: ${section.label}${section.storeOutsideGit ? " (external record)" : ""}`);
  }
  lines.push("");
  lines.push("## Closure gates");
  lines.push("");
  for (const gate of report.closureGates) {
    lines.push(`- ${gate.label}: \`${gate.command}\``);
  }
  lines.push("");
  lines.push("## Privacy boundary");
  lines.push("");
  lines.push("- Managed runtime/database dependency: none.");
  lines.push("- The repository does not contain final approval, raw production evidence, live logs, live metrics, patient data, credentials, object keys, or backup contents.");
  lines.push("- The operator's closure id, health-check evidence, smoke evidence, audit review, rollback watch, and final closure outcome remain outside git.");
  lines.push("- This report prepares a release memory closure contract; it does not approve or verify a live production go-live.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6HArgs(argv = []) {
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

export function runStage6HProductionReleaseMemoryClosure({
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt = DEFAULT_NOW,
  dryRun = false,
  root = REPO_ROOT,
} = {}) {
  const report = buildProductionReleaseMemoryClosure({
    manifest: readReleaseMemoryClosureManifest(manifestPath),
    root,
    generatedAt,
  });
  const markdown = renderProductionReleaseMemoryClosureMarkdown(report);
  if (!dryRun) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(summaryPath, markdown);
    writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseStage6HArgs(argv);
  const result = runStage6HProductionReleaseMemoryClosure({
    manifestPath: args.manifest,
    summaryPath: args.summaryPath,
    jsonOut: args.jsonOut,
    generatedAt: args.now,
    dryRun: args.dryRun,
  });
  process.stdout.write(result.markdown);
  if (!args.dryRun) {
    process.stdout.write(`\n[stage6h] wrote ${args.summaryPath}\n`);
    process.stdout.write(`[stage6h] wrote ${args.jsonOut}\n`);
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`[stage6h] ${error.message}`);
    if (Array.isArray(error.details)) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    process.exit(1);
  }
}
