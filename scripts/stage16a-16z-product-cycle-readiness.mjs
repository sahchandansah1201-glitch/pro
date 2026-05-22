#!/usr/bin/env node
// Stage 16A-16Z · Product cycle readiness renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/product-cycle-readiness.stage16a-16z.json";

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

export function buildStage16A16ZProductCycleReadiness({ manifest = readManifest() } = {}) {
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
    manifest.batchScale.minimumRelatedStagesPerBatch === 26 &&
    stages.length === 26;
  const productCycleReady =
    manifest.productCycle.selectedNextTheme === "production feature delivery readiness" &&
    manifest.productCycle.blockedBatchTypesWithoutReason.includes("process-only ledger") &&
    manifest.selectedProductCandidates.length >= 3 &&
    manifest.selectedProductCandidates.some((candidate) => candidate.status === "recommended-hypothesis");
  const boundaryReady =
    manifest.productBoundary.runtimeBehaviorChanged === false &&
    manifest.productBoundary.managedRuntimeDependency === "none" &&
    manifest.productBoundary.managedDatabaseDependency === "none" &&
    manifest.productBoundary.browserHardwareApis === false &&
    manifest.productBoundary.externalRuntimeCalls === false;
  const sectionsReady =
    manifest.readinessSections.length >= 6 &&
    manifest.readinessSections.every((section) => section.requiredEvidence.length >= 8);
  const ruleIds = new Set(manifest.readinessRules.map((rule) => rule.id));
  const rulesReady =
    manifest.readinessRules.length >= 10 &&
    ruleIds.has("product_cycle_not_chat_memory") &&
    ruleIds.has("product_facing_batch_required") &&
    ruleIds.has("stage15_regression_required") &&
    ruleIds.has("surface_inventory_required") &&
    ruleIds.has("lovable_prompt_from_manifest") &&
    ruleIds.has("next_stage_hypothesis_recorded");
  const gatesReady = requiredGateCount === gates.length && requiredGateCount >= 10;
  const status =
    scaleReady &&
    productCycleReady &&
    boundaryReady &&
    sectionsReady &&
    rulesReady &&
    gatesReady &&
    leakFindings.length === 0
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
    productCycle: manifest.productCycle,
    selectedProductCandidates: manifest.selectedProductCandidates,
    recommendedProductCandidate: manifest.selectedProductCandidates.find(
      (candidate) => candidate.status === "recommended-hypothesis",
    ),
    includedStages: stages.map((stage) => stage.id),
    stages,
    readinessSections: manifest.readinessSections,
    readinessSectionCount: manifest.readinessSections.length,
    readinessRules: manifest.readinessRules,
    readinessRuleCount: manifest.readinessRules.length,
    readinessRuleSeverityCounts: severityCounts(manifest.readinessRules),
    requiredFiles: manifest.requiredFiles,
    gates,
    requiredGateCount,
    requiredCommands: commandList(gates),
    productBoundary: manifest.productBoundary,
    expectedLovableConfirmation: manifest.lovableHandoff.expectedConfirmation,
    previousLovableConfirmation: manifest.lovableHandoff.previousConfirmation,
    promptAllowedOnlyAfterMerge: manifest.lovableHandoff.promptAllowedOnlyAfterMerge,
    promptGeneratedFromManifest: manifest.lovableHandoff.promptGeneratedFromManifest,
    leakFindings,
    status,
  };
}

export function buildStage16A16ZLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 16A-16Z из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Stage 16A-16Z фиксирует product cycle readiness на 26 stages после Stage 15A-15Z.",
    "Проверь, что readiness packet содержит baseline, roadmap, surface inventory, selection, verification и handoff sections.",
    "Проверь, что readiness rules включают product_cycle_not_chat_memory, product_facing_batch_required, stage15_regression_required, surface_inventory_required и lovable_prompt_from_manifest.",
    "Проверь, что recommended product candidate — clinical follow-up and patient communication loop, а Stage 17A-17Z остаётся hypothesis.",
    "Проверь, что package-lock.json не изменён и deno.lock отсутствует.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableHandoff.expectedConfirmation}`,
  ].join("\n");
}

export function renderStage16A16ZProductCycleReadinessMarkdown({
  readiness = buildStage16A16ZProductCycleReadiness(),
  lovablePrompt = buildStage16A16ZLovablePrompt(),
} = {}) {
  const lines = [
    `# ${readiness.title}`,
    "",
    `- Stage: \`${readiness.stage}\``,
    `- Package: \`${readiness.packageId}\``,
    `- Status: \`${readiness.status}\``,
    `- Previous batch: ${readiness.previousBatch} (${readiness.previousBatchCommit})`,
    `- Previous confirmation: ${readiness.previousLovableConfirmation}`,
    `- Next batch hypothesis: ${readiness.nextBatchHypothesis}`,
    `- Recommended product candidate: ${readiness.recommendedProductCandidate.title}`,
    `- Included stages: ${readiness.includedStages.length}`,
    `- Minimum related stages per batch: ${readiness.batchScale.minimumRelatedStagesPerBatch}`,
    `- Readiness sections: ${readiness.readinessSectionCount}`,
    `- Readiness rules: ${readiness.readinessRuleCount}`,
    "",
    "## Purpose",
    "",
    readiness.purpose,
    "",
    "## Stage Map",
    "",
  ];

  for (const stage of readiness.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Product Cycle", "");
  lines.push(
    `- Cycle id: ${readiness.productCycle.cycleId}`,
    `- Intent: ${readiness.productCycle.cycleIntent}`,
    `- Selected theme: ${readiness.productCycle.selectedNextTheme}`,
  );

  lines.push("", "## Product Candidates", "");
  for (const candidate of readiness.selectedProductCandidates) {
    lines.push(`- \`${candidate.id}\`: ${candidate.title} (${candidate.status})`);
    lines.push(`  - ${candidate.reason}`);
  }

  lines.push("", "## Readiness Sections", "");
  for (const section of readiness.readinessSections) {
    lines.push(`- \`${section.id}\`: ${section.title}`);
    for (const evidence of section.requiredEvidence) lines.push(`  - ${evidence}`);
  }

  lines.push("", "## Readiness Rules", "");
  for (const rule of readiness.readinessRules) {
    lines.push(`- ${rule.severity} \`${rule.id}\`: ${rule.rule}`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of readiness.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Runtime behavior changed: ${readiness.productBoundary.runtimeBehaviorChanged}`,
    `- Managed runtime/database dependency: ${readiness.productBoundary.managedRuntimeDependency}/${readiness.productBoundary.managedDatabaseDependency}`,
    `- Browser hardware APIs: ${readiness.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${readiness.productBoundary.externalRuntimeCalls}`,
    `- Data visibility: ${readiness.productBoundary.dataVisibility}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${readiness.leakFindings.length}`,
    "- The packet stores repository product-cycle planning evidence only.",
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

export function runStage16A16ZProductCycleReadiness({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const readiness = buildStage16A16ZProductCycleReadiness({ manifest });
  const lovablePrompt = buildStage16A16ZLovablePrompt({ manifest });
  const markdown = renderStage16A16ZProductCycleReadinessMarkdown({ readiness, lovablePrompt });
  const json = {
    generatedAt: new Date().toISOString(),
    readiness,
    lovablePrompt,
  };

  if (dryRun) process.stdout.write(`${markdown}\n`);
  if (summaryPath) {
    const target = outputPath(root, summaryPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, markdown);
  }
  if (jsonPath) {
    const target = outputPath(root, jsonPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(json, null, 2)}\n`);
  }
  return { readiness, lovablePrompt, markdown, json };
}

function parseArgs(argv) {
  const options = { dryRun: false, summaryPath: null, jsonPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--summary") {
      options.summaryPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--json") {
      options.jsonPath = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = runStage16A16ZProductCycleReadiness(options);
    if (result.readiness.status !== "ready") process.exitCode = 1;
  } catch (error) {
    console.error(`[stage16a-16z-product-cycle-readiness] ${error.message}`);
    process.exit(1);
  }
}
