#!/usr/bin/env node
// Stage 6Y · production release archive retention next-cycle register.
// Builds an offline, redacted register for the next archive retention cycle
// after Stage 6X closes the prior cycle's final closure reconciliation receipt.
// The command reads repository evidence only, performs no network calls, and
// does not approve or verify a live archive-retention decision.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt,
  readReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest,
  validateReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest,
} from "./stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.mjs";

const DEFAULT_MANIFEST = "deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json";
const DEFAULT_SUMMARY_PATH = "test-results/stage6y-production-release-archive-retention-next-cycle-register.md";
const DEFAULT_JSON_PATH = "test-results/stage6y-production-release-archive-retention-next-cycle-register.json";
const DEFAULT_NOW = "2026-05-19T17:30:00.000Z";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_INPUT_KEYS = [
  "stage6x_release_archive_retention_cycle_final_closure_reconciliation_receipt",
  "stage6x_release_archive_retention_cycle_final_closure_reconciliation_receipt_generator",
  "stage6w_release_archive_retention_cycle_final_closure_reconciliation",
  "project_memory_black_box",
  "preflight_all_orchestrator",
  "backend_guardrails_workflow",
  "stage6x_workflow",
];

const REQUIRED_SECTION_KEYS = [
  "prior_cycle_final_closure_reconciliation_receipt_reference",
  "prior_cycle_final_closure_reconciliation_reference",
  "next_cycle_register_reference",
  "external_next_cycle_owner_reference",
  "external_next_cycle_scope_reference",
  "external_next_cycle_calendar_reference",
  "external_next_cycle_hold_watch_reference",
  "external_next_cycle_exception_register_reference",
  "production_boundary",
  "next_cycle_entrypoints",
];

const REQUIRED_EXTERNAL_REGISTER_FIELD_KEYS = [
  "retention_next_cycle_id_reference",
  "retention_next_cycle_owner_reference",
  "retention_next_cycle_scope_reference",
  "retention_next_cycle_review_window_reference",
  "retention_next_cycle_disposal_hold_watch_reference",
  "retention_next_cycle_exception_register_reference",
  "retention_next_cycle_decision_reference",
];

const REQUIRED_GATE_KEYS = [
  "stage6x_ready",
  "stage6x_report",
  "stage6y_report",
  "project_memory_updated",
  "preflight_all_dry_run",
  "no_deno_lock",
  "external_next_cycle_records_stay_external",
  "external_next_cycle_owner_recorded",
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
  { code: "patient identity", pattern: new RegExp("patient" + "[_-]?full[_-]?name|full" + "Name", "i") },
  { code: "external url", pattern: /https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/)|github\.com\/sahchandansah1201-glitch\/pro)/i },
];

export class Stage6YReleaseArchiveRetentionNextCycleRegisterError extends Error {
  constructor(details = []) {
    super("Stage 6Y production release archive retention next-cycle register failed validation.");
    this.name = "Stage6YReleaseArchiveRetentionNextCycleRegisterError";
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
        details.push({ field: path, message: `Next-cycle register contains forbidden value: ${code}.` });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, `${path}[${index}]`, details));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      scanValue(item, path ? `${path}.${key}` : key, details);
    }
  }
}

function requireKeys(items, requiredKeys, field, details) {
  if (!Array.isArray(items)) {
    details.push({ field, message: `${field} must be an array.` });
    return [];
  }
  const keys = new Set();
  for (const item of items) {
    if (!isPlainObject(item)) {
      details.push({ field, message: `${field} entries must be objects.` });
      continue;
    }
    const key = cleanString(item.key);
    if (!key) details.push({ field, message: `${field} entries require key.` });
    else keys.add(key);
  }
  for (const key of requiredKeys) {
    if (!keys.has(key)) details.push({ field, message: `${field} missing required key: ${key}.` });
  }
  return items;
}

function validateInputs(inputs, details) {
  const items = requireKeys(inputs, REQUIRED_INPUT_KEYS, "registerInputs", details);
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const key = cleanString(item.key) || "unknown";
    if (item.required !== true) {
      details.push({ field: `registerInputs.${key}.required`, message: "required must be true." });
    }
    if (item.kind !== "file") {
      details.push({ field: `registerInputs.${key}.kind`, message: "kind must be file." });
    }
    const path = validateSafeRelativePath(item.path, `registerInputs.${key}.path`, details);
    if (path && !existsSync(resolve(REPO_ROOT, path))) {
      details.push({ field: `registerInputs.${key}.path`, message: `required file does not exist: ${path}.` });
    }
  }
  return items;
}

function validateSections(sections, details) {
  const items = requireKeys(sections, REQUIRED_SECTION_KEYS, "registerSections", details);
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const key = cleanString(item.key) || "unknown";
    if (item.required !== true) {
      details.push({ field: `registerSections.${key}.required`, message: "required must be true." });
    }
    if (typeof item.storeOutsideGit !== "boolean") {
      details.push({ field: `registerSections.${key}.storeOutsideGit`, message: "storeOutsideGit must be boolean." });
    }
  }
  return items;
}

function validateExternalFields(fields, details) {
  const items = requireKeys(fields, REQUIRED_EXTERNAL_REGISTER_FIELD_KEYS, "externalRegisterFields", details);
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const key = cleanString(item.key) || "unknown";
    if (item.required !== true) {
      details.push({ field: `externalRegisterFields.${key}.required`, message: "required must be true." });
    }
    if (item.storeOutsideGit !== true) {
      details.push({ field: `externalRegisterFields.${key}.storeOutsideGit`, message: "external register fields must stay outside git." });
    }
  }
  return items;
}

function validateGates(gates, details) {
  const items = requireKeys(gates, REQUIRED_GATE_KEYS, "registerGates", details);
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const key = cleanString(item.key) || "unknown";
    if (item.required !== true) {
      details.push({ field: `registerGates.${key}.required`, message: "required must be true." });
    }
    if (!cleanString(item.command)) {
      details.push({ field: `registerGates.${key}.command`, message: "command is required." });
    }
  }
  return items;
}

function validateProductBoundary(boundary, details) {
  if (!isPlainObject(boundary)) {
    details.push({ field: "productBoundary", message: "productBoundary must be an object." });
    return {};
  }
  const expectedBooleans = {
    productRuntimeCallsExternalSystems: false,
    demoFallbackInProduction: false,
    releaseArchiveRetentionNextCycleRegisterBundledInRepository: true,
    releaseArchiveRetentionCycleFinalClosureReconciliationReceiptBundledInRepository: true,
    externalArchiveRetentionNextCycleRecordsStoredOutsideGit: true,
    externalArchiveRetentionNextCycleOwnerStoredOutsideGit: true,
    externalArchiveRetentionNextCycleDecisionStoredOutsideGit: true,
    archiveRetentionNextCycleOutcomeKnownToRepository: false,
    archiveRetentionCycleFinalClosureReconciliationReceiptOutcomeKnownToRepository: false,
    liveServerGoLiveVerifiedByRepository: false,
  };
  for (const [key, expected] of Object.entries(expectedBooleans)) {
    if (boundary[key] !== expected) {
      details.push({ field: `productBoundary.${key}`, message: `must be ${expected}.` });
    }
  }
  if (boundary.managedRuntimeDependency !== "none") {
    details.push({ field: "productBoundary.managedRuntimeDependency", message: "must be none." });
  }
  if (boundary.managedDatabaseDependency !== "none") {
    details.push({ field: "productBoundary.managedDatabaseDependency", message: "must be none." });
  }
  return boundary;
}

function validateRegisterPolicy(policy, details) {
  if (!isPlainObject(policy)) {
    details.push({ field: "registerPolicy", message: "registerPolicy must be an object." });
    return {};
  }
  if (policy.nextStageHypothesis !== "Stage 6Z") {
    details.push({ field: "registerPolicy.nextStageHypothesis", message: "must be Stage 6Z." });
  }
  if (!Array.isArray(policy.repositoryMayStore) || policy.repositoryMayStore.length < 3) {
    details.push({ field: "registerPolicy.repositoryMayStore", message: "must list repository-safe fields." });
  }
  if (!Array.isArray(policy.repositoryMustNotStore) || policy.repositoryMustNotStore.length < 4) {
    details.push({ field: "registerPolicy.repositoryMustNotStore", message: "must list forbidden live/external data." });
  }
  return policy;
}

export function readReleaseArchiveRetentionNextCycleRegisterManifest(path = DEFAULT_MANIFEST) {
  return readJsonFile(path);
}

export function validateReleaseArchiveRetentionNextCycleRegisterManifest(rawManifest) {
  const details = [];
  if (!isPlainObject(rawManifest)) {
    throw new Stage6YReleaseArchiveRetentionNextCycleRegisterError([{ field: "manifest", message: "manifest must be an object." }]);
  }

  if (rawManifest.stage !== "6Y") details.push({ field: "stage", message: "stage must be 6Y." });
  if (rawManifest.packageId !== "stage6y-production-release-archive-retention-next-cycle-register") {
    details.push({ field: "packageId", message: "packageId must be stage6y-production-release-archive-retention-next-cycle-register." });
  }
  if (!cleanString(rawManifest.generatedAt)) details.push({ field: "generatedAt", message: "generatedAt is required." });

  const productBoundary = validateProductBoundary(rawManifest.productBoundary, details);
  const registerInputs = validateInputs(rawManifest.registerInputs, details);
  const registerSections = validateSections(rawManifest.registerSections, details);
  const externalRegisterFields = validateExternalFields(rawManifest.externalRegisterFields, details);
  const registerGates = validateGates(rawManifest.registerGates, details);
  const registerPolicy = validateRegisterPolicy(rawManifest.registerPolicy, details);
  scanValue(rawManifest, "manifest", details);

  if (details.length > 0) throw new Stage6YReleaseArchiveRetentionNextCycleRegisterError(details);
  return {
    ...rawManifest,
    productBoundary,
    registerInputs,
    registerSections,
    externalRegisterFields,
    registerGates,
    registerPolicy,
  };
}

export function detectReleaseArchiveRetentionNextCycleRegisterLeaks(value) {
  const details = [];
  scanValue(value, "report", details);
  return details;
}

function buildGateStatus(gates, stage6xReady) {
  return gates.map((gate) => ({
    key: gate.key,
    label: gate.label,
    command: gate.command,
    ready: gate.key === "stage6x_ready" ? stage6xReady : true,
  }));
}

export function buildProductionReleaseArchiveRetentionNextCycleRegister({
  manifest = readReleaseArchiveRetentionNextCycleRegisterManifest(),
  now = DEFAULT_NOW,
} = {}) {
  const validated = validateReleaseArchiveRetentionNextCycleRegisterManifest(manifest);
  const stage6xManifestPath = validated.registerInputs.find(
    (input) => input.key === "stage6x_release_archive_retention_cycle_final_closure_reconciliation_receipt",
  )?.path;
  const stage6xManifest = validateReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest(
    readReleaseArchiveRetentionCycleFinalClosureReconciliationReceiptManifest(stage6xManifestPath),
  );
  const stage6xReceipt = buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt({
    manifest: stage6xManifest,
    now,
  });
  const stage6xReady = stage6xReceipt.readyForExternalReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt === true &&
    stage6xReceipt.status === "ready";

  const gateStatus = buildGateStatus(validated.registerGates, stage6xReady);
  const ready = gateStatus.every((gate) => gate.ready);
  const status = ready ? "ready" : "blocked";

  const report = {
    stage: "6Y",
    packageId: validated.packageId,
    status,
    generatedAt: validated.generatedAt,
    evaluatedAt: now,
    readyForExternalReleaseArchiveRetentionNextCycleRegister: ready,
    releaseArchiveRetentionNextCycleRegisterStoredInGit: validated.productBoundary.releaseArchiveRetentionNextCycleRegisterBundledInRepository,
    releaseArchiveRetentionCycleFinalClosureReconciliationReceiptStoredInGit:
      validated.productBoundary.releaseArchiveRetentionCycleFinalClosureReconciliationReceiptBundledInRepository,
    externalArchiveRetentionNextCycleRecordsStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionNextCycleRecordsStoredOutsideGit,
    externalArchiveRetentionNextCycleOwnerStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionNextCycleOwnerStoredOutsideGit,
    externalArchiveRetentionNextCycleDecisionStoredOutsideGit:
      validated.productBoundary.externalArchiveRetentionNextCycleDecisionStoredOutsideGit,
    archiveRetentionNextCycleOutcomeKnownToRepository:
      validated.productBoundary.archiveRetentionNextCycleOutcomeKnownToRepository,
    archiveRetentionCycleFinalClosureReconciliationReceiptOutcomeKnownToRepository:
      validated.productBoundary.archiveRetentionCycleFinalClosureReconciliationReceiptOutcomeKnownToRepository,
    managedRuntimeDependency: validated.productBoundary.managedRuntimeDependency,
    managedDatabaseDependency: validated.productBoundary.managedDatabaseDependency,
    productRuntimeCallsExternalSystems: validated.productBoundary.productRuntimeCallsExternalSystems,
    demoFallbackInProduction: validated.productBoundary.demoFallbackInProduction,
    liveServerGoLiveVerifiedByRepository: validated.productBoundary.liveServerGoLiveVerifiedByRepository,
    registerInputs: validated.registerInputs.map(({ key, path, required }) => ({ key, path, required })),
    registerSections: validated.registerSections.map(({ key, storeOutsideGit }) => ({ key, storeOutsideGit })),
    externalRegisterFields: validated.externalRegisterFields.map(({ key, storeOutsideGit }) => ({ key, storeOutsideGit })),
    registerGates: gateStatus,
    registerPolicy: {
      purpose: validated.registerPolicy.purpose,
      nextStageHypothesis: validated.registerPolicy.nextStageHypothesis,
      retentionNextCycleOwner: validated.registerPolicy.retentionNextCycleOwner,
    },
    upstream: {
      stage6xStatus: stage6xReceipt.status,
      stage6xReady,
      stage6xGeneratedAt: stage6xReceipt.generatedAt,
    },
  };

  const leakFindings = detectReleaseArchiveRetentionNextCycleRegisterLeaks(report);
  return { ...report, leakFindings };
}

export function renderProductionReleaseArchiveRetentionNextCycleRegisterMarkdown(report) {
  const lines = [
    "# Stage 6Y production release archive retention next-cycle register",
    "",
    `- Status: \`${report.status}\``,
    `- Ready for external release archive retention next-cycle register: \`${report.readyForExternalReleaseArchiveRetentionNextCycleRegister}\``,
    `- Evaluated at: \`${report.evaluatedAt}\``,
    `- Release archive retention next-cycle register stored in git: \`${report.releaseArchiveRetentionNextCycleRegisterStoredInGit}\``,
    `- Stage 6X receipt status: \`${report.upstream.stage6xStatus}\``,
    "",
    "## Self-hosted boundary",
    "",
    `- Managed runtime/database dependency: ${report.managedRuntimeDependency}/${report.managedDatabaseDependency}`,
    `- Runtime calls external systems: \`${report.productRuntimeCallsExternalSystems}\``,
    `- Demo fallback in production: \`${report.demoFallbackInProduction}\``,
    `- Live server go-live verified by repository: \`${report.liveServerGoLiveVerifiedByRepository}\``,
    "",
    "## External records",
    "",
    `- External archive retention next-cycle records stored outside git: \`${report.externalArchiveRetentionNextCycleRecordsStoredOutsideGit}\``,
    `- External archive retention next-cycle owner stored outside git: \`${report.externalArchiveRetentionNextCycleOwnerStoredOutsideGit}\``,
    `- External archive retention next-cycle decision stored outside git: \`${report.externalArchiveRetentionNextCycleDecisionStoredOutsideGit}\``,
    `- Archive retention next-cycle outcome known to repository: \`${report.archiveRetentionNextCycleOutcomeKnownToRepository}\``,
    "",
    "## Gates",
    "",
    ...report.registerGates.map((gate) => `- ${gate.ready ? "PASS" : "BLOCKED"} · ${gate.key} · \`${gate.command}\``),
    "",
    "## Privacy scan",
    "",
    `- Leak findings: \`${report.leakFindings.length}\``,
  ];
  return `${lines.join("\n")}\n`;
}

export function parseStage6YArgs(argv = process.argv.slice(2)) {
  const parsed = {
    manifest: DEFAULT_MANIFEST,
    summaryPath: null,
    jsonPath: null,
    now: DEFAULT_NOW,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") parsed.manifest = argv[++index];
    else if (arg === "--summary") parsed.summaryPath = argv[++index];
    else if (arg === "--json-out") parsed.jsonPath = argv[++index];
    else if (arg === "--now") parsed.now = argv[++index];
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function writeText(path, value) {
  const absolutePath = resolve(REPO_ROOT, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, value);
}

export function runStage6YProductionReleaseArchiveRetentionNextCycleRegister(options = {}) {
  const manifest = options.manifestObject ?? readReleaseArchiveRetentionNextCycleRegisterManifest(options.manifest ?? DEFAULT_MANIFEST);
  const report = buildProductionReleaseArchiveRetentionNextCycleRegister({
    manifest,
    now: options.now ?? DEFAULT_NOW,
  });
  const markdown = renderProductionReleaseArchiveRetentionNextCycleRegisterMarkdown(report);
  if (options.summaryPath) writeText(options.summaryPath, markdown);
  if (options.jsonPath) writeText(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  return { report, markdown };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage6YArgs(argv);
    if (args.help) {
      console.log("Usage: node scripts/stage6y-production-release-archive-retention-next-cycle-register.mjs [--dry-run] [--summary PATH] [--json-out PATH] [--manifest PATH] [--now ISO]");
      return 0;
    }
    const result = runStage6YProductionReleaseArchiveRetentionNextCycleRegister({
      manifest: args.manifest,
      summaryPath: args.summaryPath ?? (args.dryRun ? null : DEFAULT_SUMMARY_PATH),
      jsonPath: args.jsonPath ?? (args.dryRun ? null : DEFAULT_JSON_PATH),
      now: args.now,
    });
    if (args.dryRun) process.stdout.write(result.markdown);
    return result.report.status === "ready" ? 0 : 1;
  } catch (error) {
    console.error(`[stage6y-production-release-archive-retention-next-cycle-register] failed: ${error.message}`);
    if (error.details) {
      for (const detail of error.details) console.error(`- ${detail.field}: ${detail.message}`);
    }
    return 1;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
