#!/usr/bin/env node
// Stage 13A-13Z · Execution evidence closure renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/execution-evidence-closure.stage13a-13z.json";

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
  /object_bucket/i,
  /object_key/i,
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

function severityCounts(rules = []) {
  return rules.reduce((acc, rule) => {
    acc[rule.severity] = (acc[rule.severity] || 0) + 1;
    return acc;
  }, {});
}

export function buildStage13A13ZExecutionEvidenceClosure({ manifest = readManifest() } = {}) {
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
    manifest.batchScale.previousIncludedStages === 26 &&
    manifest.batchScale.currentIncludedStages === 26 &&
    stages.length === 26;
  const boundaryReady =
    manifest.productBoundary.runtimeBehaviorChanged === false &&
    manifest.productBoundary.managedRuntimeDependency === "none" &&
    manifest.productBoundary.managedDatabaseDependency === "none" &&
    manifest.productBoundary.browserHardwareApis === false &&
    manifest.productBoundary.externalRuntimeCalls === false;
  const closureReady =
    manifest.closureSections.length >= 6 &&
    manifest.closureSections.every((section) => section.requiredEvidence.length >= 6);
  const ruleIds = new Set(manifest.closureRules.map((rule) => rule.id));
  const rulesReady =
    manifest.closureRules.length >= 10 &&
    ruleIds.has("closure_not_assumption") &&
    ruleIds.has("prompt_after_merge_only") &&
    ruleIds.has("previous_evidence_regression") &&
    ruleIds.has("next_batch_handoff_generated") &&
    ruleIds.has("lovable_prompt_source_locked");
  const gatesReady = requiredGateCount === gates.length && requiredGateCount >= 10;
  const status =
    scaleReady && boundaryReady && closureReady && rulesReady && gatesReady && leakFindings.length === 0
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
    closureSections: manifest.closureSections,
    closureSectionCount: manifest.closureSections.length,
    closureRules: manifest.closureRules,
    closureRuleCount: manifest.closureRules.length,
    closureRuleSeverityCounts: severityCounts(manifest.closureRules),
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

export function buildStage13A13ZLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 13A-13Z из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Stage 13A-13Z фиксирует execution evidence closure на 26 stages после Stage 12A-12Z.",
    "Проверь, что closure содержит schema, previous evidence, verification, GitHub, Lovable и risk closure sections.",
    "Проверь, что closure rules включают closure_not_assumption, prompt_after_merge_only, previous_evidence_regression и next_batch_handoff_generated.",
    "Проверь, что package-lock.json не изменён и deno.lock отсутствует.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableHandoff.expectedConfirmation}`,
  ].join("\n");
}

export function renderStage13A13ZExecutionEvidenceClosureMarkdown({
  closure = buildStage13A13ZExecutionEvidenceClosure(),
  lovablePrompt = buildStage13A13ZLovablePrompt(),
} = {}) {
  const lines = [
    `# ${closure.title}`,
    "",
    `- Stage: \`${closure.stage}\``,
    `- Package: \`${closure.packageId}\``,
    `- Status: \`${closure.status}\``,
    `- Previous batch: ${closure.previousBatch} (${closure.previousBatchCommit})`,
    `- Next batch hypothesis: ${closure.nextBatchHypothesis}`,
    `- Included stages: ${closure.includedStages.length}`,
    `- Minimum related stages per batch: ${closure.batchScale.minimumRelatedStagesPerBatch}`,
    `- Closure sections: ${closure.closureSectionCount}`,
    `- Closure rules: ${closure.closureRuleCount}`,
    "",
    "## Purpose",
    "",
    closure.purpose,
    "",
    "## Stage Map",
    "",
  ];

  for (const stage of closure.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Closure Sections", "");
  for (const section of closure.closureSections) {
    lines.push(`- \`${section.id}\`: ${section.title}`);
    for (const evidence of section.requiredEvidence) lines.push(`  - ${evidence}`);
  }

  lines.push("", "## Closure Rules", "");
  for (const rule of closure.closureRules) {
    lines.push(`- ${rule.severity} \`${rule.id}\`: ${rule.rule}`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of closure.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Runtime behavior changed: ${closure.productBoundary.runtimeBehaviorChanged}`,
    `- Managed runtime/database dependency: ${closure.productBoundary.managedRuntimeDependency}/${closure.productBoundary.managedDatabaseDependency}`,
    `- Browser hardware APIs: ${closure.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${closure.productBoundary.externalRuntimeCalls}`,
    `- Data visibility: ${closure.productBoundary.dataVisibility}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${closure.leakFindings.length}`,
    "- The closure stores repository evidence only.",
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

export function runStage13A13ZExecutionEvidenceClosure({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const closure = buildStage13A13ZExecutionEvidenceClosure({ manifest });
  const lovablePrompt = buildStage13A13ZLovablePrompt({ manifest });
  const markdown = renderStage13A13ZExecutionEvidenceClosureMarkdown({ closure, lovablePrompt });
  if (summaryPath) {
    const path = outputPath(root, summaryPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown);
  }
  if (jsonPath) {
    const path = outputPath(root, jsonPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(closure, null, 2)}\n`);
  }
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: closure.status === "ready", closure, lovablePrompt, markdown };
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
  const result = runStage13A13ZExecutionEvidenceClosure(parsed);
  if (!result.ok) {
    console.error("[stage13a-13z-execution-evidence-closure] blocked");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
