#!/usr/bin/env node
// Stage 6G · production post-go-live observation package.
// Builds an offline, redacted observation contract for operator-owned
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
  buildProductionGoLiveDecisionRecord,
  readGoLiveDecisionRecordManifest,
  validateGoLiveDecisionRecordManifest,
} from "./stage6f-production-go-live-decision-record.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/post-go-live-observation.stage6g.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6g-production-post-go-live-observation.md";
const DEFAULT_JSON_PATH = "test-results/stage6g-production-post-go-live-observation.json";
const DEFAULT_NOW = "2026-05-15T14:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
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
  "observation_scope",
  "external_decision_reference",
  "observation_window_reference",
  "health_check_summary_reference",
  "smoke_summary_reference",
  "audit_review_reference",
  "rollback_watch",
  "followup_actions",
];

const REQUIRED_EXTERNAL_FIELD_KEYS = [
  "observation_record_id",
  "observation_window_start_utc",
  "observation_window_end_utc",
  "operator_decision_reference",
  "health_check_reference",
  "smoke_evidence_reference",
  "audit_review_reference",
  "rollback_owner_reference",
  "observation_owner_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6f_ready",
  "stage6f_report",
  "preflight_all_dry_run",
  "no_deno_lock",
  "backend_guardrails_green",
  "external_decision_record_present",
  "external_observation_window_recorded",
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

export class Stage6GPostGoLiveObservationError extends Error {
  constructor(details = []) {
    super("Stage 6G production post-go-live observation failed validation.");
    this.name = "Stage6GPostGoLiveObservationError";
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
        details.push({ field: path, message: `Post-go-live observation package contains forbidden value: ${code}.` });
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
    observationEvidenceStoredOutsideGit: true,
    postGoLiveObservationBundledInRepository: false,
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
    details.push({ field: `observationInputs.${index}`, message: "observation input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `observationInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `observationInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `observationInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `observationInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `observationSections.${index}`, message: "observation section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `observationSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `observationSections.${index}.label`, message: "label is required." });
  return {
    key,
    label,
    required: section.required !== false,
    storeOutsideGit: section.storeOutsideGit === true,
  };
}

function normalizeExternalField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalObservationFields.${index}`, message: "observation field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalObservationFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalObservationFields.${index}.label`, message: "label is required." });
  if (field.redacted !== true) {
    details.push({ field: `externalObservationFields.${index}.redacted`, message: "Expected true." });
  }
  if (field.storeOutsideGit !== true) {
    details.push({ field: `externalObservationFields.${index}.storeOutsideGit`, message: "Expected true." });
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
    details.push({ field: `observationGates.${index}`, message: "observation gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `observationGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `observationGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `observationGates.${index}.command`, message: "command is required." });
  return { key, label, command, required: gate.required !== false };
}

function validateObservationPolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "observationPolicy", message: "observationPolicy is required." });
    return {};
  }
  const expected = {
    repositoryContainsLiveSecrets: false,
    repositoryContainsPatientData: false,
    repositoryContainsRawLiveEvidence: false,
    repositoryContainsFinalApproval: false,
    repositoryContainsLiveLogs: false,
    repositoryContainsLiveMetrics: false,
    observationEvidenceStoredOutsideGit: true,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
    productRuntimeCallsExternalSystems: false,
    demoFallbackInProduction: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (policy[key] !== value) {
      details.push({ field: `observationPolicy.${key}`, message: `Expected ${String(value)}.` });
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
    "observationEvidenceIsExternal",
    "noFinalApprovalInGit",
    "noLiveEvidenceInGit",
    "noLiveLogsInGit",
    "noLiveMetricsInGit",
    "noPatientDataInGit",
    "noSecretsInGit",
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

export function readPostGoLiveObservationManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validatePostGoLiveObservationManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6GPostGoLiveObservationError([{ field: "manifest", message: "Post-go-live observation manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);

  const observationInputs = Array.isArray(input.observationInputs)
    ? input.observationInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  requireKeys(observationInputs, REQUIRED_INPUT_KEYS, "observationInputs", details);

  const observationSections = Array.isArray(input.observationSections)
    ? input.observationSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  requireKeys(observationSections, REQUIRED_SECTION_KEYS, "observationSections", details);

  const externalObservationFields = Array.isArray(input.externalObservationFields)
    ? input.externalObservationFields.map((item, index) => normalizeExternalField(item, index, details)).filter(Boolean)
    : [];
  requireKeys(externalObservationFields, REQUIRED_EXTERNAL_FIELD_KEYS, "externalObservationFields", details);

  const observationGates = Array.isArray(input.observationGates)
    ? input.observationGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(observationGates, REQUIRED_GATE_KEYS, "observationGates", details);

  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  const goLiveDecisionRecordManifest = validateSafeRelativePath(
    input.goLiveDecisionRecordManifest,
    "goLiveDecisionRecordManifest",
    details,
  );
  const observationPolicy = validateObservationPolicy(input.observationPolicy, details);
  const safetyAssertions = validateSafetyAssertions(input.safetyAssertions, details);
  if (details.length > 0) throw new Stage6GPostGoLiveObservationError(details);

  return {
    stage: cleanString(input.stage) || "6G",
    packageId: cleanString(input.packageId) || "stage6g-production-post-go-live-observation",
    generatedAt,
    goLiveDecisionRecordManifest,
    productBoundary: { ...input.productBoundary },
    observationInputs,
    observationSections,
    externalObservationFields,
    observationGates,
    observationPolicy,
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

export function detectPostGoLiveObservationLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildProductionPostGoLiveObservation({
  manifest,
  root = REPO_ROOT,
  generatedAt,
} = {}) {
  const normalized = validatePostGoLiveObservationManifest(manifest);
  const stage6fManifest = validateGoLiveDecisionRecordManifest(
    readGoLiveDecisionRecordManifest(normalized.goLiveDecisionRecordManifest),
  );
  const decisionRecord = buildProductionGoLiveDecisionRecord({
    manifest: stage6fManifest,
    root,
    generatedAt: stage6fManifest.generatedAt,
  });

  const inventory = normalized.observationInputs.map((input) => inputPresence(root, input));
  const missingRequiredInputs = inventory
    .filter((input) => input.required && !input.present)
    .map((input) => input.path);

  const checks = {
    stage6fReady:
      decisionRecord.status === "ready" &&
      decisionRecord.readyForExternalGoLiveDecisionRecord === true,
    allRequiredInputsPresent: missingRequiredInputs.length === 0,
    observationSectionsPresent: REQUIRED_SECTION_KEYS.every((key) => normalized.observationSections.some((section) => section.key === key)),
    externalObservationFieldsPresent: REQUIRED_EXTERNAL_FIELD_KEYS.every((key) => normalized.externalObservationFields.some((field) => field.key === key)),
    externalObservationFieldsStoredOutsideGit: normalized.externalObservationFields.every((field) => field.redacted === true && field.storeOutsideGit === true),
    observationGatesPresent: REQUIRED_GATE_KEYS.every((key) => normalized.observationGates.some((gate) => gate.key === key)),
    observationPolicySafe:
      normalized.observationPolicy.repositoryContainsLiveSecrets === false &&
      normalized.observationPolicy.repositoryContainsPatientData === false &&
      normalized.observationPolicy.repositoryContainsRawLiveEvidence === false &&
      normalized.observationPolicy.repositoryContainsFinalApproval === false &&
      normalized.observationPolicy.repositoryContainsLiveLogs === false &&
      normalized.observationPolicy.repositoryContainsLiveMetrics === false &&
      normalized.observationPolicy.observationEvidenceStoredOutsideGit === true &&
      normalized.observationPolicy.managedRuntimeDependency === "none" &&
      normalized.observationPolicy.managedDatabaseDependency === "none" &&
      normalized.observationPolicy.productRuntimeCallsExternalSystems === false &&
      normalized.observationPolicy.demoFallbackInProduction === false,
    safetyAssertionsGreen: Object.values(normalized.safetyAssertions).every((value) => value === true),
    stage6gScriptsPresent: [
      "test:stage6g",
      "check:stage6g",
      "preflight:stage6g",
      "observation:stage6g:dry-run",
      "observation:stage6g:report",
    ].every((script) => packageScriptPresent(root, script)),
  };

  const reportCandidate = {
    stage: "6G",
    packageId: normalized.packageId,
    generatedAt: generatedAt || normalized.generatedAt,
    goLiveDecisionRecord: {
      manifest: normalized.goLiveDecisionRecordManifest,
      status: decisionRecord.status,
      readyForExternalGoLiveDecisionRecord: decisionRecord.readyForExternalGoLiveDecisionRecord,
      finalDecisionStoredOutsideGit: decisionRecord.finalDecisionStoredOutsideGit,
      finalGoLiveOutcomeKnownToRepository: decisionRecord.finalGoLiveOutcomeKnownToRepository,
      goLiveApprovedByThisReport: decisionRecord.goLiveApprovedByThisReport,
      liveServerGoLiveVerifiedByThisReport: decisionRecord.liveServerGoLiveVerifiedByThisReport,
    },
    productBoundary: normalized.productBoundary,
    inventory,
    observationSections: normalized.observationSections,
    externalObservationFields: normalized.externalObservationFields,
    observationGates: normalized.observationGates,
    observationPolicy: normalized.observationPolicy,
    checks,
    missingRequiredInputs,
    postGoLiveObservationStoredInGit: false,
    observationEvidenceStoredOutsideGit: true,
    observationOutcomeKnownToRepository: false,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
    liveObservationVerifiedByThisReport: false,
    repositoryContainsLiveLogs: false,
    repositoryContainsLiveMetrics: false,
  };
  const leakFindings = detectPostGoLiveObservationLeaks(JSON.stringify(reportCandidate));
  const ready = Object.values(checks).every(Boolean) && leakFindings.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "ready" : "blocked",
    readyForExternalPostGoLiveObservation: ready,
    leakFindings,
  };
}

export function renderProductionPostGoLiveObservationMarkdown(report) {
  const lines = [
    "# Stage 6G production post-go-live observation",
    "",
    `- Status: \`${report.status}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Ready for external post-go-live observation: \`${report.readyForExternalPostGoLiveObservation}\``,
    `- Observation evidence stored outside git: \`${report.observationEvidenceStoredOutsideGit}\``,
    `- Observation outcome known to repository: \`${report.observationOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Live observation verified by this report: \`${report.liveObservationVerifiedByThisReport}\``,
    `- Stage 6F decision-record status: \`${report.goLiveDecisionRecord.status}\``,
    `- Leak findings: ${report.leakFindings.length}`,
    "",
    "## Checks",
    "",
  ];
  for (const [key, value] of Object.entries(report.checks)) {
    lines.push(`- ${value ? "OK" : "BLOCKED"} \`${key}\``);
  }
  lines.push("");
  lines.push("## Required observation inputs");
  lines.push("");
  for (const input of report.inventory) {
    lines.push(`- ${input.present ? "OK" : "MISSING"} ${input.label} — \`${input.path}\``);
  }
  lines.push("");
  lines.push("## Observation sections");
  lines.push("");
  for (const section of report.observationSections) {
    lines.push(`- ${section.required ? "Required" : "Optional"}: ${section.label}${section.storeOutsideGit ? " (external record)" : ""}`);
  }
  lines.push("");
  lines.push("## Observation gates");
  lines.push("");
  for (const gate of report.observationGates) {
    lines.push(`- ${gate.label}: \`${gate.command}\``);
  }
  lines.push("");
  lines.push("## Privacy boundary");
  lines.push("");
  lines.push("- Managed runtime/database dependency: none.");
  lines.push("- The repository does not contain final approval, raw production evidence, live logs, live metrics, patient data, credentials, object keys, or backup contents.");
  lines.push("- The operator's observation id, health-check evidence, smoke evidence, audit review, rollback watch, and final observation outcome remain outside git.");
  lines.push("- This report prepares a post-go-live observation contract; it does not approve or verify a live production go-live.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6GArgs(argv = []) {
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

export function runStage6GProductionPostGoLiveObservation({
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt = DEFAULT_NOW,
  dryRun = false,
  root = REPO_ROOT,
} = {}) {
  const report = buildProductionPostGoLiveObservation({
    manifest: readPostGoLiveObservationManifest(manifestPath),
    root,
    generatedAt,
  });
  const markdown = renderProductionPostGoLiveObservationMarkdown(report);
  if (!dryRun) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(summaryPath, markdown);
    writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseStage6GArgs(argv);
  const result = runStage6GProductionPostGoLiveObservation({
    manifestPath: args.manifest,
    summaryPath: args.summaryPath,
    jsonOut: args.jsonOut,
    generatedAt: args.now,
    dryRun: args.dryRun,
  });
  process.stdout.write(result.markdown);
  if (!args.dryRun) {
    process.stdout.write(`\n[stage6g] wrote ${args.summaryPath}\n`);
    process.stdout.write(`[stage6g] wrote ${args.jsonOut}\n`);
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`[stage6g] ${error.message}`);
    if (Array.isArray(error.details)) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    process.exit(1);
  }
}
