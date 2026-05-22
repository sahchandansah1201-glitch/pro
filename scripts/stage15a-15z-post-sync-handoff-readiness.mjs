#!/usr/bin/env node
// Stage 15A-15Z · Post-sync handoff readiness renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/post-sync-handoff-readiness.stage15a-15z.json";

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

export function buildStage15A15ZPostSyncHandoffReadiness({ manifest = readManifest() } = {}) {
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
  const confirmationReady =
    manifest.confirmedPreviousSync.stage === "Stage 14A-14Z" &&
    manifest.confirmedPreviousSync.confirmation === manifest.lovableHandoff.previousConfirmation &&
    manifest.confirmedPreviousSync.mergeCommit === manifest.previousBatchCommit &&
    manifest.confirmedPreviousSync.confirmationStoredInRepository === true;
  const boundaryReady =
    manifest.productBoundary.runtimeBehaviorChanged === false &&
    manifest.productBoundary.managedRuntimeDependency === "none" &&
    manifest.productBoundary.managedDatabaseDependency === "none" &&
    manifest.productBoundary.browserHardwareApis === false &&
    manifest.productBoundary.externalRuntimeCalls === false;
  const ledgerReady =
    manifest.ledgerSections.length >= 6 &&
    manifest.ledgerSections.every((section) => section.requiredEvidence.length >= 7);
  const ruleIds = new Set(manifest.ledgerRules.map((rule) => rule.id));
  const rulesReady =
    manifest.ledgerRules.length >= 10 &&
    ruleIds.has("post_sync_confirmation_not_memory") &&
    ruleIds.has("main_verified_before_next_handoff") &&
    ruleIds.has("sync_delay_not_conflict") &&
    ruleIds.has("stage14_regression_required") &&
    ruleIds.has("lovable_prompt_replay_manifest") &&
    ruleIds.has("next_batch_hypothesis_recorded");
  const gatesReady = requiredGateCount === gates.length && requiredGateCount >= 10;
  const status =
    scaleReady &&
    confirmationReady &&
    boundaryReady &&
    ledgerReady &&
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
    confirmedPreviousSync: manifest.confirmedPreviousSync,
    batchScale: manifest.batchScale,
    includedStages: stages.map((stage) => stage.id),
    stages,
    ledgerSections: manifest.ledgerSections,
    ledgerSectionCount: manifest.ledgerSections.length,
    ledgerRules: manifest.ledgerRules,
    ledgerRuleCount: manifest.ledgerRules.length,
    ledgerRuleSeverityCounts: severityCounts(manifest.ledgerRules),
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

export function buildStage15A15ZLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 15A-15Z из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Stage 15A-15Z фиксирует post-sync handoff readiness на 26 stages после Stage 14A-14Z.",
    "Проверь, что readiness packet содержит intake, replay, verification, diagnostics, CI и handoff sections.",
    "Проверь, что readiness rules включают post_sync_confirmation_not_memory, main_verified_before_next_handoff, sync_delay_not_conflict, stage14_regression_required и lovable_prompt_replay_manifest.",
    "Проверь, что Stage 14A-14Z confirmation сохранён как repository evidence.",
    "Проверь, что package-lock.json не изменён и deno.lock отсутствует.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableHandoff.expectedConfirmation}`,
  ].join("\n");
}

export function renderStage15A15ZPostSyncHandoffReadinessMarkdown({
  ledger = buildStage15A15ZPostSyncHandoffReadiness(),
  lovablePrompt = buildStage15A15ZLovablePrompt(),
} = {}) {
  const lines = [
    `# ${ledger.title}`,
    "",
    `- Stage: \`${ledger.stage}\``,
    `- Package: \`${ledger.packageId}\``,
    `- Status: \`${ledger.status}\``,
    `- Previous batch: ${ledger.previousBatch} (${ledger.previousBatchCommit})`,
    `- Previous confirmation: ${ledger.previousLovableConfirmation}`,
    `- Next batch hypothesis: ${ledger.nextBatchHypothesis}`,
    `- Included stages: ${ledger.includedStages.length}`,
    `- Minimum related stages per batch: ${ledger.batchScale.minimumRelatedStagesPerBatch}`,
    `- Ledger sections: ${ledger.ledgerSectionCount}`,
    `- Ledger rules: ${ledger.ledgerRuleCount}`,
    "",
    "## Purpose",
    "",
    ledger.purpose,
    "",
    "## Stage Map",
    "",
  ];

  for (const stage of ledger.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Confirmed Previous Sync", "");
  lines.push(
    `- Stage: ${ledger.confirmedPreviousSync.stage}`,
    `- Merge commit: ${ledger.confirmedPreviousSync.mergeCommit}`,
    `- Confirmation: ${ledger.confirmedPreviousSync.confirmation}`,
    `- Stored in repository: ${ledger.confirmedPreviousSync.confirmationStoredInRepository}`,
  );

  lines.push("", "## Ledger Sections", "");
  for (const section of ledger.ledgerSections) {
    lines.push(`- \`${section.id}\`: ${section.title}`);
    for (const evidence of section.requiredEvidence) lines.push(`  - ${evidence}`);
  }

  lines.push("", "## Ledger Rules", "");
  for (const rule of ledger.ledgerRules) {
    lines.push(`- ${rule.severity} \`${rule.id}\`: ${rule.rule}`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of ledger.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Runtime behavior changed: ${ledger.productBoundary.runtimeBehaviorChanged}`,
    `- Managed runtime/database dependency: ${ledger.productBoundary.managedRuntimeDependency}/${ledger.productBoundary.managedDatabaseDependency}`,
    `- Browser hardware APIs: ${ledger.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${ledger.productBoundary.externalRuntimeCalls}`,
    `- Data visibility: ${ledger.productBoundary.dataVisibility}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${ledger.leakFindings.length}`,
    "- The ledger stores repository sync evidence only.",
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

export function runStage15A15ZPostSyncHandoffReadiness({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const ledger = buildStage15A15ZPostSyncHandoffReadiness({ manifest });
  const lovablePrompt = buildStage15A15ZLovablePrompt({ manifest });
  const markdown = renderStage15A15ZPostSyncHandoffReadinessMarkdown({ ledger, lovablePrompt });
  const json = {
    generatedAt: new Date().toISOString(),
    ledger,
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
  return { ledger, markdown, json };
}

function parseArgs(argv) {
  const args = { dryRun: false, summaryPath: null, jsonPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--dry-run") args.dryRun = true;
    else if (item === "--summary") args.summaryPath = argv[++i];
    else if (item === "--json") args.jsonPath = argv[++i];
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const result = runStage15A15ZPostSyncHandoffReadiness(args);
  if (!args.dryRun && !args.summaryPath && !args.jsonPath) {
    process.stdout.write(`${result.markdown}\n`);
  }
  if (result.ledger.status !== "ready") process.exitCode = 1;
}
