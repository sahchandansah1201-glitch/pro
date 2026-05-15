#!/usr/bin/env node
// Stage 5X · external adapter audit package.
// Builds an offline evidence bundle from Stage 5U/5V/5W artifacts.
// It performs no network calls and never controls CRM/ad services directly.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Stage5UValidationError,
  readPayloadFile,
  summarizeExternalAdapterPayload,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";
import {
  Stage5VOpsError,
  buildExternalAdapterOpsReport,
  readStatusSnapshot,
  renderExternalAdapterOpsMarkdown,
  validateStatusSnapshot,
} from "./stage5v-external-adapter-ops.mjs";
import {
  Stage5WIncidentError,
  buildAdapterControlManifest,
  classifyExternalAdapterIncident,
  readIncidentPolicy,
  renderIncidentRunbookMarkdown,
  validateIncidentPolicy,
} from "./stage5w-external-adapter-incident-runbook.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/integrations/adapter-audit-manifest.stage5x.example.json";
const DEFAULT_NOW = "2026-05-15T10:15:00.000Z";
const REQUIRED_EVIDENCE = [
  "payload-summary",
  "status-snapshot",
  "ops-report",
  "incident-runbook",
  "adapter-control-manifest",
];

const LEAK_PATTERNS = [
  { code: "access-token", pattern: /access[_-]?token/i },
  { code: "bearer-token", pattern: /authorization:\s*bearer\s+(?!<SELF_HOSTED_BEARER_TOKEN>)/i },
  { code: "storage-path", pattern: new RegExp("storage" + "_object_path", "i") },
  { code: "signed-url", pattern: new RegExp("signed" + "[_-]?url", "i") },
  { code: "external-url", pattern: /https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/i },
  { code: "api read marker", pattern: new RegExp("api-" + "read", "i") },
  { code: "api write marker", pattern: new RegExp("api-" + "write", "i") },
  { code: "edge-function", pattern: new RegExp("edge" + " function", "i") },
  { code: "managed-env", pattern: new RegExp("SUP" + "ABASE_") },
  { code: "patient-identity", pattern: /patient[_-]?full[_-]?name|fullName/i },
];

export class Stage5XAuditError extends Error {
  constructor(details = []) {
    super("Stage 5X external adapter audit package failed validation.");
    this.name = "Stage5XAuditError";
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

function validateBooleanFalse(value, field, details) {
  if (value !== false) details.push({ field, message: `${field} must be false.` });
}

function validateNone(value, field, details) {
  if (String(value || "") !== "none") details.push({ field, message: `${field} must be none.` });
}

function scanManifestValue(value, path, details) {
  if (value == null) return;
  if (typeof value === "string") {
    for (const { code, pattern } of LEAK_PATTERNS) {
      if (pattern.test(value)) {
        details.push({ field: path, message: `Audit manifest contains forbidden value: ${code}.` });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanManifestValue(item, `${path}.${index}`, details));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      scanManifestValue(key, `${path}.${key}`, details);
      scanManifestValue(item, `${path}.${key}`, details);
    }
  }
}

export function readAuditManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateAuditManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage5XAuditError([{ field: "manifest", message: "Audit manifest must be a JSON object." }]);
  }
  const details = [];
  scanManifestValue(input, "manifest", details);
  const requiredEvidence = Array.isArray(input.requiredEvidence)
    ? input.requiredEvidence.map(cleanString).filter(Boolean)
    : [];
  const manifest = {
    sourceSystem: cleanString(input.sourceSystem) || "other",
    caseId: cleanString(input.caseId) || "stage5x-audit",
    generatedAt: cleanString(input.generatedAt) || DEFAULT_NOW,
    payloadFile: validateSafeRelativePath(input.payloadFile, "payloadFile", details),
    statusFile: validateSafeRelativePath(input.statusFile, "statusFile", details),
    policyFile: validateSafeRelativePath(input.policyFile, "policyFile", details),
    outputDir: validateSafeRelativePath(input.outputDir, "outputDir", details),
    requiredEvidence,
    productRuntimeCallsExternalSystems: false,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
  };
  validateBooleanFalse(input.productRuntimeCallsExternalSystems, "productRuntimeCallsExternalSystems", details);
  validateNone(input.managedRuntimeDependency, "managedRuntimeDependency", details);
  validateNone(input.managedDatabaseDependency, "managedDatabaseDependency", details);
  const missingEvidence = REQUIRED_EVIDENCE.filter((item) => !requiredEvidence.includes(item));
  if (missingEvidence.length > 0) {
    details.push({
      field: "requiredEvidence",
      message: `Missing required evidence: ${missingEvidence.join(", ")}.`,
    });
  }
  const generatedAt = new Date(manifest.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  if (details.length > 0) throw new Stage5XAuditError(details);
  return manifest;
}

export function detectAuditBundleLeaks(text) {
  const leaks = [];
  for (const { code, pattern } of LEAK_PATTERNS) {
    if (pattern.test(text)) leaks.push(code);
  }
  return leaks;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildCompleteness(evidenceFiles) {
  const byKey = new Map(evidenceFiles.map((item) => [item.key, item]));
  return REQUIRED_EVIDENCE.map((key) => ({
    key,
    present: byKey.has(key),
    file: byKey.get(key)?.file || null,
  }));
}

export function buildExternalAdapterAuditBundle({
  manifest,
  payload,
  status,
  policy,
  now = DEFAULT_NOW,
} = {}) {
  const payloadSummary = summarizeExternalAdapterPayload(payload);
  const opsReport = buildExternalAdapterOpsReport({
    payload,
    status,
    payloadPath: manifest.payloadFile,
  });
  const incident = classifyExternalAdapterIncident({
    payload,
    status,
    policy,
    now,
  });
  const controlManifest = buildAdapterControlManifest(incident);
  const evidenceFiles = [
    {
      key: "payload-summary",
      file: "payload-summary.json",
      contentType: "application/json",
      content: stableJson({
        ...payloadSummary,
        stage5xCaseId: manifest.caseId,
        productRuntimeCallsExternalSystems: false,
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
      }),
    },
    {
      key: "status-snapshot",
      file: "status-snapshot.json",
      contentType: "application/json",
      content: stableJson({
        stage: "5X",
        sourceSystem: status.sourceSystem,
        recentBatchCount: status.recentBatchCount,
        rejectedLast24h: status.rejectedLast24h,
        duplicateLast24h: status.duplicateLast24h,
        openBookingRequestCount: status.openBookingRequestCount,
        availableSlotCount: status.availableSlotCount,
        storedRawPayload: false,
        runtimeCallsExternalSystems: false,
        hardeningVersion: status.hardeningVersion,
      }),
    },
    {
      key: "ops-report",
      file: "ops-report.md",
      contentType: "text/markdown",
      content: `${renderExternalAdapterOpsMarkdown(opsReport)}\n`,
    },
    {
      key: "incident-runbook",
      file: "incident-runbook.md",
      contentType: "text/markdown",
      content: `${renderIncidentRunbookMarkdown(incident)}\n`,
    },
    {
      key: "adapter-control-manifest",
      file: "adapter-control-manifest.json",
      contentType: "application/json",
      content: stableJson(controlManifest),
    },
  ];
  const completeness = buildCompleteness(evidenceFiles);
  const bundle = {
    stage: "5X",
    caseId: manifest.caseId,
    sourceSystem: manifest.sourceSystem,
    generatedAt: now,
    payloadFile: manifest.payloadFile,
    statusFile: manifest.statusFile,
    policyFile: manifest.policyFile,
    outputDir: manifest.outputDir,
    productRuntimeCallsExternalSystems: false,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
    evidenceFiles,
    completeness,
    gates: {
      payloadValid: true,
      statusSnapshotValid: true,
      incidentPolicyValid: true,
      evidenceComplete: completeness.every((item) => item.present),
      noLeaksDetected: true,
      productRuntimeCallsExternalSystems: false,
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
    },
  };
  const index = renderAuditBundleIndexMarkdown(bundle);
  const leaks = detectAuditBundleLeaks([
    index,
    ...evidenceFiles.map((item) => item.content),
  ].join("\n"));
  bundle.gates.noLeaksDetected = leaks.length === 0;
  bundle.leaks = leaks;
  bundle.indexFile = {
    key: "audit-index",
    file: "audit-index.md",
    contentType: "text/markdown",
    content: index,
  };
  return bundle;
}

export function renderAuditBundleIndexMarkdown(bundle) {
  const lines = [
    "## Stage 5X external adapter audit package",
    "",
    "- Mode: offline audit bundle; no network calls were made.",
    `- Case: \`${bundle.caseId}\``,
    `- Source system: \`${bundle.sourceSystem}\``,
    `- Generated at: \`${bundle.generatedAt}\``,
    "- Product runtime calls to CRM/ad systems: false",
    "- Managed runtime dependency: none",
    "- Managed database dependency: none",
    "",
    "### Evidence files",
    "",
  ];
  for (const item of bundle.evidenceFiles) {
    lines.push(`- ${item.key}: \`${item.file}\` (${item.contentType})`);
  }
  lines.push("", "### Completeness gates", "");
  for (const item of bundle.completeness) {
    lines.push(`- ${item.key}: ${item.present ? "present" : "missing"}`);
  }
  lines.push(
    "",
    "### Privacy and product boundary",
    "",
    "- Bundle output is sanitized for operator review.",
    "- Raw CRM URLs, credentials, storage paths, patient identity fields, and managed-runtime markers are blocked.",
    "- External CRM/ad systems remain outside product runtime; adapters push sanitized data into the self-hosted backend.",
  );
  return `${lines.join("\n")}\n`;
}

function writeBundle(outputDir, bundle) {
  const absoluteOutputDir = resolve(outputDir);
  mkdirSync(absoluteOutputDir, { recursive: true });
  for (const item of bundle.evidenceFiles) {
    writeFileSync(join(absoluteOutputDir, item.file), item.content);
  }
  writeFileSync(join(absoluteOutputDir, bundle.indexFile.file), bundle.indexFile.content);
}

export function parseArgs(argv = []) {
  const parsed = {
    manifest: DEFAULT_MANIFEST,
    outputDir: null,
    now: null,
    json: false,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (["--manifest", "--output-dir", "--now"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      const key = {
        "--manifest": "manifest",
        "--output-dir": "outputDir",
        "--now": "now",
      }[arg];
      parsed[key] = value;
      index += 1;
      continue;
    }
    let matchedPrefix = false;
    for (const [prefix, key] of [
      ["--manifest=", "manifest"],
      ["--output-dir=", "outputDir"],
      ["--now=", "now"],
    ]) {
      if (arg.startsWith(prefix)) {
        parsed[key] = arg.slice(prefix.length);
        matchedPrefix = true;
        break;
      }
    }
    if (matchedPrefix) {
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function renderCliSummary(bundle) {
  const lines = [
    "[stage5x-external-adapter-audit-package] OK",
    `case=${bundle.caseId}`,
    `evidence=${bundle.evidenceFiles.length + 1}`,
    `noLeaksDetected=${bundle.gates.noLeaksDetected}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const manifest = validateAuditManifest(readAuditManifest(args.manifest));
    const payload = validateExternalAdapterPayload(readPayloadFile(manifest.payloadFile));
    const status = validateStatusSnapshot(readStatusSnapshot(manifest.statusFile));
    const policy = validateIncidentPolicy(readIncidentPolicy(manifest.policyFile));
    const bundle = buildExternalAdapterAuditBundle({
      manifest,
      payload,
      status,
      policy,
      now: args.now || manifest.generatedAt,
    });
    if (!bundle.gates.noLeaksDetected) {
      throw new Stage5XAuditError(bundle.leaks.map((code) => ({
        field: "bundle",
        message: `Bundle contains forbidden value: ${code}.`,
      })));
    }
    const outputDir = args.outputDir || manifest.outputDir;
    if (outputDir) writeBundle(outputDir, bundle);
    process.stdout.write(args.json ? stableJson({
      stage: bundle.stage,
      caseId: bundle.caseId,
      evidenceFiles: bundle.evidenceFiles.map((item) => item.file).concat(bundle.indexFile.file),
      gates: bundle.gates,
    }) : renderCliSummary(bundle));
    return 0;
  } catch (error) {
    if (
      error instanceof Stage5UValidationError ||
      error instanceof Stage5VOpsError ||
      error instanceof Stage5WIncidentError ||
      error instanceof Stage5XAuditError
    ) {
      console.error("[stage5x-external-adapter-audit-package] validation failed");
      for (const detail of error.details || []) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage5x-external-adapter-audit-package] ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
