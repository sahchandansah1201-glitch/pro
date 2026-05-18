#!/usr/bin/env node
// Stage 6F · production go-live decision record package.
// Builds an offline, redacted decision-record contract for an operator-owned
// go-live decision. The command reads repository evidence only, performs no network calls,
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
  buildProductionGoLiveHandoff,
  readGoLiveHandoffManifest,
  validateGoLiveHandoffManifest,
} from "./stage6e-production-go-live-handoff.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/go-live-decision-record.stage6f.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6f-production-go-live-decision-record.md";
const DEFAULT_JSON_PATH = "test-results/stage6f-production-go-live-decision-record.json";
const DEFAULT_NOW = "2026-05-15T13:30:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6e_go_live_handoff",
  "stage6e_handoff_generator",
  "stage6d_live_install_evidence_receipt",
  "stage6c_install_verification",
  "stage5z_external_adapter_handoff",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "decision_scope",
  "operator_decision_reference",
  "evidence_reference",
  "go_no_go_conditions",
  "rollback_authority",
  "support_window",
  "observation_window",
  "post_decision_actions",
];

const REQUIRED_EXTERNAL_FIELD_KEYS = [
  "decision_record_id",
  "decision_timestamp_utc",
  "decision_outcome",
  "operator_approver_reference",
  "approval_channel_reference",
  "evidence_bundle_reference",
  "rollback_owner_reference",
  "observation_owner_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6e_ready",
  "stage6e_report",
  "preflight_all_dry_run",
  "no_deno_lock",
  "backend_guardrails_green",
  "operator_final_decision_external",
  "rollback_authority_external",
  "observation_window_external",
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

export class Stage6FGoLiveDecisionRecordError extends Error {
  constructor(details = []) {
    super("Stage 6F production go-live decision record failed validation.");
    this.name = "Stage6FGoLiveDecisionRecordError";
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
        details.push({ field: path, message: `Go-live decision record contains forbidden value: ${code}.` });
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
    finalDecisionStoredOutsideGit: true,
    goLiveDecisionRecordBundledInRepository: false,
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
    details.push({ field: `decisionRecordInputs.${index}`, message: "decision input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `decisionRecordInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `decisionRecordInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `decisionRecordInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `decisionRecordInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeSection(section, index, details) {
  if (!isPlainObject(section)) {
    details.push({ field: `decisionRecordSections.${index}`, message: "decision section must be an object." });
    return null;
  }
  const key = cleanString(section.key);
  const label = cleanString(section.label);
  if (!key) details.push({ field: `decisionRecordSections.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `decisionRecordSections.${index}.label`, message: "label is required." });
  return {
    key,
    label,
    required: section.required !== false,
    storeOutsideGit: section.storeOutsideGit === true,
  };
}

function normalizeExternalField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `externalDecisionFields.${index}`, message: "decision field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `externalDecisionFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `externalDecisionFields.${index}.label`, message: "label is required." });
  if (field.redacted !== true) {
    details.push({ field: `externalDecisionFields.${index}.redacted`, message: "Expected true." });
  }
  if (field.storeOutsideGit !== true) {
    details.push({ field: `externalDecisionFields.${index}.storeOutsideGit`, message: "Expected true." });
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
    details.push({ field: `decisionGates.${index}`, message: "decision gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `decisionGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `decisionGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `decisionGates.${index}.command`, message: "command is required." });
  return { key, label, command, required: gate.required !== false };
}

function validateDecisionPolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "decisionPolicy", message: "decisionPolicy is required." });
    return {};
  }
  const expected = {
    repositoryContainsLiveSecrets: false,
    repositoryContainsPatientData: false,
    repositoryContainsRawLiveEvidence: false,
    repositoryContainsFinalApproval: false,
    finalDecisionStoredOutsideGit: true,
    liveEvidenceStoredOutsideGit: true,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
    productRuntimeCallsExternalSystems: false,
    demoFallbackInProduction: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (policy[key] !== value) {
      details.push({ field: `decisionPolicy.${key}`, message: `Expected ${String(value)}.` });
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
    "noFinalApprovalInGit",
    "noLiveEvidenceInGit",
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

export function readGoLiveDecisionRecordManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateGoLiveDecisionRecordManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6FGoLiveDecisionRecordError([{ field: "manifest", message: "Go-live decision record manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);

  const decisionRecordInputs = Array.isArray(input.decisionRecordInputs)
    ? input.decisionRecordInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  requireKeys(decisionRecordInputs, REQUIRED_INPUT_KEYS, "decisionRecordInputs", details);

  const decisionRecordSections = Array.isArray(input.decisionRecordSections)
    ? input.decisionRecordSections.map((item, index) => normalizeSection(item, index, details)).filter(Boolean)
    : [];
  requireKeys(decisionRecordSections, REQUIRED_SECTION_KEYS, "decisionRecordSections", details);

  const externalDecisionFields = Array.isArray(input.externalDecisionFields)
    ? input.externalDecisionFields.map((item, index) => normalizeExternalField(item, index, details)).filter(Boolean)
    : [];
  requireKeys(externalDecisionFields, REQUIRED_EXTERNAL_FIELD_KEYS, "externalDecisionFields", details);

  const decisionGates = Array.isArray(input.decisionGates)
    ? input.decisionGates.map((item, index) => normalizeGate(item, index, details)).filter(Boolean)
    : [];
  requireKeys(decisionGates, REQUIRED_GATE_KEYS, "decisionGates", details);

  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  const goLiveHandoffManifest = validateSafeRelativePath(
    input.goLiveHandoffManifest,
    "goLiveHandoffManifest",
    details,
  );
  const decisionPolicy = validateDecisionPolicy(input.decisionPolicy, details);
  const safetyAssertions = validateSafetyAssertions(input.safetyAssertions, details);
  if (details.length > 0) throw new Stage6FGoLiveDecisionRecordError(details);

  return {
    stage: cleanString(input.stage) || "6F",
    packageId: cleanString(input.packageId) || "stage6f-production-go-live-decision-record",
    generatedAt,
    goLiveHandoffManifest,
    productBoundary: { ...input.productBoundary },
    decisionRecordInputs,
    decisionRecordSections,
    externalDecisionFields,
    decisionGates,
    decisionPolicy,
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

export function detectGoLiveDecisionRecordLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildProductionGoLiveDecisionRecord({
  manifest,
  root = REPO_ROOT,
  generatedAt,
} = {}) {
  const normalized = validateGoLiveDecisionRecordManifest(manifest);
  const stage6eManifest = validateGoLiveHandoffManifest(
    readGoLiveHandoffManifest(normalized.goLiveHandoffManifest),
  );
  const goLiveHandoff = buildProductionGoLiveHandoff({
    manifest: stage6eManifest,
    root,
    generatedAt: stage6eManifest.generatedAt,
  });

  const inventory = normalized.decisionRecordInputs.map((input) => inputPresence(root, input));
  const missingRequiredInputs = inventory
    .filter((input) => input.required && !input.present)
    .map((input) => input.path);

  const checks = {
    stage6eReady:
      goLiveHandoff.status === "ready" &&
      goLiveHandoff.readyForOperatorGoLiveDecision === true,
    allRequiredInputsPresent: missingRequiredInputs.length === 0,
    decisionSectionsPresent: REQUIRED_SECTION_KEYS.every((key) => normalized.decisionRecordSections.some((section) => section.key === key)),
    externalDecisionFieldsPresent: REQUIRED_EXTERNAL_FIELD_KEYS.every((key) => normalized.externalDecisionFields.some((field) => field.key === key)),
    externalDecisionFieldsStoredOutsideGit: normalized.externalDecisionFields.every((field) => field.redacted === true && field.storeOutsideGit === true),
    decisionGatesPresent: REQUIRED_GATE_KEYS.every((key) => normalized.decisionGates.some((gate) => gate.key === key)),
    decisionPolicySafe:
      normalized.decisionPolicy.repositoryContainsLiveSecrets === false &&
      normalized.decisionPolicy.repositoryContainsPatientData === false &&
      normalized.decisionPolicy.repositoryContainsRawLiveEvidence === false &&
      normalized.decisionPolicy.repositoryContainsFinalApproval === false &&
      normalized.decisionPolicy.finalDecisionStoredOutsideGit === true &&
      normalized.decisionPolicy.liveEvidenceStoredOutsideGit === true &&
      normalized.decisionPolicy.managedRuntimeDependency === "none" &&
      normalized.decisionPolicy.managedDatabaseDependency === "none" &&
      normalized.decisionPolicy.productRuntimeCallsExternalSystems === false &&
      normalized.decisionPolicy.demoFallbackInProduction === false,
    safetyAssertionsGreen: Object.values(normalized.safetyAssertions).every((value) => value === true),
    stage6fScriptsPresent: [
      "test:stage6f",
      "check:stage6f",
      "preflight:stage6f",
      "decision:stage6f:dry-run",
      "decision:stage6f:report",
    ].every((script) => packageScriptPresent(root, script)),
  };

  const reportCandidate = {
    stage: "6F",
    packageId: normalized.packageId,
    generatedAt: generatedAt || normalized.generatedAt,
    goLiveHandoff: {
      manifest: normalized.goLiveHandoffManifest,
      status: goLiveHandoff.status,
      readyForOperatorGoLiveDecision: goLiveHandoff.readyForOperatorGoLiveDecision,
      goLiveApprovedByThisReport: goLiveHandoff.goLiveApprovedByThisReport,
      liveServerGoLiveVerifiedByThisReport: goLiveHandoff.liveServerGoLiveVerifiedByThisReport,
    },
    productBoundary: normalized.productBoundary,
    inventory,
    decisionRecordSections: normalized.decisionRecordSections,
    externalDecisionFields: normalized.externalDecisionFields,
    decisionGates: normalized.decisionGates,
    decisionPolicy: normalized.decisionPolicy,
    checks,
    missingRequiredInputs,
    decisionRecordStoredInGit: false,
    finalDecisionStoredOutsideGit: true,
    finalGoLiveOutcomeKnownToRepository: false,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
  };
  const leakFindings = detectGoLiveDecisionRecordLeaks(JSON.stringify(reportCandidate));
  const ready = Object.values(checks).every(Boolean) && leakFindings.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "ready" : "blocked",
    readyForExternalGoLiveDecisionRecord: ready,
    leakFindings,
  };
}

export function renderProductionGoLiveDecisionRecordMarkdown(report) {
  const lines = [
    "# Stage 6F production go-live decision record",
    "",
    `- Status: \`${report.status}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Ready for external go-live decision record: \`${report.readyForExternalGoLiveDecisionRecord}\``,
    `- Final decision stored outside git: \`${report.finalDecisionStoredOutsideGit}\``,
    `- Final go-live outcome known to repository: \`${report.finalGoLiveOutcomeKnownToRepository}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Stage 6E handoff status: \`${report.goLiveHandoff.status}\``,
    `- Leak findings: ${report.leakFindings.length}`,
    "",
    "## Checks",
    "",
  ];
  for (const [key, value] of Object.entries(report.checks)) {
    lines.push(`- ${value ? "OK" : "BLOCKED"} \`${key}\``);
  }
  lines.push("");
  lines.push("## Required decision inputs");
  lines.push("");
  for (const input of report.inventory) {
    lines.push(`- ${input.present ? "OK" : "MISSING"} ${input.label} — \`${input.path}\``);
  }
  lines.push("");
  lines.push("## Decision record sections");
  lines.push("");
  for (const section of report.decisionRecordSections) {
    lines.push(`- ${section.required ? "Required" : "Optional"}: ${section.label}${section.storeOutsideGit ? " (external record)" : ""}`);
  }
  lines.push("");
  lines.push("## Decision gates");
  lines.push("");
  for (const gate of report.decisionGates) {
    lines.push(`- ${gate.label}: \`${gate.command}\``);
  }
  lines.push("");
  lines.push("## Privacy boundary");
  lines.push("");
  lines.push("- Managed runtime/database dependency: none.");
  lines.push("- The repository does not contain final approval, raw evidence, patient data, credentials, object keys, or backup contents.");
  lines.push("- The operator's decision id, approver reference, evidence bundle reference, support window, and final outcome remain outside git.");
  lines.push("- This report prepares a decision-record contract; it does not approve or verify a live production go-live.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6FArgs(argv = []) {
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

export function runStage6FProductionGoLiveDecisionRecord({
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt = DEFAULT_NOW,
  dryRun = false,
  root = REPO_ROOT,
} = {}) {
  const report = buildProductionGoLiveDecisionRecord({
    manifest: readGoLiveDecisionRecordManifest(manifestPath),
    root,
    generatedAt,
  });
  const markdown = renderProductionGoLiveDecisionRecordMarkdown(report);
  if (!dryRun) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(summaryPath, markdown);
    writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseStage6FArgs(argv);
  const result = runStage6FProductionGoLiveDecisionRecord({
    manifestPath: args.manifest,
    summaryPath: args.summaryPath,
    jsonOut: args.jsonOut,
    generatedAt: args.now,
    dryRun: args.dryRun,
  });
  process.stdout.write(result.markdown);
  if (!args.dryRun) {
    process.stdout.write(`\n[stage6f] wrote ${args.summaryPath}\n`);
    process.stdout.write(`[stage6f] wrote ${args.jsonOut}\n`);
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`[stage6f] ${error.message}`);
    if (Array.isArray(error.details)) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    process.exit(1);
  }
}
