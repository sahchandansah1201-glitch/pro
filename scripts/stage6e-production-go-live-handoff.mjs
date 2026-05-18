#!/usr/bin/env node
// Stage 6E · production go-live handoff package.
// Builds an offline redacted handoff contract for the operator's final go-live
// decision. The command reads repository evidence only, performs no network calls,
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
  buildLiveInstallEvidenceReceipt,
  readLiveInstallEvidenceManifest,
  validateLiveInstallEvidenceManifest,
} from "./stage6d-live-install-evidence-receipt.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/go-live-handoff.stage6e.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6e-production-go-live-handoff.md";
const DEFAULT_JSON_PATH = "test-results/stage6e-production-go-live-handoff.json";
const DEFAULT_NOW = "2026-05-15T13:00:00.000Z";

const REQUIRED_INPUT_KEYS = [
  "stage6d_live_install_evidence_receipt",
  "stage6d_evidence_generator",
  "stage6c_install_verification",
  "stage6b_server_install_package",
  "stage6a_acceptance_baseline",
  "stage5a_release_candidate_env",
  "stage5b_bootstrap_admin_sql",
  "stage5c_prestart_schema_check",
  "stage5z_external_adapter_handoff",
  "project_memory_black_box",
];

const REQUIRED_HANDOFF_SECTION_KEYS = [
  "release_scope",
  "install_evidence",
  "operator_contacts",
  "backup_restore",
  "rollback_stop_conditions",
  "monitoring",
  "external_adapter_handoff",
  "post_go_live_observation",
];

const REQUIRED_DECISION_FIELD_KEYS = [
  "decision_id",
  "decision_window_utc",
  "operator_owner_role",
  "approved_by_role",
  "evidence_set_reference",
  "rollback_owner_role",
  "support_window",
  "final_decision",
];

const REQUIRED_GATE_KEYS = [
  "stage6d_ready",
  "stage6d_report",
  "preflight_all_dry_run",
  "no_deno_lock",
  "production_mode_confirmed",
  "backup_restore_ready",
  "external_adapters_handoff_ready",
  "operator_approval_required",
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

export class Stage6EGoLiveHandoffError extends Error {
  constructor(details = []) {
    super("Stage 6E production go-live handoff failed validation.");
    this.name = "Stage6EGoLiveHandoffError";
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
  const absolutePath = resolve(path);
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
        details.push({ field: path, message: `Go-live handoff contains forbidden value: ${code}.` });
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
    goLiveApprovalRequiredOutsideGit: true,
    goLiveDecisionBundledInRepository: false,
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

function normalizeDecisionField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `decisionFields.${index}`, message: "decision field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `decisionFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `decisionFields.${index}.label`, message: "label is required." });
  if (field.redacted !== true) {
    details.push({ field: `decisionFields.${index}.redacted`, message: "Expected true." });
  }
  if (field.storeOutsideGit !== true) {
    details.push({ field: `decisionFields.${index}.storeOutsideGit`, message: "Expected true." });
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
    details.push({ field: `goLiveGates.${index}`, message: "go-live gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `goLiveGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `goLiveGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `goLiveGates.${index}.command`, message: "command is required." });
  return { key, label, command, required: gate.required !== false };
}

function validateGoLivePolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "goLivePolicy", message: "goLivePolicy is required." });
    return {};
  }
  const expected = {
    repositoryContainsLiveSecrets: false,
    repositoryContainsPatientData: false,
    repositoryContainsRawLiveEvidence: false,
    goLiveApprovalStoredOutsideGit: true,
    liveEvidenceStoredOutsideGit: true,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
    productRuntimeCallsExternalSystems: false,
    demoFallbackInProduction: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (policy[key] !== value) {
      details.push({ field: `goLivePolicy.${key}`, message: `Expected ${String(value)}.` });
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
    "goLiveDecisionIsExternal",
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

export function readGoLiveHandoffManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateGoLiveHandoffManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6EGoLiveHandoffError([{ field: "manifest", message: "Go-live handoff manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);

  const handoffInputs = Array.isArray(input.handoffInputs)
    ? input.handoffInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  const inputKeys = handoffInputs.map((item) => item.key);
  const missingInputs = REQUIRED_INPUT_KEYS.filter((key) => !inputKeys.includes(key));
  if (missingInputs.length > 0) {
    details.push({ field: "handoffInputs", message: `Missing handoff inputs: ${missingInputs.join(", ")}.` });
  }

  const handoffSections = Array.isArray(input.handoffSections)
    ? input.handoffSections.map((section, index) => normalizeSection(section, index, details)).filter(Boolean)
    : [];
  const sectionKeys = handoffSections.map((section) => section.key);
  const missingSections = REQUIRED_HANDOFF_SECTION_KEYS.filter((key) => !sectionKeys.includes(key));
  if (missingSections.length > 0) {
    details.push({ field: "handoffSections", message: `Missing handoff sections: ${missingSections.join(", ")}.` });
  }

  const decisionFields = Array.isArray(input.decisionFields)
    ? input.decisionFields.map((field, index) => normalizeDecisionField(field, index, details)).filter(Boolean)
    : [];
  const decisionFieldKeys = decisionFields.map((field) => field.key);
  const missingDecisionFields = REQUIRED_DECISION_FIELD_KEYS.filter((key) => !decisionFieldKeys.includes(key));
  if (missingDecisionFields.length > 0) {
    details.push({ field: "decisionFields", message: `Missing decision fields: ${missingDecisionFields.join(", ")}.` });
  }

  const goLiveGates = Array.isArray(input.goLiveGates)
    ? input.goLiveGates.map((gate, index) => normalizeGate(gate, index, details)).filter(Boolean)
    : [];
  const gateKeys = goLiveGates.map((gate) => gate.key);
  const missingGates = REQUIRED_GATE_KEYS.filter((key) => !gateKeys.includes(key));
  if (missingGates.length > 0) {
    details.push({ field: "goLiveGates", message: `Missing go-live gates: ${missingGates.join(", ")}.` });
  }

  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  const liveInstallEvidenceManifest = validateSafeRelativePath(
    input.liveInstallEvidenceManifest,
    "liveInstallEvidenceManifest",
    details,
  );
  const goLivePolicy = validateGoLivePolicy(input.goLivePolicy, details);
  const safetyAssertions = validateSafetyAssertions(input.safetyAssertions, details);
  if (details.length > 0) throw new Stage6EGoLiveHandoffError(details);

  return {
    stage: cleanString(input.stage) || "6E",
    packageId: cleanString(input.packageId) || "stage6e-production-go-live-handoff",
    generatedAt,
    liveInstallEvidenceManifest,
    productBoundary: { ...input.productBoundary },
    handoffInputs,
    handoffSections,
    decisionFields,
    goLiveGates,
    goLivePolicy,
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

export function detectGoLiveHandoffLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildProductionGoLiveHandoff({
  manifest,
  root = process.cwd(),
  generatedAt,
} = {}) {
  const normalized = validateGoLiveHandoffManifest(manifest);
  const stage6dManifest = validateLiveInstallEvidenceManifest(
    readLiveInstallEvidenceManifest(normalized.liveInstallEvidenceManifest),
  );
  const liveInstallEvidenceReceipt = buildLiveInstallEvidenceReceipt({
    manifest: stage6dManifest,
    root,
    generatedAt: stage6dManifest.generatedAt,
  });

  const inventory = normalized.handoffInputs.map((input) => inputPresence(root, input));
  const missingRequiredInputs = inventory
    .filter((input) => input.required && !input.present)
    .map((input) => input.path);

  const checks = {
    stage6dReady:
      liveInstallEvidenceReceipt.status === "ready" &&
      liveInstallEvidenceReceipt.readyForLiveInstallEvidenceReceipt === true,
    allRequiredInputsPresent: missingRequiredInputs.length === 0,
    handoffSectionsPresent: REQUIRED_HANDOFF_SECTION_KEYS.every((key) => normalized.handoffSections.some((section) => section.key === key)),
    decisionFieldsPresent: REQUIRED_DECISION_FIELD_KEYS.every((key) => normalized.decisionFields.some((field) => field.key === key)),
    decisionFieldsStoredOutsideGit: normalized.decisionFields.every((field) => field.redacted === true && field.storeOutsideGit === true),
    goLiveGatesPresent: REQUIRED_GATE_KEYS.every((key) => normalized.goLiveGates.some((gate) => gate.key === key)),
    goLivePolicySafe:
      normalized.goLivePolicy.repositoryContainsLiveSecrets === false &&
      normalized.goLivePolicy.repositoryContainsPatientData === false &&
      normalized.goLivePolicy.repositoryContainsRawLiveEvidence === false &&
      normalized.goLivePolicy.goLiveApprovalStoredOutsideGit === true &&
      normalized.goLivePolicy.liveEvidenceStoredOutsideGit === true &&
      normalized.goLivePolicy.managedRuntimeDependency === "none" &&
      normalized.goLivePolicy.managedDatabaseDependency === "none" &&
      normalized.goLivePolicy.productRuntimeCallsExternalSystems === false &&
      normalized.goLivePolicy.demoFallbackInProduction === false,
    safetyAssertionsGreen: Object.values(normalized.safetyAssertions).every((value) => value === true),
    stage6eScriptsPresent: [
      "test:stage6e",
      "check:stage6e",
      "preflight:stage6e",
      "handoff:stage6e:dry-run",
      "handoff:stage6e:report",
    ].every((script) => packageScriptPresent(root, script)),
  };

  const reportCandidate = {
    stage: "6E",
    packageId: normalized.packageId,
    generatedAt: generatedAt || normalized.generatedAt,
    status: "pending",
    liveInstallEvidenceReceipt: {
      manifest: normalized.liveInstallEvidenceManifest,
      status: liveInstallEvidenceReceipt.status,
      readyForLiveInstallEvidenceReceipt: liveInstallEvidenceReceipt.readyForLiveInstallEvidenceReceipt,
      liveInstallEvidenceAccepted: liveInstallEvidenceReceipt.liveInstallEvidenceAccepted,
      liveInstallVerified: liveInstallEvidenceReceipt.liveInstallVerified,
    },
    productBoundary: normalized.productBoundary,
    inventory,
    handoffSections: normalized.handoffSections,
    decisionFields: normalized.decisionFields,
    goLiveGates: normalized.goLiveGates,
    goLivePolicy: normalized.goLivePolicy,
    checks,
    missingRequiredInputs,
    goLiveApprovedByThisReport: false,
    liveServerGoLiveVerifiedByThisReport: false,
  };
  const leakFindings = detectGoLiveHandoffLeaks(JSON.stringify(reportCandidate));
  const ready = Object.values(checks).every(Boolean) && leakFindings.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "ready" : "blocked",
    readyForOperatorGoLiveDecision: ready,
    leakFindings,
  };
}

export function renderProductionGoLiveHandoffMarkdown(report) {
  const lines = [
    "# Stage 6E production go-live handoff",
    "",
    `- Status: \`${report.status}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Ready for operator go-live decision: \`${report.readyForOperatorGoLiveDecision}\``,
    `- Go-live approved by this report: \`${report.goLiveApprovedByThisReport}\``,
    `- Live server go-live verified by this report: \`${report.liveServerGoLiveVerifiedByThisReport}\``,
    `- Stage 6D receipt status: \`${report.liveInstallEvidenceReceipt.status}\``,
    `- Leak findings: ${report.leakFindings.length}`,
    "",
    "## Checks",
    "",
  ];
  for (const [key, value] of Object.entries(report.checks)) {
    lines.push(`- ${value ? "OK" : "BLOCKED"} \`${key}\``);
  }
  lines.push("");
  lines.push("## Required handoff inputs");
  lines.push("");
  for (const input of report.inventory) {
    lines.push(`- ${input.present ? "OK" : "MISSING"} ${input.label} — \`${input.path}\``);
  }
  lines.push("");
  lines.push("## Handoff sections");
  lines.push("");
  for (const section of report.handoffSections) {
    lines.push(`- ${section.required ? "Required" : "Optional"}: ${section.label}${section.storeOutsideGit ? " (external record)" : ""}`);
  }
  lines.push("");
  lines.push("## Go-live gates");
  lines.push("");
  for (const gate of report.goLiveGates) {
    lines.push(`- ${gate.label}: \`${gate.command}\``);
  }
  lines.push("");
  lines.push("## Privacy boundary");
  lines.push("");
  lines.push("- Managed runtime/database dependency: none.");
  lines.push("- The repository does not contain live approval, raw evidence, patient data, credentials, object keys, or backup contents.");
  lines.push("- Operator approval, contact details, evidence references, and final decision remain outside git.");
  lines.push("- This report prepares the handoff package; it does not approve or verify production go-live.");
  lines.push("");
  return lines.join("\n");
}

export function parseStage6EArgs(argv = []) {
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

export function runStage6EProductionGoLiveHandoff({
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt = DEFAULT_NOW,
  dryRun = false,
  root = process.cwd(),
} = {}) {
  const report = buildProductionGoLiveHandoff({
    manifest: readGoLiveHandoffManifest(manifestPath),
    root,
    generatedAt,
  });
  const markdown = renderProductionGoLiveHandoffMarkdown(report);
  if (!dryRun) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(summaryPath, markdown);
    writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseStage6EArgs(argv);
  const result = runStage6EProductionGoLiveHandoff({
    manifestPath: args.manifest,
    summaryPath: args.summaryPath,
    jsonOut: args.jsonOut,
    generatedAt: args.now,
    dryRun: args.dryRun,
  });
  process.stdout.write(result.markdown);
  if (!args.dryRun) {
    process.stdout.write(`\n[stage6e] wrote ${args.summaryPath}\n`);
    process.stdout.write(`[stage6e] wrote ${args.jsonOut}\n`);
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`[stage6e] ${error.message}`);
    if (Array.isArray(error.details)) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    process.exit(1);
  }
}
