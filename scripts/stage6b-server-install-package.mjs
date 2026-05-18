#!/usr/bin/env node
// Stage 6B · server install package.
// Builds an operator-facing install package from repository evidence only. The
// command performs no network calls and does not introduce a runtime API.

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
  Stage6AAcceptanceError,
  buildProductionAcceptanceBaseline,
  readAcceptanceManifest,
  validateAcceptanceManifest,
} from "./stage6a-production-acceptance-baseline.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/server-install-package.stage6b.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6b-server-install-package.md";
const DEFAULT_JSON_PATH = "test-results/stage6b-server-install-package.json";
const DEFAULT_NOW = "2026-05-15T11:30:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6a_acceptance_baseline",
  "compose_base",
  "compose_production_overlay",
  "nginx_gateway",
  "production_env_template",
  "backend_container",
  "backend_server",
  "postgres_migrations",
  "prestart_schema_check",
  "device_bridge_worker",
  "device_bridge_systemd_unit",
  "device_bridge_env_template",
  "system_admin_bootstrap_template",
];

const REQUIRED_STEP_KEYS = [
  "verify_acceptance_baseline",
  "copy_env_template",
  "verify_env",
  "build_frontend",
  "compose_config",
  "start_stack",
  "bootstrap_system_admin",
  "first_boot_checks",
  "compose_smoke",
  "backup_and_rollback_plan",
];

const REQUIRED_OPERATOR_OUTPUTS = [
  "server-install-plan",
  "package-inventory",
  "first-boot-checklist",
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

export class Stage6BInstallPackageError extends Error {
  constructor(details = []) {
    super("Stage 6B server install package failed validation.");
    this.name = "Stage6BInstallPackageError";
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
        details.push({ field: path, message: `Server install package contains forbidden value: ${code}.` });
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
    details.push({ field: `packageInputs.${index}`, message: "package input must be an object." });
    return null;
  }
  const key = cleanString(input.key);
  const label = cleanString(input.label);
  const kind = cleanString(input.kind);
  if (!key) details.push({ field: `packageInputs.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `packageInputs.${index}.label`, message: "label is required." });
  if (!["file", "directory"].includes(kind)) {
    details.push({ field: `packageInputs.${index}.kind`, message: "kind must be file or directory." });
  }
  return {
    key,
    label,
    kind,
    path: validateSafeRelativePath(input.path, `packageInputs.${index}.path`, details),
    required: input.required !== false,
  };
}

function normalizeStep(step, index, details) {
  if (!isPlainObject(step)) {
    details.push({ field: `installSteps.${index}`, message: "install step must be an object." });
    return null;
  }
  const key = cleanString(step.key);
  const label = cleanString(step.label);
  const command = cleanString(step.command);
  if (!key) details.push({ field: `installSteps.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `installSteps.${index}.label`, message: "label is required." });
  if (!command) details.push({ field: `installSteps.${index}.command`, message: "command is required." });
  return { key, label, command, required: step.required !== false };
}

function validateSafetyAssertions(assertions, details) {
  if (!isPlainObject(assertions)) {
    details.push({ field: "safetyAssertions", message: "safetyAssertions is required." });
    return {};
  }
  const required = [
    "noSecretsInPackage",
    "noPatientDataInPackage",
    "noManagedRuntimeDependency",
    "noManagedDatabaseDependency",
    "productionEnvMustBeCompletedOnServer",
    "systemAdminSqlMustStayOutsideGit",
  ];
  for (const key of required) {
    if (assertions[key] !== true) {
      details.push({ field: `safetyAssertions.${key}`, message: "Expected true." });
    }
  }
  return { ...assertions };
}

export function readServerInstallManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateServerInstallManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6BInstallPackageError([{ field: "manifest", message: "Server install manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);

  const packageInputs = Array.isArray(input.packageInputs)
    ? input.packageInputs.map((item, index) => normalizeInput(item, index, details)).filter(Boolean)
    : [];
  const inputKeys = packageInputs.map((item) => item.key);
  const missingInputs = REQUIRED_INPUT_KEYS.filter((key) => !inputKeys.includes(key));
  if (missingInputs.length > 0) {
    details.push({ field: "packageInputs", message: `Missing package inputs: ${missingInputs.join(", ")}.` });
  }

  const installSteps = Array.isArray(input.installSteps)
    ? input.installSteps.map((step, index) => normalizeStep(step, index, details)).filter(Boolean)
    : [];
  const stepKeys = installSteps.map((step) => step.key);
  const missingSteps = REQUIRED_STEP_KEYS.filter((key) => !stepKeys.includes(key));
  if (missingSteps.length > 0) {
    details.push({ field: "installSteps", message: `Missing install steps: ${missingSteps.join(", ")}.` });
  }

  const operatorOutputs = Array.isArray(input.operatorOutputs)
    ? input.operatorOutputs.map(cleanString).filter(Boolean)
    : [];
  const missingOutputs = REQUIRED_OPERATOR_OUTPUTS.filter((key) => !operatorOutputs.includes(key));
  if (missingOutputs.length > 0) {
    details.push({ field: "operatorOutputs", message: `Missing operator outputs: ${missingOutputs.join(", ")}.` });
  }

  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  const baselineManifest = validateSafeRelativePath(input.baselineManifest, "baselineManifest", details);
  const safetyAssertions = validateSafetyAssertions(input.safetyAssertions, details);
  if (details.length > 0) throw new Stage6BInstallPackageError(details);

  return {
    stage: cleanString(input.stage) || "6B",
    packageId: cleanString(input.packageId) || "stage6b-server-install-package",
    generatedAt,
    baselineManifest,
    productBoundary: { ...input.productBoundary },
    packageInputs,
    installSteps,
    operatorOutputs,
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

export function detectServerInstallLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildServerInstallPackage({
  manifest,
  root = REPO_ROOT,
  generatedAt,
} = {}) {
  const normalized = validateServerInstallManifest(manifest);
  const baselineManifest = validateAcceptanceManifest(readAcceptanceManifest(normalized.baselineManifest));
  const baseline = buildProductionAcceptanceBaseline({
    manifest: baselineManifest,
    root,
    generatedAt: baselineManifest.generatedAt,
  });
  const inventory = normalized.packageInputs.map((input) => inputPresence(root, input));
  const missingRequiredInputs = inventory
    .filter((input) => input.required && !input.present)
    .map((input) => input.path);
  const requiredSteps = normalized.installSteps.filter((step) => step.required);
  const checks = {
    stage6aAccepted: baseline.status === "accepted" && baseline.readyForServerInstallPackage,
    allRequiredInputsPresent: missingRequiredInputs.length === 0,
    installStepsPresent: REQUIRED_STEP_KEYS.every((key) => normalized.installSteps.some((step) => step.key === key)),
    operatorOutputsPresent: REQUIRED_OPERATOR_OUTPUTS.every((key) => normalized.operatorOutputs.includes(key)),
    safetyAssertionsGreen: Object.values(normalized.safetyAssertions).every((value) => value === true),
    stage6bScriptsPresent: [
      "test:stage6b",
      "check:stage6b",
      "preflight:stage6b",
      "install:stage6b:dry-run",
      "install:stage6b:report",
    ].every((script) => packageScriptPresent(root, script)),
  };
  const reportCandidate = {
    stage: "6B",
    packageId: normalized.packageId,
    generatedAt: generatedAt || normalized.generatedAt,
    status: "pending",
    baseline: {
      manifest: normalized.baselineManifest,
      status: baseline.status,
      readyForServerInstallPackage: baseline.readyForServerInstallPackage,
    },
    productBoundary: normalized.productBoundary,
    inventory,
    installSteps: normalized.installSteps,
    requiredStepCount: requiredSteps.length,
    operatorOutputs: normalized.operatorOutputs,
    checks,
    missingRequiredInputs,
  };
  const leakFindings = detectServerInstallLeaks(JSON.stringify(reportCandidate));
  const ready = Object.values(checks).every(Boolean) && leakFindings.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "ready" : "blocked",
    readyForServerInstall: ready,
    leakFindings,
  };
}

function escapePipe(value) {
  return String(value).replaceAll("|", "\\|");
}

export function renderServerInstallPackageMarkdown(report) {
  const lines = [
    "## Stage 6B server install package",
    "",
    `- Status: \`${report.status}\``,
    `- Ready for server install: \`${report.readyForServerInstall}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Stage 6A baseline: \`${report.baseline.status}\``,
    `- Managed runtime dependency: \`${report.productBoundary.managedRuntimeDependency}\``,
    `- Managed database dependency: \`${report.productBoundary.managedDatabaseDependency}\``,
    `- Product runtime calls external systems: \`${report.productBoundary.productRuntimeCallsExternalSystems}\``,
    "",
    "### Package Inventory",
    "",
    "| Input | Kind | Required | Status |",
    "| --- | --- | --- | --- |",
  ];
  for (const input of report.inventory) {
    lines.push(
      `| ${escapePipe(input.label)} | ${input.kind} | ${input.required} | ${input.present ? "present" : "missing"} |`,
    );
  }
  lines.push("", "### Server Install Steps", "");
  for (const [index, step] of report.installSteps.entries()) {
    lines.push(`${index + 1}. ${step.label}: \`${step.command}\``);
  }
  lines.push("", "### Checks", "");
  lines.push(`- Stage 6A accepted: \`${report.checks.stage6aAccepted}\``);
  lines.push(`- Required inputs present: \`${report.checks.allRequiredInputsPresent}\``);
  lines.push(`- Install steps present: \`${report.checks.installStepsPresent}\``);
  lines.push(`- Operator outputs present: \`${report.checks.operatorOutputsPresent}\``);
  lines.push(`- Safety assertions green: \`${report.checks.safetyAssertionsGreen}\``);
  lines.push(`- Stage 6B scripts present: \`${report.checks.stage6bScriptsPresent}\``);
  lines.push(`- Leak findings: \`${report.leakFindings.length}\``);
  if (report.missingRequiredInputs.length > 0 || report.leakFindings.length > 0) {
    lines.push("", "### Blockers", "");
    for (const file of report.missingRequiredInputs) lines.push(`- Missing input: \`${file}\``);
    for (const leak of report.leakFindings) lines.push(`- Leak finding: \`${leak}\``);
  }
  lines.push(
    "",
    "### Operator Outputs",
    "",
    ...report.operatorOutputs.map((output) => `- ${output}`),
    "",
    "### Privacy",
    "",
    "- The install package contains file paths, commands, and checklist labels only.",
    "- Production environment values and first system admin SQL must be created on the target server and kept outside git.",
    "- The package does not include patient records, object keys, credentials, external adapter payloads, or signed links.",
  );
  return `${lines.join("\n")}\n`;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseStage6BArgs(argv = []) {
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

export function runStage6BServerInstallPackage({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt,
} = {}) {
  const manifest = validateServerInstallManifest(readServerInstallManifest(manifestPath));
  const report = buildServerInstallPackage({ manifest, root, generatedAt });
  const markdown = renderServerInstallPackageMarkdown(report);
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
    const args = parseStage6BArgs(argv);
    const result = runStage6BServerInstallPackage({
      root: REPO_ROOT,
      manifestPath: args.manifest,
      summaryPath: args.summaryPath || (args.dryRun ? null : DEFAULT_SUMMARY_PATH),
      jsonOut: args.jsonOut || (args.dryRun ? null : DEFAULT_JSON_PATH),
      generatedAt: args.now || undefined,
    });
    process.stdout.write(result.markdown);
    return result.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof Stage6BInstallPackageError || error instanceof Stage6AAcceptanceError) {
      console.error("[stage6b-server-install-package] failed:");
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage6b-server-install-package] failed: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
