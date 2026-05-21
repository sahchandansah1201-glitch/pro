#!/usr/bin/env node
// Stage 8P-9A · Device Bridge operations continuity package renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/device-ops-continuity.stage8p-9a.json";

function readManifest(root = REPO_ROOT, manifestPath = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
}

function ensureNoLeaks(value) {
  const text = JSON.stringify(value);
  const forbidden = [
    /api-read/i,
    /api-write/i,
    /edge function/i,
    /SUPABASE_/i,
    /access_token/i,
    /signed_url/i,
    /storage_object_path/i,
    /payload_json/i,
    /result_json/i,
    /patient_full_name/i,
    /navigator\.(usb|bluetooth|serial)/i,
  ];
  return forbidden
    .filter((pattern) => pattern.test(text))
    .map((pattern) => String(pattern));
}

function commandList(items = []) {
  return items.map((item) => (typeof item === "string" ? item : item.command));
}

export function buildDeviceOpsContinuityPackage({ manifest = readManifest() } = {}) {
  const stages = manifest.includedStages.map((stage) => ({
    id: stage.id,
    title: stage.title,
    status: stage.status,
  }));
  const gates = manifest.verificationGates.map((gate) => ({
    id: gate.id,
    command: gate.command,
    required: Boolean(gate.required),
  }));
  const leakFindings = ensureNoLeaks(manifest);
  const requiredGateCount = gates.filter((gate) => gate.required).length;
  const safeBoundary =
    manifest.productBoundary.managedRuntimeDependency === "none" &&
    manifest.productBoundary.managedDatabaseDependency === "none" &&
    manifest.productBoundary.browserHardwareApis === false &&
    manifest.productBoundary.externalRuntimeCalls === false &&
    manifest.productBoundary.payloadVisibility === "backend-only";

  return {
    stage: manifest.stage,
    packageId: manifest.packageId,
    title: manifest.title,
    purpose: manifest.purpose,
    includedStages: stages.map((stage) => stage.id),
    stages,
    continuityRegisters: manifest.continuityRegisters,
    gates,
    requiredGateCount,
    requiredCommands: commandList(gates),
    requiredFiles: manifest.requiredFiles,
    productBoundary: manifest.productBoundary,
    expectedLovableConfirmation:
      manifest.continuityRegisters.nextBatchHandoff.expectedLovableConfirmation,
    nextBatchHypothesis: manifest.continuityRegisters.nextBatchHandoff.nextBatchHypothesis,
    leakFindings,
    status: safeBoundary && leakFindings.length === 0 && requiredGateCount === gates.length ? "ready" : "blocked",
  };
}

export function buildStage8P9ALovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 8P-9A из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Device Bridge operations continuity не содержит managed runtime/database dependency, browser hardware API coupling, protected storage fields, raw worker payloads, raw patient names или tokens.",
    "Project-memory должен фиксировать Stage 8P-9A как confirmed и Stage 9B-9D как hypothesis.",
    "package-lock.json не должен измениться; deno.lock должен отсутствовать.",
    "",
    `Если всё совпадает, ответь: ${manifest.continuityRegisters.nextBatchHandoff.expectedLovableConfirmation}`,
  ].join("\n");
}

export function renderDeviceOpsContinuityMarkdown({
  continuityPackage = buildDeviceOpsContinuityPackage(),
  lovablePrompt = buildStage8P9ALovablePrompt(),
} = {}) {
  const lines = [
    `# ${continuityPackage.title}`,
    "",
    `- Stage: \`${continuityPackage.stage}\``,
    `- Package: \`${continuityPackage.packageId}\``,
    `- Included stages: ${continuityPackage.includedStages.join(", ")}`,
    `- Status: \`${continuityPackage.status}\``,
    `- Required gates: ${continuityPackage.requiredGateCount}`,
    `- Next batch hypothesis: ${continuityPackage.nextBatchHypothesis}`,
    "",
    "## Purpose",
    "",
    continuityPackage.purpose,
    "",
    "## Continuity Registers",
    "",
    `- Incident drill cadence: ${continuityPackage.continuityRegisters.incidentDrill.cadence}`,
    `- Incident drill evidence: ${continuityPackage.continuityRegisters.incidentDrill.storedEvidence}`,
    `- Worker telemetry retention: ${continuityPackage.continuityRegisters.telemetryRetention.workerTelemetryRetentionDays} days`,
    `- Command audit retention: ${continuityPackage.continuityRegisters.telemetryRetention.commandAuditRetentionDays} days`,
    `- Export contains raw payloads: ${continuityPackage.continuityRegisters.telemetryRetention.exportContainsRawPayloads}`,
    "",
    "## Stages",
    "",
  ];

  for (const stage of continuityPackage.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of continuityPackage.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Managed runtime/database dependency: ${continuityPackage.productBoundary.managedRuntimeDependency}/${continuityPackage.productBoundary.managedDatabaseDependency}`,
    `- Database: ${continuityPackage.productBoundary.database}`,
    `- Object storage: ${continuityPackage.productBoundary.objectStorage}`,
    `- Browser hardware APIs: ${continuityPackage.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${continuityPackage.productBoundary.externalRuntimeCalls}`,
    `- Payload visibility: ${continuityPackage.productBoundary.payloadVisibility}`,
    `- Protected storage fields in reports: ${continuityPackage.productBoundary.protectedStorageFieldsInReports}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${continuityPackage.leakFindings.length}`,
    "- The continuity package is repository-bundled metadata only; live secrets and raw runtime payloads stay outside Git.",
    "",
    "## Post-Merge Lovable Prompt",
    "",
    "```text",
    lovablePrompt,
    "```",
    "",
  );

  return lines.join("\n");
}

export function runStage8P9ADeviceOpsContinuity({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const continuityPackage = buildDeviceOpsContinuityPackage({ manifest });
  const lovablePrompt = buildStage8P9ALovablePrompt({ manifest });
  const markdown = renderDeviceOpsContinuityMarkdown({ continuityPackage, lovablePrompt });
  if (summaryPath) {
    mkdirSync(dirname(join(root, summaryPath)), { recursive: true });
    writeFileSync(join(root, summaryPath), markdown);
  }
  if (jsonPath) {
    mkdirSync(dirname(join(root, jsonPath)), { recursive: true });
    writeFileSync(join(root, jsonPath), `${JSON.stringify(continuityPackage, null, 2)}\n`);
  }
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: continuityPackage.status === "ready", continuityPackage, lovablePrompt, markdown };
}

function parseArgs(argv = []) {
  const parsed = { dryRun: false, manifestPath: DEFAULT_MANIFEST_PATH, summaryPath: null, jsonPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--manifest") {
      parsed.manifestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      parsed.summaryPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      parsed.jsonPath = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

export function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  const result = runStage8P9ADeviceOpsContinuity(parsed);
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
