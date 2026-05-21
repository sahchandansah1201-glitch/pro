#!/usr/bin/env node
// Stage 9B-9M · Device Bridge fleet reliability package renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/device-bridge-fleet-reliability.stage9b-9m.json";

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

export function buildDeviceBridgeFleetReliabilityPackage({ manifest = readManifest() } = {}) {
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
    reliabilityRegisters: manifest.reliabilityRegisters,
    gates,
    requiredGateCount,
    requiredCommands: commandList(gates),
    requiredFiles: manifest.requiredFiles,
    productBoundary: manifest.productBoundary,
    expectedLovableConfirmation:
      manifest.reliabilityRegisters.nextBatchHandoff.expectedLovableConfirmation,
    previousBatch: manifest.reliabilityRegisters.nextBatchHandoff.previousBatch,
    originalHypothesis: manifest.reliabilityRegisters.nextBatchHandoff.originalHypothesis,
    nextBatchHypothesis: manifest.reliabilityRegisters.nextBatchHandoff.nextBatchHypothesis,
    leakFindings,
    status: safeBoundary && leakFindings.length === 0 && requiredGateCount === gates.length ? "ready" : "blocked",
  };
}

export function buildStage9B9MLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 9B-9M из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Device Bridge fleet reliability не содержит managed runtime/database dependency, browser hardware API coupling, protected storage fields, raw worker payloads, raw patient names или tokens.",
    "Project-memory должен фиксировать Stage 9B-9M как confirmed, Stage 9B-9D как закрытую гипотезу и Stage 9N-9Z как hypothesis.",
    "package-lock.json не должен измениться; deno.lock должен отсутствовать.",
    "",
    `Если всё совпадает, ответь: ${manifest.reliabilityRegisters.nextBatchHandoff.expectedLovableConfirmation}`,
  ].join("\n");
}

export function renderDeviceBridgeFleetReliabilityMarkdown({
  reliabilityPackage = buildDeviceBridgeFleetReliabilityPackage(),
  lovablePrompt = buildStage9B9MLovablePrompt(),
} = {}) {
  const lines = [
    `# ${reliabilityPackage.title}`,
    "",
    `- Stage: \`${reliabilityPackage.stage}\``,
    `- Package: \`${reliabilityPackage.packageId}\``,
    `- Included stages: ${reliabilityPackage.includedStages.join(", ")}`,
    `- Status: \`${reliabilityPackage.status}\``,
    `- Previous batch: ${reliabilityPackage.previousBatch}`,
    `- Original hypothesis: ${reliabilityPackage.originalHypothesis}`,
    `- Next batch hypothesis: ${reliabilityPackage.nextBatchHypothesis}`,
    "",
    "## Purpose",
    "",
    reliabilityPackage.purpose,
    "",
    "## Reliability Registers",
    "",
    `- Worker SLO review: ${reliabilityPackage.reliabilityRegisters.fleetSlo.workerHeartbeatReviewMinutes} minutes`,
    `- Command queue review: ${reliabilityPackage.reliabilityRegisters.fleetSlo.commandQueueReviewMinutes} minutes`,
    `- Reliability review cadence: ${reliabilityPackage.reliabilityRegisters.fleetSlo.ownerRole}`,
    `- Visible data: ${reliabilityPackage.reliabilityRegisters.safeUiProjection.visibleData}`,
    "",
    "## Stages",
    "",
  ];

  for (const stage of reliabilityPackage.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of reliabilityPackage.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Managed runtime/database dependency: ${reliabilityPackage.productBoundary.managedRuntimeDependency}/${reliabilityPackage.productBoundary.managedDatabaseDependency}`,
    `- Database: ${reliabilityPackage.productBoundary.database}`,
    `- Object storage: ${reliabilityPackage.productBoundary.objectStorage}`,
    `- Browser hardware APIs: ${reliabilityPackage.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${reliabilityPackage.productBoundary.externalRuntimeCalls}`,
    `- Payload visibility: ${reliabilityPackage.productBoundary.payloadVisibility}`,
    `- Protected storage fields in reports: ${reliabilityPackage.productBoundary.protectedStorageFieldsInReports}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${reliabilityPackage.leakFindings.length}`,
    "- The reliability package is repository-bundled metadata only; live secrets and runtime payloads stay outside Git.",
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

export function runStage9B9MDeviceBridgeFleetReliability({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const reliabilityPackage = buildDeviceBridgeFleetReliabilityPackage({ manifest });
  const lovablePrompt = buildStage9B9MLovablePrompt({ manifest });
  const markdown = renderDeviceBridgeFleetReliabilityMarkdown({ reliabilityPackage, lovablePrompt });
  if (summaryPath) {
    mkdirSync(dirname(join(root, summaryPath)), { recursive: true });
    writeFileSync(join(root, summaryPath), markdown);
  }
  if (jsonPath) {
    mkdirSync(dirname(join(root, jsonPath)), { recursive: true });
    writeFileSync(join(root, jsonPath), `${JSON.stringify(reliabilityPackage, null, 2)}\n`);
  }
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: reliabilityPackage.status === "ready", reliabilityPackage, lovablePrompt, markdown };
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
  const result = runStage9B9MDeviceBridgeFleetReliability(parsed);
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
