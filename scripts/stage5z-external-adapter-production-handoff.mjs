#!/usr/bin/env node
// Stage 5Z · external adapter production handoff package.
// Aggregates Stage 5U-5Y local evidence for operator production signoff.
// It performs no network calls and never controls CRM/ad services directly.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Stage5UValidationError,
  readPayloadFile,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";
import {
  Stage5VOpsError,
  buildExternalAdapterOpsReport,
  readStatusSnapshot,
  validateStatusSnapshot,
} from "./stage5v-external-adapter-ops.mjs";
import {
  Stage5WIncidentError,
  classifyExternalAdapterIncident,
  readIncidentPolicy,
  validateIncidentPolicy,
} from "./stage5w-external-adapter-incident-runbook.mjs";
import {
  Stage5XAuditError,
  buildExternalAdapterAuditBundle,
  detectAuditBundleLeaks,
  readAuditManifest,
  validateAuditManifest,
} from "./stage5x-external-adapter-audit-package.mjs";
import {
  Stage5YReconciliationError,
  buildExternalAdapterReconciliationPackage,
  detectReconciliationLeaks,
  readReconciliationManifest,
  validateReconciliationManifest,
} from "./stage5y-external-adapter-reconciliation-package.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/integrations/adapter-handoff-manifest.stage5z.example.json";
const DEFAULT_NOW = "2026-05-15T10:45:00.000Z";
const REQUIRED_PACKAGES = [
  "delivery-pack",
  "operations-report",
  "incident-runbook",
  "audit-package",
  "reconciliation-package",
];

const LEAK_PATTERNS = [
  { code: "access token", pattern: /access[_-]?token/i },
  { code: "bearer token", pattern: /authorization:\s*bearer\s+(?!<SELF_HOSTED_BEARER_TOKEN>)/i },
  { code: "storage path", pattern: new RegExp("storage" + "_object_path", "i") },
  { code: "signed url", pattern: new RegExp("signed" + "[_-]?url", "i") },
  { code: "external url", pattern: /https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/i },
  { code: "api read marker", pattern: new RegExp("api-" + "read", "i") },
  { code: "api write marker", pattern: new RegExp("api-" + "write", "i") },
  { code: "edge-function marker", pattern: new RegExp("edge" + " function", "i") },
  { code: "managed env", pattern: new RegExp("SUP" + "ABASE_") },
  { code: "patient identity", pattern: /patient[_-]?full[_-]?name|fullName/i },
];

export class Stage5ZHandoffError extends Error {
  constructor(details = []) {
    super("Stage 5Z external adapter production handoff failed validation.");
    this.name = "Stage5ZHandoffError";
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
        details.push({ field: path, message: `Handoff manifest contains forbidden value: ${code}.` });
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

export function readHandoffManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateHandoffManifest(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage5ZHandoffError([{ field: "manifest", message: "Handoff manifest must be a JSON object." }]);
  }
  const details = [];
  scanManifestValue(input, "manifest", details);
  const requiredPackages = Array.isArray(input.requiredPackages)
    ? input.requiredPackages.map(cleanString).filter(Boolean)
    : [];
  const missingPackages = REQUIRED_PACKAGES.filter((item) => !requiredPackages.includes(item));
  if (missingPackages.length > 0) {
    details.push({ field: "requiredPackages", message: `Missing required packages: ${missingPackages.join(", ")}.` });
  }
  const operatorSignoff = isPlainObject(input.operatorSignoff) ? {
    owner: cleanString(input.operatorSignoff.owner) || "operator-desk",
    handoffTo: cleanString(input.operatorSignoff.handoffTo) || "clinic-admin",
    checklist: Array.isArray(input.operatorSignoff.checklist)
      ? input.operatorSignoff.checklist.map(cleanString).filter(Boolean).slice(0, 20)
      : [],
  } : {
    owner: "operator-desk",
    handoffTo: "clinic-admin",
    checklist: [],
  };
  if (operatorSignoff.checklist.length === 0) {
    details.push({ field: "operatorSignoff.checklist", message: "operator signoff checklist is required." });
  }
  const manifest = {
    sourceSystem: cleanString(input.sourceSystem) || "other",
    caseId: cleanString(input.caseId) || "stage5z-handoff",
    generatedAt: cleanString(input.generatedAt) || DEFAULT_NOW,
    payloadFile: validateSafeRelativePath(input.payloadFile, "payloadFile", details),
    statusFile: validateSafeRelativePath(input.statusFile, "statusFile", details),
    policyFile: validateSafeRelativePath(input.policyFile, "policyFile", details),
    auditManifestFile: validateSafeRelativePath(input.auditManifestFile, "auditManifestFile", details),
    reconciliationManifestFile: validateSafeRelativePath(input.reconciliationManifestFile, "reconciliationManifestFile", details),
    outputDir: validateSafeRelativePath(input.outputDir, "outputDir", details),
    requiredPackages,
    operatorSignoff,
    productRuntimeCallsExternalSystems: false,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
  };
  validateBooleanFalse(input.productRuntimeCallsExternalSystems, "productRuntimeCallsExternalSystems", details);
  validateNone(input.managedRuntimeDependency, "managedRuntimeDependency", details);
  validateNone(input.managedDatabaseDependency, "managedDatabaseDependency", details);
  const generatedAt = new Date(manifest.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    details.push({ field: "generatedAt", message: "generatedAt must be an ISO date-time." });
  }
  if (details.length > 0) throw new Stage5ZHandoffError(details);
  return manifest;
}

export function detectHandoffLeaks(text) {
  const localLeaks = [];
  for (const { code, pattern } of LEAK_PATTERNS) {
    if (pattern.test(text)) localLeaks.push(code);
  }
  const auditLeaks = detectAuditBundleLeaks(text).map((code) => code.replace(/-/g, " "));
  const reconciliationLeaks = detectReconciliationLeaks(text);
  return [...new Set([...localLeaks, ...auditLeaks, ...reconciliationLeaks])];
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function packageState(ok, details = {}) {
  return { ok: Boolean(ok), ...details };
}

export function buildExternalAdapterProductionHandoff({
  manifest,
  payload,
  status,
  policy,
  auditManifest,
  auditBundle,
  reconciliationManifest,
  reconciliationPackage,
  now = DEFAULT_NOW,
} = {}) {
  const opsReport = buildExternalAdapterOpsReport({ payload, status, payloadPath: manifest.payloadFile });
  const incident = classifyExternalAdapterIncident({ payload, status, policy, now });
  const packages = {
    deliveryPack: packageState(true, {
      itemCount: payload.items.length,
      bookingRequestCount: payload.items.filter((item) => item.kind === "booking_request").length,
      availableSlotCount: payload.items.filter((item) => item.kind === "available_slot").length,
    }),
    operationsReport: packageState(opsReport.gates.readyForOperatorReview, {
      warningCount: opsReport.warnings.length,
      rejectedLast24h: status.rejectedLast24h,
      duplicateLast24h: status.duplicateLast24h,
    }),
    incidentRunbook: packageState(incident.severity === "ok" && incident.stateRecommendation === "running", {
      severity: incident.severity,
      stateRecommendation: incident.stateRecommendation,
      reasonCount: incident.reasons.length,
    }),
    auditPackage: packageState(auditBundle.gates.evidenceComplete && auditBundle.gates.noLeaksDetected, {
      caseId: auditManifest.caseId,
      evidenceCount: auditBundle.evidenceFiles.length + 1,
      noLeaksDetected: auditBundle.gates.noLeaksDetected,
    }),
    reconciliationPackage: packageState(reconciliationPackage.readyForOperatorSignoff, {
      caseId: reconciliationManifest.caseId,
      pendingCount: reconciliationPackage.outcomes.pendingCount,
      unexpectedOutcomeCount: reconciliationPackage.outcomes.unexpectedOutcomeCount,
    }),
  };
  const checklist = {
    noProductRuntimeExternalCalls: true,
    noManagedRuntimeDependency: true,
    noManagedDatabaseDependency: true,
    externalAdaptersOperatorOwned: true,
    allRequiredPackagesPresent: REQUIRED_PACKAGES.every((item) => manifest.requiredPackages.includes(item)),
    allPackageGatesGreen: Object.values(packages).every((item) => item.ok),
  };
  const summary = {
    stage: "5Z",
    caseId: manifest.caseId,
    sourceSystem: manifest.sourceSystem,
    generatedAt: now,
    operatorSignoff: manifest.operatorSignoff,
    packages,
    checklist,
    readyForProductionHandoff: Object.values(checklist).every((value) => value === true),
    productRuntimeCallsExternalSystems: false,
    managedRuntimeDependency: "none",
    managedDatabaseDependency: "none",
  };
  const files = [
    {
      key: "handoff-summary",
      file: "handoff-summary.json",
      contentType: "application/json",
      content: stableJson(summary),
    },
    {
      key: "handoff-checklist",
      file: "handoff-checklist.json",
      contentType: "application/json",
      content: stableJson({
        stage: "5Z",
        caseId: manifest.caseId,
        checklist,
        operatorChecklist: manifest.operatorSignoff.checklist,
      }),
    },
    {
      key: "handoff-report",
      file: "handoff-summary.md",
      contentType: "text/markdown",
      content: renderProductionHandoffMarkdown(summary),
    },
  ];
  const leaks = detectHandoffLeaks(files.map((item) => item.content).join("\n"));
  summary.checklist.noLeaksDetected = leaks.length === 0;
  summary.readyForProductionHandoff = summary.readyForProductionHandoff && leaks.length === 0;
  return {
    ...summary,
    files,
    leaks,
  };
}

export function renderProductionHandoffMarkdown(summary) {
  const lines = [
    "## Stage 5Z external adapter production handoff",
    "",
    "- Mode: offline production handoff; no network calls were made.",
    `- Case: \`${summary.caseId}\``,
    `- Source system: \`${summary.sourceSystem}\``,
    `- Generated at: \`${summary.generatedAt}\``,
    `- Owner: \`${summary.operatorSignoff.owner}\``,
    `- Handoff to: \`${summary.operatorSignoff.handoffTo}\``,
    "- Product runtime calls to CRM/ad systems: false",
    "- Managed runtime dependency: none",
    "- Managed database dependency: none",
    "",
    "### Package gates",
    "",
  ];
  for (const [name, state] of Object.entries(summary.packages)) {
    lines.push(`- ${name}: ${state.ok ? "green" : "blocked"}`);
  }
  lines.push("", "### Production checklist", "");
  for (const [key, value] of Object.entries(summary.checklist)) {
    lines.push(`- ${key}: ${value === true ? "yes" : value}`);
  }
  lines.push(
    `- readyForProductionHandoff: ${summary.readyForProductionHandoff ? "yes" : "no"}`,
    "",
    "### Operator checklist",
    "",
  );
  for (const item of summary.operatorSignoff.checklist) {
    lines.push(`- ${item}`);
  }
  lines.push(
    "",
    "### Boundary",
    "",
    "- CRM/ad adapters remain outside product runtime.",
    "- The self-hosted backend is the only product ingestion boundary.",
    "- Attach Stage 5U, Stage 5V, Stage 5W, Stage 5X, and Stage 5Y evidence with this handoff.",
  );
  return `${lines.join("\n")}\n`;
}

function writeHandoff(outputDir, handoff) {
  const absoluteOutputDir = resolve(outputDir);
  mkdirSync(absoluteOutputDir, { recursive: true });
  for (const file of handoff.files) {
    writeFileSync(join(absoluteOutputDir, file.file), file.content);
  }
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
    if (matchedPrefix) continue;
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function renderCliSummary(handoff) {
  const lines = [
    "[stage5z-external-adapter-production-handoff] OK",
    `case=${handoff.caseId}`,
    `files=${handoff.files.length}`,
    `readyForProductionHandoff=${handoff.readyForProductionHandoff}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const manifest = validateHandoffManifest(readHandoffManifest(args.manifest));
    const payload = validateExternalAdapterPayload(readPayloadFile(manifest.payloadFile));
    const status = validateStatusSnapshot(readStatusSnapshot(manifest.statusFile));
    const policy = validateIncidentPolicy(readIncidentPolicy(manifest.policyFile));
    const auditManifest = validateAuditManifest(readAuditManifest(manifest.auditManifestFile));
    const auditPayload = validateExternalAdapterPayload(readPayloadFile(auditManifest.payloadFile));
    const auditStatus = validateStatusSnapshot(readStatusSnapshot(auditManifest.statusFile));
    const auditPolicy = validateIncidentPolicy(readIncidentPolicy(auditManifest.policyFile));
    const auditBundle = buildExternalAdapterAuditBundle({
      manifest: auditManifest,
      payload: auditPayload,
      status: auditStatus,
      policy: auditPolicy,
      now: auditManifest.generatedAt,
    });
    const reconciliationManifest = validateReconciliationManifest(
      readReconciliationManifest(manifest.reconciliationManifestFile),
    );
    const reconciliationPackage = buildExternalAdapterReconciliationPackage({
      manifest: reconciliationManifest,
      payload,
      status,
      auditManifest,
      auditBundle,
      now: reconciliationManifest.generatedAt,
    });
    const handoff = buildExternalAdapterProductionHandoff({
      manifest,
      payload,
      status,
      policy,
      auditManifest,
      auditBundle,
      reconciliationManifest,
      reconciliationPackage,
      now: args.now || manifest.generatedAt,
    });
    if (handoff.leaks.length > 0) {
      throw new Stage5ZHandoffError(handoff.leaks.map((code) => ({
        field: "handoff",
        message: `Handoff output contains forbidden value: ${code}.`,
      })));
    }
    const outputDir = args.outputDir || manifest.outputDir;
    if (outputDir) writeHandoff(outputDir, handoff);
    process.stdout.write(args.json ? stableJson({
      stage: handoff.stage,
      caseId: handoff.caseId,
      files: handoff.files.map((item) => item.file),
      readyForProductionHandoff: handoff.readyForProductionHandoff,
      checklist: handoff.checklist,
    }) : renderCliSummary(handoff));
    return 0;
  } catch (error) {
    if (
      error instanceof Stage5UValidationError ||
      error instanceof Stage5VOpsError ||
      error instanceof Stage5WIncidentError ||
      error instanceof Stage5XAuditError ||
      error instanceof Stage5YReconciliationError ||
      error instanceof Stage5ZHandoffError
    ) {
      console.error("[stage5z-external-adapter-production-handoff] validation failed");
      for (const detail of error.details || []) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage5z-external-adapter-production-handoff] ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
