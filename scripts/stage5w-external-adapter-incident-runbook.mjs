#!/usr/bin/env node
// Stage 5W · external adapter incident runbook.
// Classifies inbound adapter incidents and writes local operator evidence.
// It performs no network calls and never controls CRM/ad services directly.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Stage5UValidationError,
  readPayloadFile,
  summarizeExternalAdapterPayload,
  validateExternalAdapterPayload,
} from "./stage5u-external-adapter-pack.mjs";
import {
  Stage5VOpsError,
  readStatusSnapshot,
  validateStatusSnapshot,
} from "./stage5v-external-adapter-ops.mjs";

const DEFAULT_INPUT = "deploy/self-hosted/integrations/booking-import.stage5u.example.json";
const DEFAULT_STATUS_FILE = "deploy/self-hosted/integrations/booking-import-status.stage5v.example.json";
const DEFAULT_POLICY_FILE = "deploy/self-hosted/integrations/adapter-incident-policy.stage5w.example.json";
const MIN_STALE_MINUTES = 5;
const MAX_STALE_MINUTES = 10080;

const FORBIDDEN_VALUE_PATTERNS = [
  /access[_-]?token/i,
  /authorization:\s*bearer/i,
  new RegExp("storage" + "_object_path", "i"),
  new RegExp("signed" + "[_-]?url", "i"),
  /https?:\/\//i,
  new RegExp("api-" + "read", "i"),
  new RegExp("api-" + "write", "i"),
  new RegExp("edge" + " function", "i"),
  new RegExp("SUP" + "ABASE_"),
];

export class Stage5WIncidentError extends Error {
  constructor(details = []) {
    super("Stage 5W external adapter incident runbook failed validation.");
    this.name = "Stage5WIncidentError";
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

function scanForForbiddenValues(value, path, details) {
  if (value == null) return;
  if (typeof value === "string") {
    for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        details.push({
          field: path,
          message: "Incident policy must not contain raw URLs, tokens, storage paths, or managed-runtime markers.",
        });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForForbiddenValues(item, `${path}.${index}`, details));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      scanForForbiddenValues(key, `${path}.${key}`, details);
      scanForForbiddenValues(item, `${path}.${key}`, details);
    }
  }
}

function validateInteger(value, field, details, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    details.push({ field, message: `${field} must be an integer between ${min} and ${max}.` });
    return min;
  }
  return number;
}

export function readIncidentPolicy(path = DEFAULT_POLICY_FILE) {
  return readJsonFile(path);
}

export function validateIncidentPolicy(input = {}) {
  if (!isPlainObject(input)) {
    throw new Stage5WIncidentError([{ field: "policy", message: "Incident policy must be a JSON object." }]);
  }
  const details = [];
  scanForForbiddenValues(input, "policy", details);
  const sourceSystem = cleanString(input.sourceSystem) || "all";
  const controlFilePath = cleanString(input.controlFilePath);
  const policy = {
    sourceSystem,
    rejectedItemLimit: validateInteger(input.rejectedItemLimit, "rejectedItemLimit", details, { min: 0, max: 1000 }),
    duplicateItemLimit: validateInteger(input.duplicateItemLimit, "duplicateItemLimit", details, { min: 0, max: 10000 }),
    staleAfterMinutes: validateInteger(input.staleAfterMinutes, "staleAfterMinutes", details, {
      min: MIN_STALE_MINUTES,
      max: MAX_STALE_MINUTES,
    }),
    pauseOnRejectedItems: input.pauseOnRejectedItems !== false,
    pauseOnStaleImport: input.pauseOnStaleImport !== false,
    controlFilePath,
    escalation: isPlainObject(input.escalation) ? {
      owner: cleanString(input.escalation.owner) || "operator-desk",
      handoff: cleanString(input.escalation.handoff) || "clinic-admin",
      requiredEvidence: Array.isArray(input.escalation.requiredEvidence)
        ? input.escalation.requiredEvidence.map(cleanString).filter(Boolean).slice(0, 10)
        : [],
    } : {
      owner: "operator-desk",
      handoff: "clinic-admin",
      requiredEvidence: [],
    },
  };
  if (!controlFilePath || !controlFilePath.startsWith("var/self-hosted/integrations/")) {
    details.push({
      field: "controlFilePath",
      message: "controlFilePath must stay under var/self-hosted/integrations/.",
    });
  }
  if (details.length > 0) throw new Stage5WIncidentError(details);
  return policy;
}

function latestImportAgeMinutes(status, now) {
  const latest = Array.isArray(status.latestBySource)
    ? status.latestBySource
      .map((item) => item?.lastImportedAt)
      .filter(Boolean)
      .sort()
      .at(-1)
    : null;
  if (!latest) return null;
  const latestDate = new Date(latest);
  const nowDate = new Date(now);
  if (Number.isNaN(latestDate.getTime()) || Number.isNaN(nowDate.getTime())) return null;
  return Math.max(0, Math.floor((nowDate.getTime() - latestDate.getTime()) / 60000));
}

export function classifyExternalAdapterIncident({
  payload,
  status,
  policy,
  now = new Date().toISOString(),
} = {}) {
  const payloadSummary = summarizeExternalAdapterPayload(payload);
  const ageMinutes = latestImportAgeMinutes(status, now);
  const reasons = [];
  if (status.rejectedLast24h > policy.rejectedItemLimit) {
    reasons.push({
      code: "rejected_items",
      message: `Rejected items exceeded limit: ${status.rejectedLast24h}/${policy.rejectedItemLimit}.`,
      pauseRecommended: policy.pauseOnRejectedItems,
    });
  }
  if (status.duplicateLast24h > policy.duplicateItemLimit) {
    reasons.push({
      code: "duplicate_spike",
      message: `Duplicate items exceeded limit: ${status.duplicateLast24h}/${policy.duplicateItemLimit}.`,
      pauseRecommended: false,
    });
  }
  if (ageMinutes == null || ageMinutes > policy.staleAfterMinutes) {
    reasons.push({
      code: "stale_import",
      message: ageMinutes == null
        ? "No last import timestamp is available."
        : `Latest import is stale: ${ageMinutes} minutes > ${policy.staleAfterMinutes}.`,
      pauseRecommended: policy.pauseOnStaleImport,
    });
  }
  const pauseRecommended = reasons.some((reason) => reason.pauseRecommended);
  const severity = pauseRecommended
    ? "critical"
    : reasons.length > 0
      ? "warning"
      : "ok";
  return {
    stage: "5W",
    generatedAt: now,
    sourceSystem: payloadSummary.sourceSystem,
    endpoint: payloadSummary.endpoint,
    severity,
    stateRecommendation: pauseRecommended ? "paused" : "running",
    latestImportAgeMinutes: ageMinutes,
    itemCount: payloadSummary.itemCount,
    bookingRequestCount: payloadSummary.bookingRequestCount,
    availableSlotCount: payloadSummary.availableSlotCount,
    status: {
      rejectedLast24h: status.rejectedLast24h,
      duplicateLast24h: status.duplicateLast24h,
      openBookingRequestCount: status.openBookingRequestCount,
      availableSlotCount: status.availableSlotCount,
      storedRawPayload: status.storedRawPayload,
      runtimeCallsExternalSystems: status.runtimeCallsExternalSystems,
      hardeningVersion: status.hardeningVersion,
    },
    policy: {
      rejectedItemLimit: policy.rejectedItemLimit,
      duplicateItemLimit: policy.duplicateItemLimit,
      staleAfterMinutes: policy.staleAfterMinutes,
      controlFilePath: policy.controlFilePath,
      escalation: policy.escalation,
    },
    reasons,
    productRuntimeCallsExternalSystems: false,
  };
}

export function buildAdapterControlManifest(classification) {
  return {
    sourceSystem: classification.sourceSystem,
    state: classification.stateRecommendation,
    generatedAt: classification.generatedAt,
    reasonCodes: classification.reasons.map((reason) => reason.code),
    operatorOwnedAdapter: true,
    productRuntimeCallsExternalSystems: false,
    evidence: [
      "stage5w-incident-runbook",
      "stage5v-operator-report",
      "stage5t-status-snapshot",
    ],
  };
}

export function renderIncidentRunbookMarkdown(classification) {
  const manifest = buildAdapterControlManifest(classification);
  const manifestText = JSON.stringify(manifest, null, 2);
  const lines = [
    "## Stage 5W external adapter incident runbook",
    "",
    "- Mode: dry-run only; no network calls were made.",
    `- Source system: \`${classification.sourceSystem}\``,
    `- Endpoint: \`${classification.endpoint}\``,
    `- Severity: \`${classification.severity}\``,
    `- Recommended adapter state: \`${classification.stateRecommendation}\``,
    `- Latest import age: ${classification.latestImportAgeMinutes == null ? "unknown" : `${classification.latestImportAgeMinutes} minutes`}`,
    "- Product runtime calls to CRM/ad systems: false",
    "",
    "### Incident classification",
    "",
  ];
  if (classification.reasons.length === 0) {
    lines.push("- No incident conditions detected.");
  } else {
    for (const reason of classification.reasons) {
      lines.push(`- ${reason.code}: ${reason.message}`);
    }
  }
  lines.push(
    "",
    "### Pause/resume protocol",
    "",
    "- Adapter control is operator-owned and local; the product does not call external CRM/ad systems.",
    "- If state is `paused`, stop the adapter process and keep the self-hosted product running.",
    "- Validate a clean payload with Stage 5U before resuming.",
    "- Confirm Stage 5T rejected/duplicate counters return to expected values after resume.",
    "",
    "### Local adapter-control manifest",
    "",
    `Path: \`${classification.policy.controlFilePath}\``,
    "",
    "```json",
    manifestText,
    "```",
    "",
    "### Evidence checklist",
    "",
    "- Attach this Stage 5W runbook.",
    "- Attach Stage 5V operator report.",
    "- Attach Stage 5T status snapshot.",
    "- Attach sanitized Stage 5U payload summary.",
    "- Do not attach raw CRM URLs, tokens, storage paths, patient names, or managed-runtime IDs.",
  );
  return lines.join("\n");
}

export function parseArgs(argv = []) {
  const parsed = {
    input: DEFAULT_INPUT,
    statusFile: DEFAULT_STATUS_FILE,
    policyFile: DEFAULT_POLICY_FILE,
    now: new Date().toISOString(),
    output: null,
    controlOutput: null,
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
    if (["--input", "--status-file", "--policy-file", "--now", "--output", "--control-output"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      const key = {
        "--input": "input",
        "--status-file": "statusFile",
        "--policy-file": "policyFile",
        "--now": "now",
        "--output": "output",
        "--control-output": "controlOutput",
      }[arg];
      parsed[key] = value;
      index += 1;
      continue;
    }
    let matchedPrefix = false;
    for (const [prefix, key] of [
      ["--input=", "input"],
      ["--status-file=", "statusFile"],
      ["--policy-file=", "policyFile"],
      ["--now=", "now"],
      ["--output=", "output"],
      ["--control-output=", "controlOutput"],
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

function writeOutput(path, text) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), text);
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const payload = validateExternalAdapterPayload(readPayloadFile(args.input));
    const status = validateStatusSnapshot(readStatusSnapshot(args.statusFile));
    const policy = validateIncidentPolicy(readIncidentPolicy(args.policyFile));
    const classification = classifyExternalAdapterIncident({
      payload,
      status,
      policy,
      now: args.now,
    });
    const output = args.json
      ? `${JSON.stringify(classification, null, 2)}\n`
      : `${renderIncidentRunbookMarkdown(classification)}\n`;
    if (args.output) writeOutput(args.output, output);
    if (args.controlOutput) {
      writeOutput(args.controlOutput, `${JSON.stringify(buildAdapterControlManifest(classification), null, 2)}\n`);
    }
    process.stdout.write(output);
    return 0;
  } catch (error) {
    if (error instanceof Stage5UValidationError || error instanceof Stage5VOpsError || error instanceof Stage5WIncidentError) {
      const details = error.details || [];
      console.error("[stage5w-external-adapter-incident-runbook] validation failed");
      for (const detail of details) console.error(`- ${detail.field}: ${detail.message}`);
      return 1;
    }
    console.error(`[stage5w-external-adapter-incident-runbook] ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
