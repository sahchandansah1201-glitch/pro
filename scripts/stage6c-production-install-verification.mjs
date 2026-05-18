#!/usr/bin/env node
// Stage 6C · production install verification package.
// Builds an offline verification package for first server install evidence. The
// command reads repository evidence only, performs no network calls, and does
// not verify a live server by itself.

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
  Stage6BInstallPackageError,
  buildServerInstallPackage,
  readServerInstallManifest,
  validateServerInstallManifest,
} from "./stage6b-server-install-package.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/install-verification.stage6c.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6c-production-install-verification.md";
const DEFAULT_JSON_PATH = "test-results/stage6c-production-install-verification.json";
const DEFAULT_NOW = "2026-05-15T12:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6b_server_install_package",
  "stage6a_acceptance_baseline",
  "server_install_generator",
  "bootstrap_planner",
  "deploy_verifier",
  "compose_smoke",
  "ops_backup_restore",
  "production_env_template",
  "compose_base",
  "compose_production_overlay",
  "prestart_schema_check",
  "postgres_migrations",
];

const REQUIRED_GATE_KEYS = [
  "stage6b_ready",
  "env_template_validation",
  "first_boot_plan",
  "post_deploy_plan",
  "compose_smoke_plan",
  "backup_after_deploy_plan",
  "rollback_drill_plan",
  "stage6c_report",
];

const REQUIRED_OPERATOR_EVIDENCE = [
  "env_validated_on_target",
  "compose_config_captured",
  "health_ready_captured",
  "product_readiness_captured",
  "compose_smoke_passed",
  "backup_manifest_captured",
  "rollback_drill_reviewed",
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

export class Stage6CInstallVerificationError extends Error {
  constructor(details = []) {
    super("Stage 6C production install verification failed validation.");
    this.name = "Stage6CInstallVerificationError";
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
        details.push({ field: path, message: `Install verification package contains forbidden value: ${code}.` });
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
    details.push({ field: `verificationInputs.${index}`, message: "verification input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `verificationInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `verificationInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `verificationInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `verificationInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeGate(gate, index, details) {
  if (!isPlainObject(gate)) {
    details.push({ field: `verificationGates.${index}`, message: "verification gate must be an object." });
    return null;
  }
  const key = cleanString(gate.key);
  const label = cleanString(gate.label);
  const command = cleanString(gate.command);
  if (!key) details.push({ field: `verificationGates.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `verificationGates.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `verificationGates.${index}.command`, message: "command is required." });
  return { key, label, command, required: gate.required !== false };
}

function normalizeEvidence(item, index, details) {
  if (!isPlainObject(item)) {
    details.push({ field: `operatorEvidenceChecklist.${index}`, message: "operator evidence item must be an object." });
    return null;
  }
  const key = cleanString(item.key);
  const label = cleanString(item.label);
  if (!key) details.push({ field: `operatorEvidenceChecklist.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `operatorEvidenceChecklist.${index}.label`, message: "label is required." });
  return { key, label };
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
    redactedSummariesAllowedInTestResults: true,
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
    "stage6bRequired",
    "noSecretsInPackage",
    "noPatientDataInPackage",
    "noRuntimeApiChanges",
    "noDatabaseSchemaChanges",
    "noManagedRuntimeDependency",
    "noManagedDatabaseDependency",
    "liveEvidenceNotBundled",
  ];
  for (const key of required) {
    if (assertions[key] !== true) {
      details.push({ field: `safetyAssertions.${key}`, message: "Expected true." });
    }
  }
  return { ...assertions };
}

export function readInstallVerificationManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateInstallVerificationManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6CInstallVerificationError([{ field: "manifest", message: "Install verification manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);

  const verificationInputs = Array.isArray(input.verificationInputs)
    ? input.verificationInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  const inputKeys = verificationInputs.map((item) => item.key);
  const missingInputs = REQUIRED_INPUT_KEYS.filter((key) => !inputKeys.includes(key));
  if (missingInputs.length > 0) {
    details.push({ field: "verificationInputs", message: `Missing verification inputs: ${missingInputs.join(", ")}.` });
  }

  const verificationGates = Array.isArray(input.verificationGates)
    ? input.verificationGates.map((gate, index) => normalizeGate(gate, index, details)).filter(Boolean)
    : [];
  const gateKeys = verificationGates.map((gate) => gate.key);
  const missingGates = REQUIRED_GATE_KEYS.filter((key) => !gateKeys.includes(key));
  if (missingGates.length > 0) {
    details.push({ field: "verificationGates", message: `Missing verification gates: ${missingGates.join(", ")}.` });
  }

  const operatorEvidenceChecklist = Array.isArray(input.operatorEvidenceChecklist)
    ? input.operatorEvidenceChecklist.map((item, index) => normalizeEvidence(item, index, details)).filter(Boolean)
    : [];
  const evidenceKeys = operatorEvidenceChecklist.map((item) => item.key);
  const missingEvidence = REQUIRED_OPERATOR_EVIDENCE.filter((key) => !evidenceKeys.includes(key));
  if (missingEvidence.length > 0) {
    details.push({ field: "operatorEvidenceChecklist", message: `Missing operator evidence: ${missingEvidence.join(", ")}.` });
  }

  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  const serverInstallManifest = validateSafeRelativePath(input.serverInstallManifest, "serverInstallManifest", details);
  const liveEvidencePolicy = validateLiveEvidencePolicy(input.liveEvidencePolicy, details);
  const safetyAssertions = validateSafetyAssertions(input.safetyAssertions, details);
  if (details.length > 0) throw new Stage6CInstallVerificationError(details);

  return {
    stage: cleanString(input.stage) || "6C",
    packageId: cleanString(input.packageId) || "stage6c-production-install-verification",
    generatedAt,
    serverInstallManifest,
    productBoundary: { ...input.productBoundary },
    verificationInputs,
    verificationGates,
    operatorEvidenceChecklist,
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

export function detectInstallVerificationLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildProductionInstallVerification({
  manifest,
  root = REPO_ROOT,
  generatedAt,
} = {}) {
  const normalized = validateInstallVerificationManifest(manifest);
  const serverInstallManifest = validateServerInstallManifest(readServerInstallManifest(normalized.serverInstallManifest));
  const serverInstallPackage = buildServerInstallPackage({
    manifest: serverInstallManifest,
    root,
    generatedAt: serverInstallManifest.generatedAt,
  });
  const inventory = normalized.verificationInputs.map((input) => inputPresence(root, input));
  const missingRequiredInputs = inventory
    .filter((input) => input.required && !input.present)
    .map((input) => input.path);
  const checks = {
    stage6bReady: serverInstallPackage.status === "ready" && serverInstallPackage.readyForServerInstall,
    allRequiredInputsPresent: missingRequiredInputs.length === 0,
    verificationGatesPresent: REQUIRED_GATE_KEYS.every((key) => normalized.verificationGates.some((gate) => gate.key === key)),
    operatorEvidenceChecklistPresent: REQUIRED_OPERATOR_EVIDENCE.every((key) => normalized.operatorEvidenceChecklist.some((item) => item.key === key)),
    liveEvidencePolicySafe:
      normalized.liveEvidencePolicy.liveInstallEvidenceRequired === true &&
      normalized.liveEvidencePolicy.liveEvidenceStoredOutsideGit === true &&
      normalized.liveEvidencePolicy.repositoryContainsLiveSecrets === false &&
      normalized.liveEvidencePolicy.repositoryContainsPatientData === false,
    safetyAssertionsGreen: Object.values(normalized.safetyAssertions).every((value) => value === true),
    stage6cScriptsPresent: [
      "test:stage6c",
      "check:stage6c",
      "preflight:stage6c",
      "verify:stage6c:dry-run",
      "verify:stage6c:report",
    ].every((script) => packageScriptPresent(root, script)),
  };
  const reportCandidate = {
    stage: "6C",
    packageId: normalized.packageId,
    generatedAt: generatedAt || normalized.generatedAt,
    status: "pending",
    serverInstallPackage: {
      manifest: normalized.serverInstallManifest,
      status: serverInstallPackage.status,
      readyForServerInstall: serverInstallPackage.readyForServerInstall,
    },
    productBoundary: normalized.productBoundary,
    inventory,
    verificationGates: normalized.verificationGates,
    operatorEvidenceChecklist: normalized.operatorEvidenceChecklist,
    liveEvidencePolicy: normalized.liveEvidencePolicy,
    checks,
    missingRequiredInputs,
    liveInstallVerified: false,
  };
  const leakFindings = detectInstallVerificationLeaks(JSON.stringify(reportCandidate));
  const ready = Object.values(checks).every(Boolean) && leakFindings.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "ready" : "blocked",
    readyForLiveInstallVerification: ready,
    leakFindings,
  };
}

function escapePipe(value) {
  return String(value).replaceAll("|", "\\|");
}

export function renderProductionInstallVerificationMarkdown(report) {
  const lines = [
    "## Stage 6C production install verification",
    "",
    `- Status: \`${report.status}\``,
    `- Ready for live install verification: \`${report.readyForLiveInstallVerification}\``,
    `- Live install verified by this report: \`${report.liveInstallVerified}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Stage 6B server install package: \`${report.serverInstallPackage.status}\``,
    `- Managed runtime dependency: \`${report.productBoundary.managedRuntimeDependency}\``,
    `- Managed database dependency: \`${report.productBoundary.managedDatabaseDependency}\``,
    `- Product runtime calls external systems: \`${report.productBoundary.productRuntimeCallsExternalSystems}\``,
    "",
    "### Verification Inventory",
    "",
    "| Input | Kind | Required | Status |",
    "| --- | --- | --- | --- |",
  ];
  for (const input of report.inventory) {
    lines.push(
      `| ${escapePipe(input.label)} | ${input.kind} | ${input.required} | ${input.present ? "present" : "missing"} |`,
    );
  }
  lines.push("", "### Verification Gates", "");
  for (const [index, gate] of report.verificationGates.entries()) {
    lines.push(`${index + 1}. ${gate.label}: \`${gate.command}\``);
  }
  lines.push("", "### Operator Evidence Checklist", "");
  for (const item of report.operatorEvidenceChecklist) {
    lines.push(`- ${item.label}`);
  }
  lines.push("", "### Checks", "");
  lines.push(`- Stage 6B ready: \`${report.checks.stage6bReady}\``);
  lines.push(`- Required inputs present: \`${report.checks.allRequiredInputsPresent}\``);
  lines.push(`- Verification gates present: \`${report.checks.verificationGatesPresent}\``);
  lines.push(`- Operator evidence checklist present: \`${report.checks.operatorEvidenceChecklistPresent}\``);
  lines.push(`- Live evidence policy safe: \`${report.checks.liveEvidencePolicySafe}\``);
  lines.push(`- Safety assertions green: \`${report.checks.safetyAssertionsGreen}\``);
  lines.push(`- Stage 6C scripts present: \`${report.checks.stage6cScriptsPresent}\``);
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
    "",
    "### Privacy",
    "",
    "- This report is an offline verification package, not proof that a live server was installed.",
    "- It contains file paths, command names, verification gates, and operator checklist labels only.",
    "- Live server logs, production environment values, backup contents, patient records, object keys, credentials, external adapter payloads, and signed links must stay outside git.",
  );
  return `${lines.join("\n")}\n`;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseStage6CArgs(argv = []) {
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

export function runStage6CProductionInstallVerification({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt,
} = {}) {
  const manifest = validateInstallVerificationManifest(readInstallVerificationManifest(manifestPath));
  const report = buildProductionInstallVerification({ manifest, root, generatedAt });
  const markdown = renderProductionInstallVerificationMarkdown(report);
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
    const args = parseStage6CArgs(argv);
    const result = runStage6CProductionInstallVerification({
      root: REPO_ROOT,
      manifestPath: args.manifest,
      summaryPath: args.summaryPath || (args.dryRun ? null : DEFAULT_SUMMARY_PATH),
      jsonOut: args.jsonOut || (args.dryRun ? null : DEFAULT_JSON_PATH),
      generatedAt: args.now || undefined,
    });
    process.stdout.write(result.markdown);
    return result.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof Stage6CInstallVerificationError || error instanceof Stage6BInstallPackageError) {
      console.error("[stage6c-production-install-verification] failed:");
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage6c-production-install-verification] failed: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
