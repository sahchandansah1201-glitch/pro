#!/usr/bin/env node
// Stage 12A-12Z · Execution evidence bundle renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json";

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

function severityCounts(rules = []) {
  return rules.reduce((acc, rule) => {
    acc[rule.severity] = (acc[rule.severity] || 0) + 1;
    return acc;
  }, {});
}

export function buildStage12A12ZExecutionEvidenceBundle({ manifest = readManifest() } = {}) {
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
  const evidenceReady =
    manifest.evidenceSections.length >= 5 &&
    manifest.evidenceSections.every((section) => section.requiredEvidence.length >= 6);
  const rulesReady =
    manifest.evidenceRules.length >= 8 &&
    manifest.evidenceRules.some((rule) => rule.id === "evidence_not_assertion") &&
    manifest.evidenceRules.some((rule) => rule.id === "checks_before_ready") &&
    manifest.evidenceRules.some((rule) => rule.id === "merge_before_prompt") &&
    manifest.evidenceRules.some((rule) => rule.id === "lovable_prompt_generated");
  const gatesReady = requiredGateCount === gates.length && requiredGateCount >= 10;
  const status =
    scaleReady && boundaryReady && evidenceReady && rulesReady && gatesReady && leakFindings.length === 0
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
    evidenceSections: manifest.evidenceSections,
    evidenceSectionCount: manifest.evidenceSections.length,
    evidenceRules: manifest.evidenceRules,
    evidenceRuleCount: manifest.evidenceRules.length,
    evidenceRuleSeverityCounts: severityCounts(manifest.evidenceRules),
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

export function buildStage12A12ZLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 12A-12Z из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Stage 12A-12Z фиксирует execution evidence bundle на 26 stages после Stage 11A-11Z.",
    "Проверь, что bundle содержит implementation, diagnostics, verification, GitHub и Lovable evidence sections.",
    "Проверь, что evidence rules включают evidence_not_assertion, checks_before_ready, merge_before_prompt и lovable_prompt_generated.",
    "Проверь, что package-lock.json не изменён и deno.lock отсутствует.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableHandoff.expectedConfirmation}`,
  ].join("\n");
}

export function renderStage12A12ZExecutionEvidenceBundleMarkdown({
  bundle = buildStage12A12ZExecutionEvidenceBundle(),
  lovablePrompt = buildStage12A12ZLovablePrompt(),
} = {}) {
  const lines = [
    `# ${bundle.title}`,
    "",
    `- Stage: \`${bundle.stage}\``,
    `- Package: \`${bundle.packageId}\``,
    `- Status: \`${bundle.status}\``,
    `- Previous batch: ${bundle.previousBatch} (${bundle.previousBatchCommit})`,
    `- Next batch hypothesis: ${bundle.nextBatchHypothesis}`,
    `- Included stages: ${bundle.includedStages.length}`,
    `- Minimum related stages per batch: ${bundle.batchScale.minimumRelatedStagesPerBatch}`,
    `- Evidence sections: ${bundle.evidenceSectionCount}`,
    `- Evidence rules: ${bundle.evidenceRuleCount}`,
    "",
    "## Purpose",
    "",
    bundle.purpose,
    "",
    "## Stage Map",
    "",
  ];

  for (const stage of bundle.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Evidence Sections", "");
  for (const section of bundle.evidenceSections) {
    lines.push(`- \`${section.id}\`: ${section.title}`);
    for (const evidence of section.requiredEvidence) lines.push(`  - ${evidence}`);
  }

  lines.push("", "## Evidence Rules", "");
  for (const rule of bundle.evidenceRules) {
    lines.push(`- ${rule.severity} \`${rule.id}\`: ${rule.rule}`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of bundle.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Runtime behavior changed: ${bundle.productBoundary.runtimeBehaviorChanged}`,
    `- Managed runtime/database dependency: ${bundle.productBoundary.managedRuntimeDependency}/${bundle.productBoundary.managedDatabaseDependency}`,
    `- Browser hardware APIs: ${bundle.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${bundle.productBoundary.externalRuntimeCalls}`,
    `- Data visibility: ${bundle.productBoundary.dataVisibility}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${bundle.leakFindings.length}`,
    "- The bundle stores repository execution evidence only.",
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

export function runStage12A12ZExecutionEvidenceBundle({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const bundle = buildStage12A12ZExecutionEvidenceBundle({ manifest });
  const lovablePrompt = buildStage12A12ZLovablePrompt({ manifest });
  const markdown = renderStage12A12ZExecutionEvidenceBundleMarkdown({ bundle, lovablePrompt });
  if (summaryPath) {
    const path = outputPath(root, summaryPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown);
  }
  if (jsonPath) {
    const path = outputPath(root, jsonPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
  }
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: bundle.status === "ready", bundle, lovablePrompt, markdown };
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
  const result = runStage12A12ZExecutionEvidenceBundle(parsed);
  if (!result.ok) {
    console.error("[stage12a-12z-execution-evidence-bundle] blocked");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
