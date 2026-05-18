#!/usr/bin/env node
// Stage 6D · live install evidence receipt package.
// Builds an offline redacted evidence receipt contract for the first live
// install. The command reads repository evidence only, performs no network calls,
// and does not prove that a live server was installed.

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
  Stage6CInstallVerificationError,
  buildProductionInstallVerification,
  readInstallVerificationManifest,
  validateInstallVerificationManifest,
} from "./stage6c-production-install-verification.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/live-install-evidence.stage6d.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6d-live-install-evidence-receipt.md";
const DEFAULT_JSON_PATH = "test-results/stage6d-live-install-evidence-receipt.json";
const DEFAULT_NOW = "2026-05-15T12:30:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6c_install_verification_package",
  "stage6c_verification_generator",
  "stage6b_server_install_package",
  "stage6a_acceptance_baseline",
  "production_deploy_verifier",
  "compose_smoke",
  "ops_backup_restore",
  "product_readiness_contract",
  "production_observability_export",
  "production_env_template",
];

const REQUIRED_EVIDENCE_CATEGORIES = [
  "target_env_validation",
  "compose_config_summary",
  "health_readiness_snapshot",
  "product_readiness_snapshot",
  "compose_smoke_result",
  "post_install_backup_manifest",
  "rollback_drill_review",
  "operator_signoff",
];

const REQUIRED_RECEIPT_FIELDS = [
  "evidence_set_id",
  "install_window_utc",
  "target_environment_label",
  "operator_role",
  "redacted_evidence_references",
  "external_evidence_store",
  "safety_signoff",
];

const REQUIRED_GATE_KEYS = [
  "stage6c_ready",
  "stage6c_report",
  "post_deploy_plan",
  "compose_smoke_plan",
  "backup_after_deploy_plan",
  "rollback_drill_plan",
  "stage6d_report",
];

const LEAK_PATTERNS = [
  { code: "access token", pattern: /access[_-]?token/i },
  { code: "bearer token", pattern: /authorization:\s*bearer\s+(?!<SELF_HOSTED_BEARER_TOKEN>)/i },
  { code: "cookie", pattern: /\bcookie\s*:/i },
  { code: "password", pattern: /password\s*[:=]\s*[^<\s]/i },
  { code: "storage path", pattern: new RegExp("storage" + "_object_path", "i") },
  { code: "signed url", pattern: new RegExp("signed" + "[_-]?url", "i") },
  { code: "managed api read", pattern: new RegExp("api-" + "read", "i") },
  { code: "managed api write", pattern: new RegExp("api-" + "write", "i") },
  { code: "managed function marker", pattern: new RegExp("edge" + " function", "i") },
  { code: "managed env", pattern: new RegExp("SUP" + "ABASE_") },
  { code: "patient identity", pattern: /patient[_-]?full[_-]?name|fullName/i },
  { code: "external url", pattern: /https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/)|github\.com\/sahchandansah1201-glitch\/pro)/i },
];

export class Stage6DLiveInstallEvidenceError extends Error {
  constructor(details = []) {
    super("Stage 6D live install evidence receipt failed validation.");
    this.name = "Stage6DLiveInstallEvidenceError";
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
        details.push({ field: path, message: `Live install evidence receipt contains forbidden value: ${code}.` });
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
    liveServerEvidenceRequired: true,
    liveEvidenceBundledInRepository: false,
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

function normalizeEvidenceCategory(category, index, details) {
  if (!isPlainObject(category)) {
    details.push({ field: `evidenceCategories.${index}`, message: "evidence category must be an object." });
    return null;
  }
  const key = cleanString(category.key);
  const label = cleanString(category.label);
  const source = cleanString(category.source);
  const evidenceType = cleanString(category.evidenceType);
  if (!key) details.push({ field: `evidenceCategories.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `evidenceCategories.${index}.label`, message: "label is required." });
  if (!source) details.push({ field: `evidenceCategories.${index}.source`, message: "source is required." });
  if (!evidenceType) details.push({ field: `evidenceCategories.${index}.evidenceType`, message: "evidenceType is required." });
  if (category.redactionRequired !== true) {
    details.push({ field: `evidenceCategories.${index}.redactionRequired`, message: "Expected true." });
  }
  if (category.storeOutsideGit !== true) {
    details.push({ field: `evidenceCategories.${index}.storeOutsideGit`, message: "Expected true." });
  }
  return {
    key,
    label,
    source,
    evidenceType,
    required: category.required !== false,
    redactionRequired: category.redactionRequired === true,
    storeOutsideGit: category.storeOutsideGit === true,
  };
}

function normalizeReceiptField(field, index, details) {
  if (!isPlainObject(field)) {
    details.push({ field: `receiptFields.${index}`, message: "receipt field must be an object." });
    return null;
  }
  const key = cleanString(field.key);
  const label = cleanString(field.label);
  if (!key) details.push({ field: `receiptFields.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `receiptFields.${index}.label`, message: "label is required." });
  if (field.redacted !== true) {
    details.push({ field: `receiptFields.${index}.redacted`, message: "Expected true." });
  }
  return {
    key,
    label,
    required: field.required !== false,
    redacted: field.redacted === true,
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

function validateLiveEvidencePolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "liveEvidencePolicy", message: "liveEvidencePolicy is required." });
    return {};
  }
  const expected = {
    liveInstallEvidenceRequired: true,
    liveEvidenceStoredOutsideGit: true,
    repositoryContainsLiveSecrets: false,
    repositoryContainsPatientData: false,
    repositoryContainsRawLiveEvidence: false,
    redactedReceiptAllowedInTestResults: true,
    evidenceIdentifiersMayBeStored: true,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (policy[key] !== value) {
      details.push({ field: `liveEvidencePolicy.${key}`, message: `Expected ${String(value)}.` });
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
    "stage6cRequired",
    "noSecretsInReceipt",
    "noPatientDataInReceipt",
    "noRawLiveLogsInReceipt",
    "noRuntimeApiChanges",
    "noDatabaseSchemaChanges",
    "noManagedRuntimeDependency",
    "noManagedDatabaseDependency",
    "liveEvidenceNotBundled",
    "operatorEvidenceStoredOutsideGit",
  ];
  for (const key of required) {
    if (assertions[key] !== true) {
      details.push({ field: `safetyAssertions.${key}`, message: "Expected true." });
    }
  }
  return { ...assertions };
}

export function readLiveInstallEvidenceManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateLiveInstallEvidenceManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6DLiveInstallEvidenceError([{ field: "manifest", message: "Live install evidence manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);

  const receiptInputs = Array.isArray(input.receiptInputs)
    ? input.receiptInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  const inputKeys = receiptInputs.map((item) => item.key);
  const missingInputs = REQUIRED_INPUT_KEYS.filter((key) => !inputKeys.includes(key));
  if (missingInputs.length > 0) {
    details.push({ field: "receiptInputs", message: `Missing receipt inputs: ${missingInputs.join(", ")}.` });
  }

  const evidenceCategories = Array.isArray(input.evidenceCategories)
    ? input.evidenceCategories.map((category, index) => normalizeEvidenceCategory(category, index, details)).filter(Boolean)
    : [];
  const evidenceKeys = evidenceCategories.map((category) => category.key);
  const missingEvidence = REQUIRED_EVIDENCE_CATEGORIES.filter((key) => !evidenceKeys.includes(key));
  if (missingEvidence.length > 0) {
    details.push({ field: "evidenceCategories", message: `Missing evidence categories: ${missingEvidence.join(", ")}.` });
  }

  const receiptFields = Array.isArray(input.receiptFields)
    ? input.receiptFields.map((field, index) => normalizeReceiptField(field, index, details)).filter(Boolean)
    : [];
  const fieldKeys = receiptFields.map((field) => field.key);
  const missingFields = REQUIRED_RECEIPT_FIELDS.filter((key) => !fieldKeys.includes(key));
  if (missingFields.length > 0) {
    details.push({ field: "receiptFields", message: `Missing receipt fields: ${missingFields.join(", ")}.` });
  }

  const receiptGates = Array.isArray(input.receiptGates)
    ? input.receiptGates.map((gate, index) => normalizeGate(gate, index, details)).filter(Boolean)
    : [];
  const gateKeys = receiptGates.map((gate) => gate.key);
  const missingGates = REQUIRED_GATE_KEYS.filter((key) => !gateKeys.includes(key));
  if (missingGates.length > 0) {
    details.push({ field: "receiptGates", message: `Missing receipt gates: ${missingGates.join(", ")}.` });
  }

  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  const installVerificationManifest = validateSafeRelativePath(input.installVerificationManifest, "installVerificationManifest", details);
  const liveEvidencePolicy = validateLiveEvidencePolicy(input.liveEvidencePolicy, details);
  const safetyAssertions = validateSafetyAssertions(input.safetyAssertions, details);
  if (details.length > 0) throw new Stage6DLiveInstallEvidenceError(details);

  return {
    stage: cleanString(input.stage) || "6D",
    packageId: cleanString(input.packageId) || "stage6d-live-install-evidence-receipt",
    generatedAt,
    installVerificationManifest,
    productBoundary: { ...input.productBoundary },
    receiptInputs,
    evidenceCategories,
    receiptFields,
    receiptGates,
    liveEvidencePolicy,
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

export function detectLiveInstallEvidenceLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildLiveInstallEvidenceReceipt({
  manifest,
  root = REPO_ROOT,
  generatedAt,
} = {}) {
  const normalized = validateLiveInstallEvidenceManifest(manifest);
  const installVerificationManifest = validateInstallVerificationManifest(
    readInstallVerificationManifest(normalized.installVerificationManifest),
  );
  const installVerification = buildProductionInstallVerification({
    manifest: installVerificationManifest,
    root,
    generatedAt: installVerificationManifest.generatedAt,
  });
  const inventory = normalized.receiptInputs.map((input) => inputPresence(root, input));
  const missingRequiredInputs = inventory
    .filter((input) => input.required && !input.present)
    .map((input) => input.path);
  const checks = {
    stage6cReady: installVerification.status === "ready" && installVerification.readyForLiveInstallVerification,
    allRequiredInputsPresent: missingRequiredInputs.length === 0,
    evidenceCategoriesPresent: REQUIRED_EVIDENCE_CATEGORIES.every((key) => normalized.evidenceCategories.some((category) => category.key === key)),
    evidenceCategoriesRedacted: normalized.evidenceCategories.every((category) => category.redactionRequired === true && category.storeOutsideGit === true),
    receiptFieldsPresent: REQUIRED_RECEIPT_FIELDS.every((key) => normalized.receiptFields.some((field) => field.key === key)),
    receiptFieldsRedacted: normalized.receiptFields.every((field) => field.redacted === true),
    receiptGatesPresent: REQUIRED_GATE_KEYS.every((key) => normalized.receiptGates.some((gate) => gate.key === key)),
    liveEvidencePolicySafe:
      normalized.liveEvidencePolicy.liveInstallEvidenceRequired === true &&
      normalized.liveEvidencePolicy.liveEvidenceStoredOutsideGit === true &&
      normalized.liveEvidencePolicy.repositoryContainsLiveSecrets === false &&
      normalized.liveEvidencePolicy.repositoryContainsPatientData === false &&
      normalized.liveEvidencePolicy.repositoryContainsRawLiveEvidence === false,
    safetyAssertionsGreen: Object.values(normalized.safetyAssertions).every((value) => value === true),
    stage6dScriptsPresent: [
      "test:stage6d",
      "check:stage6d",
      "preflight:stage6d",
      "evidence:stage6d:dry-run",
      "evidence:stage6d:report",
    ].every((script) => packageScriptPresent(root, script)),
  };
  const reportCandidate = {
    stage: "6D",
    packageId: normalized.packageId,
    generatedAt: generatedAt || normalized.generatedAt,
    status: "pending",
    installVerification: {
      manifest: normalized.installVerificationManifest,
      status: installVerification.status,
      readyForLiveInstallVerification: installVerification.readyForLiveInstallVerification,
      liveInstallVerified: installVerification.liveInstallVerified,
    },
    productBoundary: normalized.productBoundary,
    inventory,
    evidenceCategories: normalized.evidenceCategories,
    receiptFields: normalized.receiptFields,
    receiptGates: normalized.receiptGates,
    liveEvidencePolicy: normalized.liveEvidencePolicy,
    checks,
    missingRequiredInputs,
    liveInstallEvidenceAccepted: false,
    liveInstallVerified: false,
  };
  const leakFindings = detectLiveInstallEvidenceLeaks(JSON.stringify(reportCandidate));
  const ready = Object.values(checks).every(Boolean) && leakFindings.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "ready" : "blocked",
    readyForLiveInstallEvidenceReceipt: ready,
    leakFindings,
  };
}

function escapePipe(value) {
  return String(value).replaceAll("|", "\\|");
}

export function renderLiveInstallEvidenceReceiptMarkdown(report) {
  const lines = [
    "## Stage 6D live install evidence receipt",
    "",
    `- Status: \`${report.status}\``,
    `- Ready for live install evidence receipt: \`${report.readyForLiveInstallEvidenceReceipt}\``,
    `- Live install evidence accepted by this report: \`${report.liveInstallEvidenceAccepted}\``,
    `- Live install verified by this report: \`${report.liveInstallVerified}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Stage 6C install verification package: \`${report.installVerification.status}\``,
    `- Managed runtime dependency: \`${report.productBoundary.managedRuntimeDependency}\``,
    `- Managed database dependency: \`${report.productBoundary.managedDatabaseDependency}\``,
    `- Live evidence bundled in repository: \`${report.productBoundary.liveEvidenceBundledInRepository}\``,
    "",
    "### Receipt Inputs",
    "",
    "| Input | Kind | Required | Status |",
    "| --- | --- | --- | --- |",
  ];
  for (const input of report.inventory) {
    lines.push(
      `| ${escapePipe(input.label)} | ${input.kind} | ${input.required} | ${input.present ? "present" : "missing"} |`,
    );
  }
  lines.push("", "### Evidence Categories", "");
  lines.push("| Evidence | Source | Type | Outside git |");
  lines.push("| --- | --- | --- | --- |");
  for (const category of report.evidenceCategories) {
    lines.push(
      `| ${escapePipe(category.label)} | ${escapePipe(category.source)} | ${escapePipe(category.evidenceType)} | ${category.storeOutsideGit} |`,
    );
  }
  lines.push("", "### Receipt Fields", "");
  for (const field of report.receiptFields) {
    lines.push(`- ${field.label}: redacted \`${field.redacted}\``);
  }
  lines.push("", "### Receipt Gates", "");
  for (const [index, gate] of report.receiptGates.entries()) {
    lines.push(`${index + 1}. ${gate.label}: \`${gate.command}\``);
  }
  lines.push("", "### Checks", "");
  lines.push(`- Stage 6C ready: \`${report.checks.stage6cReady}\``);
  lines.push(`- Required inputs present: \`${report.checks.allRequiredInputsPresent}\``);
  lines.push(`- Evidence categories present: \`${report.checks.evidenceCategoriesPresent}\``);
  lines.push(`- Evidence categories redacted: \`${report.checks.evidenceCategoriesRedacted}\``);
  lines.push(`- Receipt fields present: \`${report.checks.receiptFieldsPresent}\``);
  lines.push(`- Receipt fields redacted: \`${report.checks.receiptFieldsRedacted}\``);
  lines.push(`- Receipt gates present: \`${report.checks.receiptGatesPresent}\``);
  lines.push(`- Live evidence policy safe: \`${report.checks.liveEvidencePolicySafe}\``);
  lines.push(`- Safety assertions green: \`${report.checks.safetyAssertionsGreen}\``);
  lines.push(`- Stage 6D scripts present: \`${report.checks.stage6dScriptsPresent}\``);
  lines.push(`- Leak findings: \`${report.leakFindings.length}\``);
  if (report.missingRequiredInputs.length > 0 || report.leakFindings.length > 0) {
    lines.push("", "### Blockers", "");
    for (const file of report.missingRequiredInputs) lines.push(`- Missing input: \`${file}\``);
    for (const leak of report.leakFindings) lines.push(`- Leak finding: \`${leak}\``);
  }
  lines.push(
    "",
    "### Live Evidence Policy",
    "",
    `- Live install evidence required: \`${report.liveEvidencePolicy.liveInstallEvidenceRequired}\``,
    `- Live evidence stored outside git: \`${report.liveEvidencePolicy.liveEvidenceStoredOutsideGit}\``,
    `- Repository contains live secrets: \`${report.liveEvidencePolicy.repositoryContainsLiveSecrets}\``,
    `- Repository contains patient data: \`${report.liveEvidencePolicy.repositoryContainsPatientData}\``,
    `- Repository contains raw live evidence: \`${report.liveEvidencePolicy.repositoryContainsRawLiveEvidence}\``,
    "",
    "### Privacy",
    "",
    "- This report is an offline receipt contract, not proof that a live server was installed.",
    "- It contains file paths, command names, evidence category labels, and redacted receipt field names only.",
    "- Live server logs, production environment values, backup contents, patient records, object keys, credentials, external adapter payloads, and signed links must stay outside git.",
  );
  return `${lines.join("\n")}\n`;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseStage6DArgs(argv = []) {
  const parsed = {
    manifest: DEFAULT_MANIFEST,
    summaryPath: null,
    jsonOut: null,
    dryRun: false,
    now: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value) throw new Error("--manifest requires a path");
      parsed.manifest = value;
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      const value = argv[index + 1];
      if (!value) throw new Error("--summary requires a path");
      parsed.summaryPath = value;
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--json-out requires a path");
      parsed.jsonOut = value;
      index += 1;
      continue;
    }
    if (arg === "--now") {
      const value = argv[index + 1];
      if (!value) throw new Error("--now requires an ISO date-time");
      parsed.now = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

export function runStage6DLiveInstallEvidenceReceipt({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt,
} = {}) {
  const manifest = validateLiveInstallEvidenceManifest(readLiveInstallEvidenceManifest(manifestPath));
  const report = buildLiveInstallEvidenceReceipt({ manifest, root, generatedAt });
  const markdown = renderLiveInstallEvidenceReceiptMarkdown(report);
  if (summaryPath) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, markdown);
  }
  if (jsonOut) {
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, stableJson(report));
  }
  return { ok: report.status === "ready", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage6DArgs(argv);
    const result = runStage6DLiveInstallEvidenceReceipt({
      root: REPO_ROOT,
      manifestPath: args.manifest,
      summaryPath: args.summaryPath || (args.dryRun ? null : DEFAULT_SUMMARY_PATH),
      jsonOut: args.jsonOut || (args.dryRun ? null : DEFAULT_JSON_PATH),
      generatedAt: args.now || undefined,
    });
    process.stdout.write(result.markdown);
    return result.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof Stage6DLiveInstallEvidenceError || error instanceof Stage6CInstallVerificationError) {
      console.error("[stage6d-live-install-evidence-receipt] failed:");
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage6d-live-install-evidence-receipt] failed: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
