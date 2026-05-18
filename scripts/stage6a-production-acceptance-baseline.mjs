#!/usr/bin/env node
// Stage 6A · production acceptance baseline.
// Builds a local readiness report for the whole self-hosted product. The
// command reads repository evidence only; it performs no network calls.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_MANIFEST = "deploy/self-hosted/acceptance-baseline.stage6a.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6a-production-acceptance-baseline.md";
const DEFAULT_JSON_PATH = "test-results/stage6a-production-acceptance-baseline.json";
const DEFAULT_NOW = "2026-05-15T11:00:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_DOMAIN_KEYS = [
  "deployable_stack",
  "production_mode",
  "auth_rbac",
  "patient_clinical_workspace",
  "clinical_assets",
  "doctor_schedule_dashboard",
  "leads_appointments",
  "patient_portal",
  "external_adapter_flow",
  "ops_readiness",
  "device_bridge",
];

const REQUIRED_RELEASE_GATES = [
  "npm run preflight:stage6a",
  "npm run preflight:all -- --dry-run",
  "npm run build",
  "npm run smoke:stage4k:dry-run",
  "npm run deploy:stage4m:post-deploy:dry-run",
  "npm run deploy:stage4m:backup-after-deploy:dry-run",
  "npm run deploy:stage4m:rollback-drill:dry-run",
  "node scripts/check-no-deno-locks.mjs",
  "git diff --check",
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

export class Stage6AAcceptanceError extends Error {
  constructor(details = []) {
    super("Stage 6A production acceptance baseline failed validation.");
    this.name = "Stage6AAcceptanceError";
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
        details.push({ field: path, message: `Acceptance baseline contains forbidden value: ${code}.` });
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
    deployment: "single self-hosted product",
    managedRuntime: "none",
    managedDatabase: "none",
    runtimeCallsExternalSystems: false,
    demoFallbackInProduction: false,
    browserHardwareApis: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (boundary[key] !== value) {
      details.push({ field: `productBoundary.${key}`, message: `Expected ${String(value)}.` });
    }
  }
  for (const key of ["frontend", "backend", "database", "objectStorage", "worker"]) {
    if (!cleanString(boundary[key])) {
      details.push({ field: `productBoundary.${key}`, message: `${key} is required.` });
    }
  }
}

function normalizeDomain(domain, index, details) {
  if (!isPlainObject(domain)) {
    details.push({ field: `acceptanceDomains.${index}`, message: "domain must be an object." });
    return null;
  }
  const key = cleanString(domain.key);
  const label = cleanString(domain.label);
  const stage = cleanString(domain.stage);
  const status = cleanString(domain.status);
  if (!key) details.push({ field: `acceptanceDomains.${index}.key`, message: "key is required." });
  if (!label) details.push({ field: `acceptanceDomains.${index}.label`, message: "label is required." });
  if (!stage) details.push({ field: `acceptanceDomains.${index}.stage`, message: "stage is required." });
  if (status !== "ready") {
    details.push({ field: `acceptanceDomains.${index}.status`, message: "status must be ready." });
  }
  const evidenceFiles = Array.isArray(domain.evidenceFiles)
    ? domain.evidenceFiles.map((file, fileIndex) =>
      validateSafeRelativePath(file, `acceptanceDomains.${index}.evidenceFiles.${fileIndex}`, details),
    ).filter(Boolean)
    : [];
  if (evidenceFiles.length === 0) {
    details.push({ field: `acceptanceDomains.${index}.evidenceFiles`, message: "at least one evidence file is required." });
  }
  return { key, label, stage, status, evidenceFiles };
}

export function readAcceptanceManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateAcceptanceManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage6AAcceptanceError([{ field: "manifest", message: "Acceptance manifest must be a JSON object." }]);
  }
  const details = [];
  scanValue(input, "manifest", details);
  validateBoundary(input.productBoundary, details);
  const releaseGates = Array.isArray(input.releaseGates)
    ? input.releaseGates.map(cleanString).filter(Boolean)
    : [];
  const missingGates = REQUIRED_RELEASE_GATES.filter((gate) => !releaseGates.includes(gate));
  if (missingGates.length > 0) {
    details.push({ field: "releaseGates", message: `Missing release gates: ${missingGates.join(", ")}.` });
  }
  const acceptanceDomains = Array.isArray(input.acceptanceDomains)
    ? input.acceptanceDomains.map((domain, index) => normalizeDomain(domain, index, details)).filter(Boolean)
    : [];
  const domainKeys = acceptanceDomains.map((domain) => domain.key);
  const missingDomains = REQUIRED_DOMAIN_KEYS.filter((key) => !domainKeys.includes(key));
  if (missingDomains.length > 0) {
    details.push({ field: "acceptanceDomains", message: `Missing acceptance domains: ${missingDomains.join(", ")}.` });
  }
  const generatedAt = cleanString(input.generatedAt) || DEFAULT_NOW;
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  if (details.length > 0) throw new Stage6AAcceptanceError(details);
  return {
    stage: cleanString(input.stage) || "6A",
    caseId: cleanString(input.caseId) || "stage6a-production-acceptance-baseline",
    generatedAt,
    productBoundary: { ...input.productBoundary },
    releaseGates,
    acceptanceDomains,
  };
}

function filePresence(root, file) {
  return { file, present: existsSync(join(root, file)) };
}

function findDenoLocks(root) {
  const blockedDirs = new Set([".git", "node_modules", "dist", "test-results", "coverage"]);
  const found = [];
  function walk(relativeDir) {
    const absoluteDir = join(root, relativeDir);
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      if (blockedDirs.has(entry.name)) continue;
      const relativePath = join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        walk(relativePath);
        continue;
      }
      if (entry.isFile() && entry.name === "deno.lock") found.push(relativePath);
    }
  }
  if (existsSync(root) && statSync(root).isDirectory()) walk("");
  return found.map((item) => item.replaceAll("\\", "/"));
}

function packageLockChanged(root) {
  const result = spawnSync("git", ["diff", "--quiet", "--", "package-lock.json"], {
    cwd: root,
    encoding: "utf8",
  });
  return result.status !== 0;
}

function packageScriptPresent(root, scriptName) {
  const parsed = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return Boolean(parsed.scripts?.[scriptName]);
}

export function detectAcceptanceLeaks(text) {
  return LEAK_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ code }) => code);
}

export function buildProductionAcceptanceBaseline({
  manifest,
  root = REPO_ROOT,
  generatedAt,
} = {}) {
  const normalized = validateAcceptanceManifest(manifest);
  const domains = normalized.acceptanceDomains.map((domain) => {
    const evidence = domain.evidenceFiles.map((file) => filePresence(root, file));
    return {
      ...domain,
      evidence,
      missingEvidence: evidence.filter((item) => !item.present).map((item) => item.file),
    };
  });
  const denoLockFiles = findDenoLocks(root);
  const checks = {
    packageLockUnchanged: !packageLockChanged(root),
    noDenoLockFiles: denoLockFiles.length === 0,
    stage6aScriptsPresent: [
      "test:stage6a",
      "check:stage6a",
      "preflight:stage6a",
      "acceptance:stage6a:report",
    ].every((script) => packageScriptPresent(root, script)),
  };
  const reportCandidate = {
    stage: "6A",
    caseId: normalized.caseId,
    generatedAt: generatedAt || normalized.generatedAt,
    status: "pending",
    productBoundary: normalized.productBoundary,
    acceptanceDomains: domains,
    releaseGates: normalized.releaseGates.map((command) => ({ command, required: true })),
    checks,
    denoLockFiles,
  };
  const leaks = detectAcceptanceLeaks(JSON.stringify(reportCandidate));
  const domainFailures = domains.filter((domain) => domain.status !== "ready" || domain.missingEvidence.length > 0);
  const ready =
    domainFailures.length === 0 &&
    checks.packageLockUnchanged &&
    checks.noDenoLockFiles &&
    checks.stage6aScriptsPresent &&
    leaks.length === 0;
  return {
    ...reportCandidate,
    status: ready ? "accepted" : "blocked",
    readyForServerInstallPackage: ready,
    failedDomains: domainFailures.map((domain) => domain.key),
    leakFindings: leaks,
  };
}

function escapePipe(value) {
  return String(value).replaceAll("|", "\\|");
}

export function renderProductionAcceptanceBaselineMarkdown(report) {
  const lines = [
    "## Stage 6A production acceptance baseline",
    "",
    `- Status: \`${report.status}\``,
    `- Ready for Stage 6B server install package: \`${report.readyForServerInstallPackage}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Managed runtime: \`${report.productBoundary.managedRuntime}\``,
    `- Managed database: \`${report.productBoundary.managedDatabase}\``,
    `- Runtime calls external systems: \`${report.productBoundary.runtimeCallsExternalSystems}\``,
    `- Demo fallback in production: \`${report.productBoundary.demoFallbackInProduction}\``,
    "",
    "### Product Boundary",
    "",
    `- Deployment: ${report.productBoundary.deployment}`,
    `- Frontend: ${report.productBoundary.frontend}`,
    `- Backend: ${report.productBoundary.backend}`,
    `- Database: ${report.productBoundary.database}`,
    `- Object storage: ${report.productBoundary.objectStorage}`,
    `- Worker: ${report.productBoundary.worker}`,
    "",
    "### Acceptance Domains",
    "",
    "| Domain | Stage | Status | Evidence |",
    "| --- | --- | --- | --- |",
  ];
  for (const domain of report.acceptanceDomains) {
    const evidence = domain.missingEvidence.length === 0
      ? `${domain.evidence.length}/${domain.evidence.length} present`
      : `missing ${domain.missingEvidence.length}`;
    lines.push(`| ${escapePipe(domain.label)} | ${escapePipe(domain.stage)} | ${domain.status} | ${evidence} |`);
  }
  lines.push("", "### Release Gates", "");
  for (const gate of report.releaseGates) {
    lines.push(`- \`${gate.command}\``);
  }
  lines.push("", "### Repository Checks", "");
  lines.push(`- package-lock unchanged: \`${report.checks.packageLockUnchanged}\``);
  lines.push(`- no deno.lock files: \`${report.checks.noDenoLockFiles}\``);
  lines.push(`- Stage 6A scripts present: \`${report.checks.stage6aScriptsPresent}\``);
  lines.push(`- leak findings: \`${report.leakFindings.length}\``);
  if (report.failedDomains.length > 0) {
    lines.push("", "### Blockers", "");
    for (const domain of report.failedDomains) lines.push(`- ${domain}`);
    for (const file of report.denoLockFiles) lines.push(`- deno.lock: \`${file}\``);
  }
  lines.push(
    "",
    "### Privacy",
    "",
    "- The report contains local file names, stage labels, and command names only.",
    "- It does not print credentials, raw environment values, patient identity data, object keys, or external adapter payloads.",
  );
  return `${lines.join("\n")}\n`;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseStage6AArgs(argv = []) {
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

export function runStage6AAcceptanceBaseline({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST,
  summaryPath = DEFAULT_SUMMARY_PATH,
  jsonOut = DEFAULT_JSON_PATH,
  generatedAt,
} = {}) {
  const manifest = validateAcceptanceManifest(readAcceptanceManifest(manifestPath));
  const report = buildProductionAcceptanceBaseline({ manifest, root, generatedAt });
  const markdown = renderProductionAcceptanceBaselineMarkdown(report);
  if (summaryPath) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, markdown);
  }
  if (jsonOut) {
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, stableJson(report));
  }
  return { ok: report.status === "accepted", report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage6AArgs(argv);
    const result = runStage6AAcceptanceBaseline({
      root: REPO_ROOT,
      manifestPath: args.manifest,
      summaryPath: args.summaryPath || (args.dryRun ? null : DEFAULT_SUMMARY_PATH),
      jsonOut: args.jsonOut || (args.dryRun ? null : DEFAULT_JSON_PATH),
      generatedAt: args.now || undefined,
    });
    process.stdout.write(result.markdown);
    return result.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof Stage6AAcceptanceError) {
      console.error("[stage6a-production-acceptance-baseline] failed:");
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage6a-production-acceptance-baseline] failed: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
