#!/usr/bin/env node
// Stage 9N-9Z · Device Bridge lifecycle assurance package renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/device-bridge-lifecycle-assurance.stage9n-9z.json";

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

function outputPath(root, target) {
  return isAbsolute(target) ? target : join(root, target);
}

export function buildDeviceBridgeLifecycleAssurancePackage({ manifest = readManifest() } = {}) {
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
    assuranceRegisters: manifest.assuranceRegisters,
    gates,
    requiredGateCount,
    requiredCommands: commandList(gates),
    requiredFiles: manifest.requiredFiles,
    productBoundary: manifest.productBoundary,
    expectedLovableConfirmation:
      manifest.assuranceRegisters.nextBatchHandoff.expectedLovableConfirmation,
    previousBatch: manifest.assuranceRegisters.nextBatchHandoff.previousBatch,
    originalHypothesis: manifest.assuranceRegisters.nextBatchHandoff.originalHypothesis,
    nextBatchHypothesis: manifest.assuranceRegisters.nextBatchHandoff.nextBatchHypothesis,
    leakFindings,
    status: safeBoundary && leakFindings.length === 0 && requiredGateCount === gates.length ? "ready" : "blocked",
  };
}

export function buildStage9N9ZLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 9N-9Z из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Device Bridge lifecycle assurance не содержит managed runtime/database dependency, browser hardware API coupling, protected storage fields, raw worker payloads, raw patient names или tokens.",
    "Project-memory должен фиксировать Stage 9N-9Z как confirmed, Stage 9B-9M как закрытый предыдущий batch и Stage 10A-10L как hypothesis.",
    "package-lock.json не должен измениться; deno.lock должен отсутствовать.",
    "",
    `Если всё совпадает, ответь: ${manifest.assuranceRegisters.nextBatchHandoff.expectedLovableConfirmation}`,
  ].join("\n");
}

export function renderDeviceBridgeLifecycleAssuranceMarkdown({
  assurancePackage = buildDeviceBridgeLifecycleAssurancePackage(),
  lovablePrompt = buildStage9N9ZLovablePrompt(),
} = {}) {
  const lines = [
    `# ${assurancePackage.title}`,
    "",
    `- Stage: \`${assurancePackage.stage}\``,
    `- Package: \`${assurancePackage.packageId}\``,
    `- Included stages: ${assurancePackage.includedStages.join(", ")}`,
    `- Status: \`${assurancePackage.status}\``,
    `- Previous batch: ${assurancePackage.previousBatch}`,
    `- Original hypothesis: ${assurancePackage.originalHypothesis}`,
    `- Next batch hypothesis: ${assurancePackage.nextBatchHypothesis}`,
    "",
    "## Purpose",
    "",
    assurancePackage.purpose,
    "",
    "## Assurance Registers",
    "",
    `- Maintenance review cadence: ${assurancePackage.assuranceRegisters.maintenanceClosure.maintenanceReviewCadence}`,
    `- Worker upgrade review cadence: ${assurancePackage.assuranceRegisters.maintenanceClosure.workerUpgradeReviewCadence}`,
    `- Audit retention review: ${assurancePackage.assuranceRegisters.maintenanceClosure.auditRetentionReviewDays} days`,
    `- Visible data: ${assurancePackage.assuranceRegisters.safeUiProjection.visibleData}`,
    "",
    "## Stages",
    "",
  ];

  for (const stage of assurancePackage.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of assurancePackage.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Managed runtime/database dependency: ${assurancePackage.productBoundary.managedRuntimeDependency}/${assurancePackage.productBoundary.managedDatabaseDependency}`,
    `- Database: ${assurancePackage.productBoundary.database}`,
    `- Object storage: ${assurancePackage.productBoundary.objectStorage}`,
    `- Browser hardware APIs: ${assurancePackage.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${assurancePackage.productBoundary.externalRuntimeCalls}`,
    `- Payload visibility: ${assurancePackage.productBoundary.payloadVisibility}`,
    `- Protected storage fields in reports: ${assurancePackage.productBoundary.protectedStorageFieldsInReports}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${assurancePackage.leakFindings.length}`,
    "- The lifecycle assurance package is repository-bundled metadata only; live secrets and runtime payloads stay outside Git.",
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

export function runStage9N9ZDeviceBridgeLifecycleAssurance({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const assurancePackage = buildDeviceBridgeLifecycleAssurancePackage({ manifest });
  const lovablePrompt = buildStage9N9ZLovablePrompt({ manifest });
  const markdown = renderDeviceBridgeLifecycleAssuranceMarkdown({ assurancePackage, lovablePrompt });
  if (summaryPath) {
    const path = outputPath(root, summaryPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown);
  }
  if (jsonPath) {
    const path = outputPath(root, jsonPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(assurancePackage, null, 2)}\n`);
  }
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: assurancePackage.status === "ready", assurancePackage, lovablePrompt, markdown };
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
  const result = runStage9N9ZDeviceBridgeLifecycleAssurance(parsed);
  if (!result.ok) {
    console.error("[stage9n-9z-device-bridge-lifecycle-assurance] blocked");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
