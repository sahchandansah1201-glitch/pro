#!/usr/bin/env node
// Stage 10A-10Z · Error prevention and x2 batch quality gate renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/error-prevention.stage10a-10z.json";

const FORBIDDEN = [
  /api-read/i,
  /api-write/i,
  /edge function/i,
  /SUPABASE_/i,
  /access_token/i,
  /signed_url/i,
  /storage_object_path/i,
  /payload_json/i,
  /result_json/i,
  /worker_metadata_json/i,
  /patient_full_name/i,
  /navigator\.(usb|bluetooth|serial)/i,
];

function readManifest(root = REPO_ROOT, manifestPath = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
}

function outputPath(root, target) {
  return isAbsolute(target) ? target : join(root, target);
}

function commandList(items = []) {
  return items.map((item) => (typeof item === "string" ? item : item.command));
}

function ensureNoLeaks(value) {
  const text = JSON.stringify(value);
  return FORBIDDEN.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
}

function groupDefectsBySource(defects = []) {
  return defects.reduce((acc, defect) => {
    const source = defect.sourceBatch || "unknown";
    acc[source] = acc[source] || [];
    acc[source].push(defect.id);
    return acc;
  }, {});
}

export function buildStage10A10ZErrorPreventionPackage({ manifest = readManifest() } = {}) {
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
  const scaleReady =
    manifest.batchScale.previousIncludedStages === 13 &&
    manifest.batchScale.currentIncludedStages === 26 &&
    manifest.batchScale.scaleFactor === 2 &&
    stages.length === 26;
  const boundaryReady =
    manifest.productBoundary.runtimeBehaviorChanged === false &&
    manifest.productBoundary.managedRuntimeDependency === "none" &&
    manifest.productBoundary.managedDatabaseDependency === "none" &&
    manifest.productBoundary.browserHardwareApis === false &&
    manifest.productBoundary.externalRuntimeCalls === false;
  const preventionReady =
    manifest.diagnosedDefects.length >= 6 &&
    manifest.preventionRules.length >= 6 &&
    manifest.diagnosedDefects.every((defect) => defect.symptom && defect.prevention);
  const gatesReady = requiredGateCount === gates.length && requiredGateCount >= 10;
  const status =
    scaleReady && boundaryReady && preventionReady && gatesReady && leakFindings.length === 0
      ? "ready"
      : "blocked";

  return {
    stage: manifest.stage,
    packageId: manifest.packageId,
    title: manifest.title,
    purpose: manifest.purpose,
    previousBatch: manifest.previousBatch,
    previousBatchCommit: manifest.previousBatchCommit,
    nextBatchHypothesis: manifest.nextBatchHypothesis,
    batchScale: manifest.batchScale,
    includedStages: stages.map((stage) => stage.id),
    stages,
    diagnosedDefectCount: manifest.diagnosedDefects.length,
    diagnosedDefects: manifest.diagnosedDefects,
    defectsBySource: groupDefectsBySource(manifest.diagnosedDefects),
    preventionRuleCount: manifest.preventionRules.length,
    preventionRules: manifest.preventionRules,
    requiredFiles: manifest.requiredFiles,
    gates,
    requiredGateCount,
    requiredCommands: commandList(gates),
    productBoundary: manifest.productBoundary,
    expectedLovableConfirmation: manifest.lovableHandoff.expectedConfirmation,
    promptAllowedOnlyAfterMerge: manifest.lovableHandoff.promptAllowedOnlyAfterMerge,
    leakFindings,
    status,
  };
}

export function buildStage10A10ZLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 10A-10Z из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Stage 10A-10Z фиксирует x2 batch-size contract: 26 included stages после Stage 9N-9Z.",
    "Проверь, что Stage 10A-10Z содержит diagnosed defects из Stage 9N-9Z и prevention rules для каждого повторяемого класса ошибок.",
    "Проверь, что Lovable prompt gate по-прежнему запрещает prompt до merge в main и local main verification.",
    "Проверь, что package-lock.json не изменён и deno.lock отсутствует.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableHandoff.expectedConfirmation}`,
  ].join("\n");
}

export function renderStage10A10ZErrorPreventionMarkdown({
  preventionPackage = buildStage10A10ZErrorPreventionPackage(),
  lovablePrompt = buildStage10A10ZLovablePrompt(),
} = {}) {
  const lines = [
    `# ${preventionPackage.title}`,
    "",
    `- Stage: \`${preventionPackage.stage}\``,
    `- Package: \`${preventionPackage.packageId}\``,
    `- Status: \`${preventionPackage.status}\``,
    `- Previous batch: ${preventionPackage.previousBatch} (${preventionPackage.previousBatchCommit})`,
    `- Next batch hypothesis: ${preventionPackage.nextBatchHypothesis}`,
    `- Included stages: ${preventionPackage.includedStages.length}`,
    `- Scale factor: ${preventionPackage.batchScale.scaleFactor}x`,
    `- Diagnosed defects: ${preventionPackage.diagnosedDefectCount}`,
    `- Prevention rules: ${preventionPackage.preventionRuleCount}`,
    "",
    "## Purpose",
    "",
    preventionPackage.purpose,
    "",
    "## Stage Map",
    "",
  ];

  for (const stage of preventionPackage.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Diagnosed Defects", "");
  for (const defect of preventionPackage.diagnosedDefects) {
    lines.push(`- ${defect.id} (${defect.sourceBatch})`);
    lines.push(`  - Symptom: ${defect.symptom}`);
    lines.push(`  - Prevention: ${defect.prevention}`);
  }

  lines.push("", "## Prevention Rules", "");
  for (const rule of preventionPackage.preventionRules) {
    lines.push(`- ${rule.severity} \`${rule.id}\`: ${rule.rule}`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of preventionPackage.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Runtime behavior changed: ${preventionPackage.productBoundary.runtimeBehaviorChanged}`,
    `- Managed runtime/database dependency: ${preventionPackage.productBoundary.managedRuntimeDependency}/${preventionPackage.productBoundary.managedDatabaseDependency}`,
    `- Browser hardware APIs: ${preventionPackage.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${preventionPackage.productBoundary.externalRuntimeCalls}`,
    `- Data visibility: ${preventionPackage.productBoundary.dataVisibility}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${preventionPackage.leakFindings.length}`,
    "- The batch stores repository process metadata only.",
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

export function runStage10A10ZErrorPrevention({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const preventionPackage = buildStage10A10ZErrorPreventionPackage({ manifest });
  const lovablePrompt = buildStage10A10ZLovablePrompt({ manifest });
  const markdown = renderStage10A10ZErrorPreventionMarkdown({ preventionPackage, lovablePrompt });
  if (summaryPath) {
    const path = outputPath(root, summaryPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown);
  }
  if (jsonPath) {
    const path = outputPath(root, jsonPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(preventionPackage, null, 2)}\n`);
  }
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: preventionPackage.status === "ready", preventionPackage, lovablePrompt, markdown };
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
  const result = runStage10A10ZErrorPrevention(parsed);
  if (!result.ok) {
    console.error("[stage10a-10z-error-prevention] blocked");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
